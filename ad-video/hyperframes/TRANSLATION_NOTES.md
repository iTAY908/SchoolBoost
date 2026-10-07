# Translation notes — Remotion `AdVideo` → HyperFrames

Source: `../src/AdVideo.tsx` (+ `src/config.ts`, `src/font.ts`, `src/scenes/*`,
`src/components/*`). Produced with the `remotion-to-hyperframes` skill.
**No Remotion source was modified.** Only the `AdVideo` composition was ported;
`PitchUpgrade` / `ReelVideo` / `StoryVideo` depend on gitignored footage under
`public/source/` that is not on disk and could not be rendered or verified.

Lint (`scripts/lint_source.py`) over the AdVideo subtree: **0 blockers**,
1 warning (`delayRender` in `src/font.ts`), 2 info.

## Layout

| File | Role |
| --- | --- |
| `index.html` | root `ad-video`, 1080x1920 @30fps, `data-duration="12.866667"` (386 frames), registers the shared CustomEases, sequences six sub-composition hosts |
| `compositions/backdrop.html` | the persistent gradient + two drifting glows + vignette + grain, full 386 frames |
| `compositions/scene-{hook,gallery,results,brand,cta}.html` | one per `TransitionSeries.Sequence`, each with its own paused GSAP timeline in local time |
| `assets/fonts/Heebo-{400,700,900}.ttf` | copied from `../public/fonts/`, wired with in-file `@font-face` |
| `assets/vendor/{gsap,CustomEase}.min.js` | GSAP 3.14.2 vendored locally (the CDN is not reachable from this container) |

Timing comes straight from `src/config.ts`: `SCENE_DURATIONS` 66/84/90/78/108
and `TRANSITION_FRAMES` 10, so `TOTAL_DURATION = 426 - 4*10 = 386` frames.
Scene hosts overlap by the 10-frame transitions exactly as `TransitionSeries`
does: starts 0 / 56 / 130 / 210 / 278.

## Faithful

- **Scene graph, geometry, colours, shadows, gradients** copied value-for-value
  from the Remotion styles, including the shrink behaviour of the gallery cards
  (they are flex items that compress from 280px to ~169px — the single most
  visible thing to get wrong).
- **`springTiming({config:{damping:200}, durationInFrames:10})`** was *sampled
  from Remotion itself* (21 points) and replayed as a piecewise `CustomEase`,
  rather than approximated with `back.out(N)`.
- **`Easing.inOut(Easing.ease)`** (backdrop glow drift, hook headline scale) was
  sampled the same way.
- **`Easing.bezier(0.16, 1.5|1.4|1.3|1, 0.3, 1)`** map 1:1 onto
  `CustomEase.create(..., "M0,0 C<a>,<b> <c>,<d> 1,1")`.
- **`@remotion/transitions` math** was read out of `node_modules` and reproduced
  literally, including that `fade()` leaves the *outgoing* scene fully opaque
  (`shouldFadeOutExitingScene` defaults false) — so `scene-results` has no exit
  tween and `scene-brand` simply fades in on top of it.
- **Hebrew** is untouched text with `direction: rtl` on the same elements as the
  original; word order and line breaks match the Remotion render exactly.
- **Heebo 400/700/900** are the same committed TTFs, confirmed glyph-for-glyph
  against a Remotion reference render (see "Verification").

## Approximate — and why

1. **`output: "perceptual-scale"`.** Remotion's `interpolate` can interpolate a
   scale factor perceptually; GSAP tweens the raw number. Measured worst-case
   divergence on the `PopWords` pop (0.55 -> 1 over 11 frames) is ~0.027 in the
   scale factor, at one frame in the middle of the ramp; start, overshoot peak
   and end agree. Not separable in the render.
2. **`<br>` in `SceneResults`'s headline** became two block `<div>`s. HyperFrames'
   determinism rules ban `<br>` in body text. Identical two-line result.
3. **Transition end pose.** The sampled spring reaches 0.99594, not 1.0, at
   frame 10 — true of Remotion too, but Remotion then *drops* the presentation
   wrapper, snapping the scene to its exact pose. Each entering scene therefore
   carries an explicit `tl.set(stage, {...}, 10/30)` to land exactly.
4. **Film grain.** The same `feTurbulence` data URI is used, but turbulence
   rasterisation is Chrome-build specific; HyperFrames' `chrome-headless-shell`
   and Remotion's bundled Chromium produce slightly different noise.
