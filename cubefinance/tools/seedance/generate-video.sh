#!/usr/bin/env bash
# ============================================================================
# Seedance 2.5 video generation (Kinovi) — hardened shell version.
#
#   export KINOVI_API_KEY="your-key"
#   ./generate-video.sh "a cinematic shot of ..." [out.mp4]
#
# Differences from a naive script, and why they matter:
#   • The key comes from the environment. A key written into a file that gets
#     committed or shared is a leaked key.
#   • JSON is parsed with python3, not grep — grep on JSON breaks the moment the
#     API changes whitespace or field order.
#   • Polling has a deadline, so a stuck job cannot loop forever.
#   • HTTP status codes are checked; failures surface instead of being silently
#     parsed as empty strings.
#   • The finished video is downloaded.
# ============================================================================

set -euo pipefail

API_ROOT="${KINOVI_API_ROOT:-https://kinovi.ai/api/v1}"
MODEL="${SEEDANCE_MODEL:-seedance2-5-preview}"
PROMPT="${1:-}"
OUT="${2:-}"
DURATION="${SEEDANCE_DURATION:-5}"
RESOLUTION="${SEEDANCE_RESOLUTION:-720p}"
ASPECT="${SEEDANCE_ASPECT:-16:9}"
SEED="${SEEDANCE_SEED:-}"
MAX_WAIT="${SEEDANCE_TIMEOUT:-600}"     # seconds

die() { printf '\n✗ %s\n' "$1" >&2; exit "${2:-1}"; }

[[ -n "${KINOVI_API_KEY:-}" ]] || die \
  "KINOVI_API_KEY is not set.
  export KINOVI_API_KEY=\"your-key\"
  Never hard-code the key in this file — anything committed is public." 78

[[ -n "$PROMPT" ]] || die "Usage: $0 \"<prompt>\" [output.mp4]"
command -v python3 >/dev/null || die "python3 is required (used to parse JSON safely)"

jget() { python3 -c 'import sys,json
try: d=json.load(sys.stdin)
except Exception: sys.exit(0)
for k in sys.argv[1:]:
    if isinstance(d,dict) and k in d: d=d[k]
    elif isinstance(d,dict) and "data" in d and isinstance(d["data"],dict) and k in d["data"]: d=d["data"][k]
    else: sys.exit(0)
print(d if not isinstance(d,(dict,list)) else json.dumps(d))' "$@"; }

# ---- build the request with python so quoting can never break the JSON ------
PAYLOAD=$(python3 -c '
import json,os,sys
inputs={"prompt":sys.argv[1],"duration":int(sys.argv[2]),
        "resolution":sys.argv[3],"aspectRatio":sys.argv[4]}
if sys.argv[5]: inputs["seed"]=int(sys.argv[5])
print(json.dumps({"model":sys.argv[6],"inputs":inputs}))' \
  "$PROMPT" "$DURATION" "$RESOLUTION" "$ASPECT" "$SEED" "$MODEL")

printf 'Prompt : %s\n' "$PROMPT"
printf 'Format : %ss · %s · %s%s\n\n' "$DURATION" "$RESOLUTION" "$ASPECT" \
  "${SEED:+ · seed $SEED}"

# ---- submit ----------------------------------------------------------------
HTTP_BODY=$(mktemp); trap 'rm -f "$HTTP_BODY"' EXIT
CODE=$(curl -sS -o "$HTTP_BODY" -w '%{http_code}' -X POST "$API_ROOT/jobs/createTask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KINOVI_API_KEY" \
  --max-time 30 -d "$PAYLOAD") || die "Network error contacting the API"

[[ "$CODE" == 2* ]] || die "createTask returned HTTP $CODE: $(head -c 300 "$HTTP_BODY")"

TASK_ID=$(jget taskId < "$HTTP_BODY")
[[ -n "$TASK_ID" ]] || TASK_ID=$(jget id < "$HTTP_BODY")
[[ -n "$TASK_ID" ]] || die "No taskId in response: $(head -c 300 "$HTTP_BODY")"
printf '→ Submitted: %s\n' "$TASK_ID"

# ---- poll with a deadline --------------------------------------------------
START=$(date +%s); DELAY=2
while :; do
  NOW=$(date +%s); ELAPSED=$((NOW - START))
  if (( ELAPSED > MAX_WAIT )); then
    die "Timed out after ${MAX_WAIT}s. The job may still finish — check with:
  curl -H \"Authorization: Bearer \$KINOVI_API_KEY\" \\
       \"$API_ROOT/jobs/recordInfo?taskId=$TASK_ID\""
  fi

  CODE=$(curl -sS -o "$HTTP_BODY" -w '%{http_code}' --max-time 30 \
    "$API_ROOT/jobs/recordInfo?taskId=$TASK_ID" \
    -H "Authorization: Bearer $KINOVI_API_KEY") || CODE=000

  if [[ "$CODE" != 2* ]]; then
    printf '  ! HTTP %s while polling — retrying\n' "$CODE"
    sleep "$DELAY"; continue
  fi

  STATUS=$(jget status < "$HTTP_BODY")
  case "$STATUS" in
    success|succeeded|completed)
      VIDEO_URL=$(jget videoUrl < "$HTTP_BODY")
      [[ -n "$VIDEO_URL" ]] || VIDEO_URL=$(jget url < "$HTTP_BODY")
      [[ -n "$VIDEO_URL" ]] || die "Succeeded but no video URL: $(head -c 300 "$HTTP_BODY")"
      break ;;
    fail|failed|error)
      REASON=$(jget failReason < "$HTTP_BODY"); [[ -n "$REASON" ]] || REASON=$(head -c 300 "$HTTP_BODY")
      die "Generation failed: $REASON" ;;
    *)
      printf '  %s … %ss\n' "${STATUS:-pending}" "$ELAPSED"
      sleep "$DELAY"
      DELAY=$(( DELAY < 15 ? DELAY + 1 : 15 )) ;;
  esac
done

printf '\n✓ Done\n  Task  : %s\n  Video : %s\n' "$TASK_ID" "$VIDEO_URL"

# ---- download --------------------------------------------------------------
[[ -n "$OUT" ]] || OUT="out/${TASK_ID}.mp4"
mkdir -p "$(dirname "$OUT")"
curl -sS -L --max-time 300 -o "$OUT" "$VIDEO_URL" || die "Download failed"
[[ -s "$OUT" ]] || die "Downloaded file is empty"
printf '  Saved : %s (%s)\n' "$OUT" "$(du -h "$OUT" | cut -f1)"
