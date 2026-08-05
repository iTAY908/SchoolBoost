# Seedance 2.5 video generation (Kinovi)

Generate video clips with the `seedance2-5-preview` model — useful here for the
app's promo/store assets (feature graphic loops, reels, the intro sequence).

```
seedance.js          the client library (submit · poll · download)
cli.js               command line
generate-video.sh    the same thing in bash
```

---

## 🔑 First: your API key

**Set it in the environment. Never in a file.**

```bash
export KINOVI_API_KEY="your-key"
```

> ⚠️ The key that was pasted into the original script (`zimg_C3m4…`) should be
> treated as **compromised** — revoke it in the Kinovi dashboard and issue a new
> one. A key in a script is a key in your shell history, your git history and
> anyone's screen who sees the file. Whoever has it can burn your credits.

---

## Usage

```bash
node cli.js --prompt "cinematic tracking shot through a city park after rain, \
soft cloudy light, wet pavement reflections, smooth camera movement" \
  --duration 5 --resolution 720p --aspect 16:9 --seed 42 \
  --out out/park.mp4
```

```
--prompt, -p <text>     what to generate                     (required)
--out, -o <file>        where to save   (default: out/<taskId>.mp4)
--duration, -d <sec>    1–12                                 (default: 5)
--resolution, -r <res>  480p | 720p | 1080p                  (default: 720p)
--aspect, -a <ratio>    16:9 | 9:16 | 1:1 | 4:3 | 3:4 | 21:9
--seed <int>            fixed seed → reproducible output
--negative <text>       things to avoid
--image <url>           source image (image-to-video)
--callback <url>        webhook on completion
--timeout <sec>         stop waiting                         (default: 600)
--no-download           print the URL only
--json                  machine-readable output
--status <taskId>       check an existing job
--batch <file.json>     generate a list of clips
```

### Batch

```json
[
  { "prompt": "ice cube dissolving into gold coins, dark navy background",
    "aspectRatio": "9:16", "duration": 5, "out": "out/promo-vertical.mp4" },
  { "prompt": "slow push over a desk, phone showing a budget app",
    "duration": 6, "out": "out/desk.mp4" }
]
```

```bash
node cli.js --batch prompts.json
```

One failure doesn't stop the run; the exit code is non-zero if any clip failed.

### As a library

```js
const { generateVideo } = require('./seedance');

const { taskId, videoUrl, file } = await generateVideo({
  prompt: 'cinematic tracking shot through a city park after rain',
  duration: 5, resolution: '720p', aspectRatio: '16:9', seed: 42,
  output: 'out/park.mp4',
  onProgress: (p) => console.log(p.status),
});
```

### Bash

```bash
export KINOVI_API_KEY="your-key"
./generate-video.sh "a cinematic shot of ..." out/clip.mp4

# tune via env
SEEDANCE_DURATION=8 SEEDANCE_ASPECT=9:16 ./generate-video.sh "..." out/v.mp4
```

---

## What this fixes versus a naive script

| Problem | Consequence | Handled |
|---|---|---|
| Key hard-coded | Leaks through git/history/screen-shares | Read from `KINOVI_API_KEY`; key-shaped strings are redacted from logs |
| `grep` on JSON | Breaks on any whitespace/field-order change; failures parse as empty | Real JSON parsing |
| `while true` polling | A stuck job hangs forever | Hard deadline + backoff (2s→15s) |
| HTTP codes ignored | A 401/500 looks like "still processing" | Status checked; 429/5xx retried, 4xx fails fast |
| Prompt interpolated into JSON | Quotes/apostrophes corrupt the request | Payload built by a JSON serializer |
| No download | You get a URL that eventually expires | Video written to disk, empty-file guard |
| Invalid params sent | Wasted round-trip, possibly a billed job | Validated locally first |
| `callBackUrl: example.com` | Pointless request to a domain you don't own | Only sent when you configure one |

---

## Verified

Exercised against a mock server reproducing the Kinovi contract:

- submit → poll → download, file written correctly
- a transient `503` mid-poll is retried, not fatal
- API-reported failure surfaces its reason
- timeout stops cleanly and tells you how to check the job later
- invalid `duration`/`resolution` rejected **before** submitting
- missing key exits `78`; generation failure `1`; success `0`
- prompts containing quotes and apostrophes serialize correctly
- batch continues past a failure and reports `2/3`

The Kinovi endpoints and field names follow the contract in the original
script. If the live API returns a different shape, `extractVideoUrl()` in
`seedance.js` already checks the common variants — add yours there.
