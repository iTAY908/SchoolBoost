# Jack — 3D Creator

A dark-theme portfolio landing page built with React 18, TypeScript, Tailwind CSS,
Framer Motion and Lucide React on Vite.

```bash
npm install
npm run dev           # http://localhost:5173
npm run build         # tsc -b && vite build
npm run preview
npm run build:single  # -> jack-3d-creator.html, one file, opens from disk
```

`build:single` folds the app's CSS and JS into a single HTML file you can open
without a server. It is a build output and is gitignored — regenerate it rather
than committing it.

## Sections

| Order | Section | What it does |
|---|---|---|
| 1 | `HeroSection` | Nav, full-bleed gradient headline, magnetic portrait |
| 2 | `MarqueeSection` | Two image rows that scroll in opposite directions with page scroll |
| 3 | `AboutSection` | Corner 3D props + character-by-character scroll reveal |
| 4 | `ServicesSection` | White panel, five numbered services |
| 5 | `ProjectsSection` | Three sticky cards that stack and scale down |

## Components

- **`FadeIn`** — `whileInView` wrapper; `motion.create()` resolves the element type, memoised so the subtree does not remount.
- **`Magnet`** — cursor-following translate; activates within `padding` px of the element edge, `strength` divides the delta.
- **`AnimatedText`** — per-character opacity `0.2 → 1` driven by `useScroll` (`['start 0.8', 'end 0.2']`). Splits on words first so wrapping stays natural.
- **`ContactButton`** / **`LiveProjectButton`** — the two pill buttons.

## External assets

Every image, GIF and the Kanit webfont are loaded from third-party hosts:

- `fonts.googleapis.com` — Kanit 300–900
- `shrug-person-78902957.figma.site` — portrait and the four 3D corner props
- `motionsites.ai` — 21 marquee GIFs
- `images.higgs.ai` — nine project stills

Nothing is vendored into the repo, so the page needs outbound network access to
those four hosts. Behind a restrictive proxy the layout still renders correctly
but the images and the font fall back.
