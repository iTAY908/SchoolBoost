---
name: agent-reach-setup
description: State and playbook for this repo's Agent Reach installation (internet-access channels for the agent). Use when the user asks to install, reinstall, verify, extend, debug, or continue work on Agent Reach — including "agent-reach doctor", "add a channel", "why can't you reach X", or Hebrew equivalents (התקן / תמשיך / בדוק את agent reach). Also use when a channel fetch fails with a proxy 403 and you need to know whether that is expected in this environment.
---

# Agent Reach in SchoolBoost

Agent Reach (https://github.com/Panniantong/agent-reach) is a selector/installer/router
for internet-access tools. It is **not** a wrapper — after install you call the upstream
tools directly (`yt-dlp`, `bili`, `rdt`, `twitter`, `mcporter`, `gh`, `curl` + Jina).

## Current state (as of PR #5)

Installed automatically on every remote session by `.claude/hooks/session-start.sh`:

| Thing | Location |
|---|---|
| Package (v1.5.0) | `~/.agent-reach-venv` |
| Config & tokens | `~/.agent-reach/` |
| Channel CLIs | `~/.local/bin` (`bili`, `rdt`, `twitter`) |
| Agent skill | `~/.claude/skills/agent-reach` (installed by `agent-reach install`) |

All of that is **outside the repo**, per Agent Reach's directory rules. Never clone its
repos or write its files into the workspace.

`agent-reach doctor` reports **4/15** channels configured: YouTube, RSS/Atom, Web (Jina),
Bilibili. GitHub / V2EX / Exa show ⚠️. The other 8 are unconfigured.

## The thing that will confuse you: doctor's ✅ is not reachability

This environment's egress proxy allows a small host allowlist and returns **403 on
CONNECT** for everything else. Verified blocked: `github.com`, `codeload.github.com`,
`api.github.com`, `r.jina.ai`, YouTube, V2EX's API, Exa's OAuth endpoint. Verified
allowed: `raw.githubusercontent.com`, `pypi.org`, `registry.npmjs.org`.

So doctor's ✅ marks mean "configured correctly", not "can fetch". A channel can be
green and still fail every request. `Tunnel connection failed: 403 Forbidden` is the
signature.

**Do not try to route around it** — no disabling TLS verification, no unsetting
`HTTPS_PROXY`. Report the blocked host. Unblocking is an environment-level network
policy change the user makes when creating/editing the environment:
https://code.claude.com/docs/en/claude-code-on-the-web

Diagnose with `curl -sS "$HTTPS_PROXY/__agentproxy/status"`; details in
`/root/.ccr/README.md`.

## Why there's a custom installer fallback

The documented install — `pip install https://github.com/Panniantong/agent-reach/archive/main.zip`
— returns **403** here, because github.com is blocked. `add_repo` can't help either:
cross-owner adds are rejected when the session already holds `itay908` repos.

`.claude/hooks/agent_reach_fetch_src.py` is the workaround. It rebuilds the source tree
from `raw.githubusercontent.com` by walking imports out of `agent_reach/__init__.py` and
`agent_reach/cli.py`, then fetches the resources the installer copies out of the wheel
but never imports:

- `agent_reach/skill/SKILL.md`, `SKILL_en.md`
- `agent_reach/skill/references/*.md` (names parsed out of the SKILL files)
- `agent_reach/scripts/transcribe_xiaoyuzhou.sh`

It also creates `__init__.py` in implicit-namespace dirs (`agent_reach/utils/`), which
hatchling needs since it builds regular packages. Yields 44 files.

Two traps if you touch that script:
- A missed resource shows up as a soft warning, not a failure — `⚠️ Script source not
  found in package` was how the transcribe script's absence surfaced.
- Don't fetch with `curl -o`: a 404 writes the error body into the file, and
  `utils/__init__.py` then breaks the import with a `SyntaxError`.

## Commands

```bash
export PATH="$HOME/.agent-reach-venv/bin:$HOME/.local/bin:$PATH"

agent-reach doctor                        # channel status
agent-reach doctor --json                 # machine-readable; active_backend per channel
agent-reach install --env=auto --channels=all
agent-reach install --env=auto --dry-run  # preview
```

Doctor output is `rich`-markup-tagged but printed unrendered when not a TTY; pipe through
`sed -e 's/\[\/\?[a-z ]*\]//g'` to read it.

## The 8 remaining channels

None can be finished by the agent alone.

- **Twitter, 雪球** — need cookies the user exports with the Cookie-Editor Chrome
  extension (Export → Header String), then `agent-reach configure twitter-cookies "..."`.
  Note that command only feeds doctor; running `twitter` needs
  `export TWITTER_AUTH_TOKEN=... TWITTER_CT0=...` in the actual process env.
- **Reddit** — login mandatory, no anonymous path. `rdt login`, or manual cookies on a
  browserless host.
- **小红书** — server path is the `xiaohongshu-mcp` binary + a manually exported cookie.
  Never auto-login or read the user's browser cookies for it.
- **Facebook, Instagram, OpenCLI, 小红书 (desktop)** — require desktop Chrome + the
  OpenCLI extension. The installer skips them on a server environment; they cannot work
  in this container.
- **小宇宙** — needs `apt install -y ffmpeg` plus a free Groq key
  (`agent-reach configure groq-key gsk_...`).
- **LinkedIn** — `linkedin-scraper-mcp` needs a visible browser to log in.

Ask the user for credentials; use a secondary account where cookies are involved.

## Boundaries (from Agent Reach's own install guide)

No `sudo` without explicit approval. No modifying system files outside `~/.agent-reach/`.
No installing packages the guide doesn't list. Never disable firewalls or security
settings. Nothing written into the agent workspace.

## Open work

PR #5 — https://github.com/iTAY908/SchoolBoost/pull/5 — draft, adds the hook. Merge it
into `main` and every future session picks it up. Until then only sessions on branch
`claude/agent-reach-install-893it5` run the hook.

The hook is **synchronous**: the session waits for install (~1–2 min cold) but is
guaranteed the tools exist before the agent runs. Switching to async means emitting
`{"async": true, "asyncTimeout": 300000}` as the script's first line — faster startup,
but the agent may reach for `agent-reach` before it's installed.
