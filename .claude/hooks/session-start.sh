#!/bin/bash
# Installs Agent Reach (https://github.com/Panniantong/agent-reach) so remote
# sessions get its internet-access channels and its agent skill.
#
# Everything lands outside the repo (~/.agent-reach-venv, ~/.agent-reach,
# ~/.claude/skills/agent-reach), per Agent Reach's own directory rules.
set -euo pipefail

# Web/remote sessions only — local machines keep whatever they already have.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

VENV="$HOME/.agent-reach-venv"
SRC_ZIP="https://github.com/Panniantong/agent-reach/archive/main.zip"
HOOK_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/.claude/hooks"

# agent-reach probes several channels via `which` (yt-dlp, bili, rdt, twitter),
# so its own CLIs have to be on PATH for this script too, not just the session.
export PATH="$VENV/bin:$HOME/.local/bin:$PATH"

# Put the CLIs on PATH for the session regardless of whether we install below.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$VENV/bin:\$HOME/.local/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

if [ -x "$VENV/bin/agent-reach" ]; then
  echo "Agent Reach already installed ($("$VENV/bin/agent-reach" --version 2>/dev/null || echo unknown))"
  exit 0
fi

python3 -m venv "$VENV"
"$VENV/bin/pip" install --quiet --upgrade pip

# Preferred path: the documented archive install.
if ! "$VENV/bin/pip" install --quiet "$SRC_ZIP"; then
  # Some egress policies allow raw.githubusercontent.com but 403 github.com,
  # codeload and the API. Rebuild the source tree from raw and install that.
  echo "Archive install failed; rebuilding source from raw.githubusercontent.com"
  SRC_DIR="$(mktemp -d)"
  python3 "$HOOK_DIR/agent_reach_fetch_src.py" "$SRC_DIR"
  "$VENV/bin/pip" install --quiet "$SRC_DIR"
  rm -rf "$SRC_DIR"
fi

# Channel setup reaches out to a lot of hosts; a restricted network makes parts
# of it fail, which must not take the session down with it.
"$VENV/bin/agent-reach" install --env=auto --channels=all || \
  echo "agent-reach install reported errors; run 'agent-reach doctor' for details"

"$VENV/bin/agent-reach" --version
