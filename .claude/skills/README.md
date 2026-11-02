# Agent skills for CubeFinance

These are **development-time** skills for the coding agent working on this repo —
they shape how the app gets built, tested and shipped. They are not part of the
app's runtime and nothing here is bundled into `cubefinance-web.html` or the
Android build.

Each subdirectory holds a `SKILL.md` that loads automatically when a task matches
its `description`.

## Where they came from

Ported from [affaan-m/ECC](https://github.com/affaan-m/ECC) (MIT, © 2026 Affaan
Mustafa) — see `ATTRIBUTION.md`. ECC ships 285 skills; the 21 below are the ones
that fit this stack. The rest cover frameworks and domains this project does not
use (Django, Spring, Kotlin, Laravel, healthcare EMR, homelab networking, DeFi,
logistics…). Installing all of them would be actively harmful: every skill's
description is loaded into context on every session, so an unfocused set both
burns context and makes the agent pick the wrong skill.

## What this project is

A Hebrew, right-to-left personal-finance app:

- `cubefinance/web/cubefinance-web.html` — the whole app in one self-contained
  file: vanilla JS, inline CSS, no build step, no CDN, works offline
- `cubefinance/android/` — WebView wrapper (Java + Gradle), Play Billing, AdMob
- `cubefinance/app/src/ads/` — React Native / Expo interstitial module
- `cubefinance/backend/` — Node/Express: OTP email verification, rate limiting
- Testing is headless Playwright driving the real page

## The skills

### UI and design
| Skill | Use it for |
|---|---|
| `accessibility` | WCAG 2.2 AA — contrast, focus order, keyboard paths, screen readers. Framework-agnostic, which matters here because the app is hand-written CSS/JS, not React. |
| `make-interfaces-feel-better` | Spacing, typography, borders, shadows — the polish pass on a finance UI that has to read as trustworthy. |
| `design-system` | Auditing visual consistency across screens and reviewing diffs that touch styling. |
| `ui-demo` | Recording UI walkthrough videos with Playwright — useful for the Play Store listing. |

### Testing and verification
| Skill | Use it for |
|---|---|
| `browser-qa` | Driving the live page like a real user after a change, instead of assuming it works. |
| `e2e-testing` | Playwright patterns — page objects, config, artifacts, de-flaking. |
| `click-path-audit` | Tracing every button through its full state change. This repo has already shipped two bugs of exactly that shape (a CTA with `pointer-events` never restored, and a toast covering a sheet's confirm button). |
| `tdd-workflow` | Test-first work, mainly on `cubefinance/backend/`. |
| `verification-loop` | Verifying a session's work before claiming it is done. |
| `production-audit` | Pre-launch readiness checks before a Play Store release. |

### Backend
| Skill | Use it for |
|---|---|
| `api-design` | REST shape of the auth endpoints — status codes, error bodies, versioning. |
| `backend-patterns` | Node/Express structure and server-side practice. |
| `error-handling` | Typed errors, retries, and user-facing failure messages. |

### Mobile
| Skill | Use it for |
|---|---|
| `react-native-patterns` | The Expo ads module. |

### Security
| Skill | Use it for |
|---|---|
| `security-review` | Auth, secrets, user input, payment flows — i.e. the OTP flow, Play Billing verification, and the escaping rules that keep user-supplied cube names out of `innerHTML`. |

### Process
| Skill | Use it for |
|---|---|
| `coding-standards` | Baseline naming and readability conventions. |
| `git-workflow` | Branching, commit messages, rebase vs merge. |
| `architecture-decision-records` | Recording why a decision was made, not just what changed. |
| `codebase-onboarding` | Getting a fresh session oriented in this repo. |
| `deployment-patterns` | CI/CD and release flow, including the Android release workflow. |
| `product-lens` | Pressure-testing the "why" before a request becomes an implementation. |

## Deliberately not installed

- `security-scan`, `repo-scan`, `plankton-code-quality` — require installing
  external tooling over the network at run time.
- `delivery-gate` — installs a Stop hook that changes agent behaviour; that is a
  harness configuration decision, not a skill drop-in.
- `documentation-lookup` — depends on the Context7 MCP server, which is not
  connected here.
- `frontend-patterns`, `frontend-a11y`, `motion-foundations`, `motion-patterns`,
  `motion-ui` — written specifically for React / Next.js / `motion/react`. This
  app is vanilla JS with hand-written CSS animations, so their triggers would
  either never fire or fire with advice that does not apply.

Any of these can be added on request.

## Adding more

Copy the directory from ECC and keep the layout — `<skill-name>/SKILL.md` with
`name:` matching the directory:

```bash
cp -r /path/to/ecc/skills/<name> .claude/skills/
```