5. **Looping pulses.** The hook's three dots and the CTA button both come from
   Remotion feeding a modulo'd frame into `interpolate`. Translated to explicit
   repeating GSAP tweens with the identical segment boundaries (dots: 24-frame
   cycle staggered 4 frames; button: 30-frame cycle from frame 44, as a finite
   `repeat: 2` nested timeline bounded by the root `data-duration`).

## Things HyperFrames could not express as-authored

- **`<TransitionSeries>` has no HyperFrames primitive.** It is hand-built:
  overlapping sub-composition clips plus per-scene enter/exit tweens. This is
  the one place where adding or reordering a scene costs more work than in
  Remotion — every neighbour's offsets must be recomputed by hand.
- **The root composition may not hold nested layout.** `lint` rejects
  (`nested_structure_needs_subcomposition`) a timed root-level element with
  children, so the backdrop could not stay inline in `index.html` as
  `<Backdrop />` does under `<AbsoluteFill>`. It is its own full-length
  sub-composition. Visually identical — it is still one element spanning all 386
  frames underneath every scene — but it is a structural difference, not a
  transcription.
- **`data-track-index` does not control z-order** (it is a Studio display lane),
  so Remotion's "later sequence paints on top" had to be restated as explicit
  CSS `z-index` on the hosts.
- **`Interactive.Div`** has no HyperFrames meaning; emitted as plain `<div>`.
- **`delayRender()` / `continueRender()`** around font loading dropped —
  HyperFrames waits on `@font-face` readiness itself.
- **`staticFile()`** paths are root-relative (`assets/fonts/...`) in *both* the
  root and the sub-compositions. The skill's `api-map.md` says to use
  `../assets/...` inside `compositions/`; `lint` rejects that
  (`invalid_parent_traversal_in_asset_path`) because compositions are served
  with the project root as their base URL.
- **Audit escape hatches.** Two things the original does on purpose trip
  HyperFrames' layout audit: the gallery card labels sit behind the scrim and
  the headline, and the metric numbers are `#2ED573` on white (1.84:1). The
  labels carry `data-layout-ignore` and the scrim `data-layout-allow-occlusion`;
  the four contrast findings are left standing as warnings, because changing
  those colours would change the design rather than port it.

## A correction to the skill's own reference

`references/timing.md` maps `Easing.out(Easing.cubic)` to GSAP `power3.out` and
`Easing.out(Easing.poly(N))` to `power<N>.out`. **That is off by one.** GSAP's
names are `power1` = quad, `power2` = cubic, `power3` = quart, `power4` = quint.
Following the table as written made the gallery card rows and the metric
count-ups run visibly ahead of the Remotion baseline; correcting
`Easing.out(Easing.quad)` -> `power1.out` and `Easing.out(Easing.cubic)` ->
`power2.out` moved mean SSIM from **0.931 to 0.967**.

## Verification

- `hyperframes lint`: 0 errors, 0 warnings.
- `hyperframes check`: **passed** — 0 errors in lint, runtime, layout and motion;
  4 contrast *warnings* (the green-on-white metric figures, see above).
- Output: `out/advideo.mp4`, `ffprobe` reports **1080x1920, 30/1 fps, 386
  frames, 12.866667 s**, h264 / yuv420p.
- Frame-accurate SSIM against a Remotion render of the same composition
  (`npx remotion render AdVideo out/ref.mp4 --scale=0.5`), comparing the
  HyperFrames render downscaled to 540x960:

  | | mean SSIM |
  | --- | --- |
  | whole composition (386 frames) | **0.967** |
  | hook | 0.967 |
  | gallery | 0.973 |
  | results | 0.957 |
  | brand | 0.968 |
  | cta | 0.970 |

  Worst single frame 0.937 (frame 216, mid-crossfade). The residual includes the
  2x downscale of the HyperFrames render and the two different Chrome builds, so
  it is an upper bound on translation error, not a measurement of it.

## Re-rendering

```bash
cd /home/user/SchoolBoost/ad-video/hyperframes
HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1 npx --yes hyperframes@0.8.63 browser ensure   # once per machine
HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1 npx --yes hyperframes@0.8.63 check
HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1 npx --yes hyperframes@0.8.63 render --quality looks --output out/advideo.mp4
ffprobe -v error -show_entries stream=width,height,nb_frames,avg_frame_rate -show_entries format=duration out/advideo.mp4
```

Reference render from the untouched Remotion project, for comparison:

```bash
cd /home/user/SchoolBoost/ad-video
export REMOTION_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
npx remotion render AdVideo out/ref.mp4 --scale=0.5
```
