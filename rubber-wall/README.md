# Rubber Wall: 15-second animation

A vertical ink-and-charcoal short: a boy (a black silhouette) runs at a blue rubber wall, stretches it deep into the frame, tears through, and steps out into an open, softly lit space. The closing line reads: "גם כשמרגישים לכודים, / יש דרך החוצה."

- Output: `out/rubber_wall_15s.mp4`, 1080×1920, 30 fps, exactly 15.0 s, H.264 + AAC 48 kHz
- Everything is generated in code. There are no stock images, samples or external music. The soundtrack is original and synthesised in `audio.py`.

## Files
| File | Purpose |
|---|---|
| `src/scene.js` | The whole animation, written for Canvas 2D. It is deterministic, so any frame can be drawn on its own. |
| `src/index.html` | Live preview with play, scrub and audio. It also hosts the frame renderer. |
| `src/LiberationSans-Bold.ttf` | Font for the Hebrew caption (Liberation Sans, SIL OFL) |
| `audio.py` | Synthesises the music and sound effects. It reads the foot-contact times taken from the animation. |
| `render.mjs` | Pipeline: events → `audio.py` → 450 frames in headless Chromium → ffmpeg mux |

## Run
Requirements: Node 18+, Playwright with Chromium, Python 3 with NumPy, and ffmpeg.

```bash
node render.mjs                      # full render -> out/rubber_wall_15s.mp4
node render.mjs --frames 0,150,320   # just stills -> out/still_XXX.png
```
Preview: after one full render, `src/soundtrack.wav` exists. Open `src/index.html` in a browser, or serve the folder with `npx serve src`, then press Play.

## Timeline
| Time | Picture | Sound |
|---|---|---|
| 0–3 s | Running through the white void, scribbles of thought circling | Soft piano, running footsteps |
| 3–6 s | Hands and head meet the anchored rubber sheet, which dents and clings to him. The camera swings from behind to a diagonal side view. | Soft impact, low drone, gentle pulses, effort breaths |
| 6–10 s | A deep cone-shaped bulge (~1.5 m) pokes out past the wall's original plane and its edge post, with his head and arms visible through the thin rubber and tension lines running from the anchored edges. It pulls him back twice, and the scribbles crowd behind him. | Strings in a measured crescendo, rubber creaks |
| 10.15–10.5 s | A crack of light opens above his head | Riser, high "ping" |
| 10.5 s | The rubber tears and its edges snap back to the sides | Musical climax plus rip, then a ~0.4 s pause |
| 10.95 s | The camera swings back behind him as he goes through. Trees appear only now. | Warm C-major (add9) chord |
| 12–15 s | He slows, straightens and takes a deep breath. The caption fades in. | Calm piano, steps on grass, faint leaves |

To tweak the timing, edit `VK` (speed), `T_CRACK`/`T_BURST` and the camera keys in `camera()` in `scene.js`. Then run `node render.mjs` again, which also rebuilds the audio in sync.
