# scripts

Developer tooling for this repo. Nothing here is needed to view `index.html` —
these are setup helpers.

## `install-agent-reach.sh`

Installs [Agent Reach](https://github.com/Panniantong/agent-reach), which gives
an AI agent read access to a set of internet channels (web pages via Jina
Reader, YouTube, GitHub, RSS, Exa semantic search, and optional logged-in
platforms such as Twitter, Reddit and Xiaohongshu).

```bash
./scripts/install-agent-reach.sh                          # core channels
./scripts/install-agent-reach.sh --dry-run                # preview
./scripts/install-agent-reach.sh --channels=twitter,reddit
./scripts/install-agent-reach.sh --channels=all
```

Everything lands outside the repository, per Agent Reach's own directory rules:

| What | Where |
|---|---|
| Package | `~/.agent-reach-venv/` (or your pipx venv) |
| Config and tokens | `~/.agent-reach/` |
| Agent skill | `~/.claude/skills/agent-reach/` |

### Requirements

- Python 3.10+ and `git`
- Node.js (the installer adds `mcporter` and the Exa search backend)
- The installer will install the `gh` CLI if it is missing

The script prefers `pipx`, falls back to a virtualenv at `~/.agent-reach-venv`,
and falls back again from the release archive to a `git clone` — some networks
allow git traffic but return 403 on GitHub's archive/codeload endpoints.

### Where to run it

Run this on a workstation with a real browser and unrestricted network.

It does **not** work usefully inside a sandboxed CI or cloud agent container.
Verified on the Claude Code web container for this repo: the package installs
fine, but the egress policy returns `403 Forbidden` at the CONNECT stage for
every channel host — `r.jina.ai`, `youtube.com`, `x.com`, `reddit.com`,
`v2ex.com` and `api.github.com` — so no channel can actually fetch, and the
container's filesystem is discarded when the session ends.

Note that `agent-reach doctor` reports several of these channels as available.
That check is configuration-only; it does not make a live request, so a green
tick there is not proof of connectivity.

### Optional channels and credentials

Channels beyond the core set need credentials only you can supply, and most
expect a logged-in desktop Chrome:

- **Twitter, Xueqiu** — cookies exported with the Cookie-Editor extension
- **Reddit, Facebook, Instagram, Xiaohongshu** — an existing Chrome session via
  the OpenCLI extension, or manually exported cookies
- **Xiaoyuzhou podcasts** — a free Groq API key (`agent-reach configure groq-key gsk_...`)

Prefer a secondary account for anything cookie-based. Cookies grant full
account access, and platforms may restrict accounts that make non-browser API
calls. Do not commit credentials to this repo — Agent Reach keeps them in
`~/.agent-reach/`.
