# CubeFinance 🧊💰

> A dynamic mobile financial-planning app that divides your money into visual **Cubes** (budget categories) using a guided onboarding questionnaire and an AI financial buddy.

**No bank connections. Ever.** Every number in CubeFinance is either simulated or manually entered by the user. The AI and budgeting logic operate purely on self-reported data.

---

## 1. Architecture Overview

CubeFinance is a monorepo with two deployables:

```
cubefinance/
├── app/        → React Native (Expo) mobile client
└── backend/    → Node.js (Express) API + AI service
```

### High-level flow

```
┌──────────────────────────────────────────────────────────────┐
│                      MOBILE APP (Expo)                         │
│                                                                │
│  Worker 1              Worker 2            Worker 4            │
│  Onboarding    ──►     Dashboard    ◄──►   Floating AI Buddy   │
│  (multi-step)          (Cubes UI)          (FAB + chat)        │
│      │                     ▲                     │             │
│      └──────────┬──────────┴──────────┬─────────┘             │
│                 ▼                      ▼                       │
│         Worker 5: Global Store (Zustand) + API client         │
│   profile · cubes · mainAccount · chat · realtime selectors   │
└─────────────────────────────┬────────────────────────────────┘
                              │ REST + SSE streaming
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                  BACKEND (Node + Express)  — Worker 3 & 4      │
│                                                                │
│  /api/budget/calculate   → budgetEngine (deterministic math)  │
│  /api/budget/transfer    → transfer simulation                │
│  /api/chat (SSE stream)  → AI buddy, context-aware            │
│  /api/state (GET/PUT)    → full snapshot sync (cross-device)  │
│                                                                │
│  services/aiClient.js  → Anthropic SDK (claude-sonnet-5)      │
│                          graceful offline/rule-based fallback  │
└──────────────────────────────────────────────────────────────┘
```

### Design principles

1. **Single source of truth** — the Zustand store (Worker 5) holds the profile, the cubes, the main-account pool and chat history. Every screen subscribes to it, so a mutation from the chatbot instantly re-renders the dashboard.
2. **Deterministic core, AI narration** — the budget split is pure, testable math (`budgetEngine.js`). The AI layer *explains* and *advises* on top of that math; it never silently invents allocations. The app is fully functional even with **no API key** (rule-based fallbacks everywhere).
3. **Simulated money movement** — the "main account" is a pool. Transferring distributes the pool into cube balances by each cube's percentage, with a triggerable animation on the client.
4. **Context-aware assistant** — every chat request ships the current profile + cube snapshot to the backend, so answers like *"Can I afford 500 ILS?"* are grounded in live balances.

### Worker map

| Worker | Area | Key files |
|---|---|---|
| **1 — Onboarding FE** | Multi-step questionnaire, conditional rent steps | `app/src/screens/onboarding/**` |
| **2 — Dashboard & Cubes UI** | Cube cards/rings, transfer animation | `app/src/screens/DashboardScreen.tsx`, `app/src/components/cubes/**` |
| **3 — Backend & Core AI Logic** | Budget math, transfer sim, API | `backend/src/logic/**`, `backend/src/routes/**` |
| **4 — Floating AI Buddy** | FAB chatbot + streaming | `app/src/components/chat/**`, `backend/src/routes/chat.js` |
| **5 — State & Integration** | Zustand store, API client, glue | `app/src/state/**`, `app/src/api/**` |

---

## 2. Running the project

### Backend
```bash
cd backend
cp .env.example .env        # add ANTHROPIC_API_KEY (optional — falls back to rules)
npm install
npm run dev                 # http://localhost:4000
```

### App
```bash
cd app
npm install
# point the app at your machine's LAN IP so a phone can reach it:
export EXPO_PUBLIC_API_URL=http://<your-lan-ip>:4000
npx expo start
```

If you run the backend on the same machine as the simulator, the default
`http://localhost:4000` works out of the box.

### Web preview + backend sync

The single-file web preview (`web/index.html`) runs fully client-side by
default (localStorage only). To connect it to the backend for cross-device
persistence, open it with query params:

```
web/index.html?api=http://<backend-host>:4000&uid=<your-account-id>
```

- `api` — backend base URL (remembered in localStorage).
- `uid` — a shared account id; open the page with the same `uid` on another
  device/browser to load the same data.

State is reconciled last-write-wins: on load it pulls the cloud snapshot and
adopts it if newer, otherwise pushes the local one up. With no backend
reachable it silently stays local — the status chip shows `☁️ מסונכרן` vs
`📴 מקומי`. The React Native app syncs automatically via the same
`/api/state` endpoint (a per-install `uid`, persisted with AsyncStorage).

---

## 3. The budgeting model (summary)

Given monthly income `I` and a living situation:

- **Independent**: a real **Housing** cube is created from `rent + arnona + utilities + houseCommittee`. The remainder of income is split across Essentials, Savings, Investments, Emergency and Lifestyle.
- **With parents**: no Housing cube — the money that *would* have been housing is redistributed into **Savings, Investments and Lifestyle**.
- **Age tilt**: younger users get a higher Investment share (more time horizon), older users a higher Savings/Emergency share.

Full math, worked against the 10,000 ILS example, lives in
[`docs/BUDGET_LOGIC.md`](docs/BUDGET_LOGIC.md) and is implemented in
`backend/src/logic/budgetEngine.js`.
