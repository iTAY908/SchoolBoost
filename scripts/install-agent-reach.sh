#!/usr/bin/env bash
#
# Install Agent Reach (https://github.com/Panniantong/agent-reach).
#
# Agent Reach is a selector/installer/health-checker that gives an AI agent
# read access to a set of internet channels (web, YouTube, GitHub, RSS, Exa
# search, and optional logged-in platforms). It installs entirely into
# ~/.agent-reach, ~/.agent-reach-venv and ~/.claude/skills — never into this
# repository.
#
# Usage:
#   ./scripts/install-agent-reach.sh                        # core channels
#   ./scripts/install-agent-reach.sh --channels=twitter,reddit
#   ./scripts/install-agent-reach.sh --channels=all
#   ./scripts/install-agent-reach.sh --dry-run              # preview only
#   ./scripts/install-agent-reach.sh --safe                 # no auto system installs
#
# Any flag is passed straight through to `agent-reach install --env=auto`.

set -euo pipefail

readonly REPO_URL="https://github.com/Panniantong/agent-reach.git"
readonly ARCHIVE_URL="https://github.com/Panniantong/agent-reach/archive/main.zip"
readonly VENV="${HOME}/.agent-reach-venv"

log()  { printf '\033[36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[33m warn:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }

# --- locate a usable python -------------------------------------------------

find_python() {
  local candidate
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then
      # Reject the Windows Store alias, which exits 9009 / prints nothing.
      if "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' >/dev/null 2>&1; then
        command -v "$candidate"
        return 0
      fi
    fi
  done
  return 1
}

# --- install the agent-reach package ---------------------------------------

# Preferred path. Falls back to a venv when pipx is absent or the system
# Python is externally managed (PEP 668, common on Homebrew/Debian).
install_with_pipx() {
  command -v pipx >/dev/null 2>&1 || return 1
  log "Installing via pipx"
  pipx install "$ARCHIVE_URL" 2>/dev/null && return 0

  # Direct archive downloads are blocked on some networks; retry from a clone.
  warn "pipx could not fetch the archive, retrying from a git clone"
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN
  git clone --depth 1 "$REPO_URL" "$tmp/agent-reach" >/dev/null 2>&1 || return 1
  pipx install "$tmp/agent-reach"
}

install_with_venv() {
  local python
  python="$(find_python)" || die "Python 3.10+ not found. Install it and re-run."
  log "Installing into a virtualenv at ${VENV} (python: ${python})"

  [ -d "$VENV" ] || "$python" -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --upgrade pip

  if "$VENV/bin/pip" install "$ARCHIVE_URL" 2>/dev/null; then
    return 0
  fi

  # Same fallback as above: some egress policies allow git but block the
  # codeload/archive endpoints with a 403.
  warn "Could not fetch the archive directly, retrying from a git clone"
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN
  git clone --depth 1 "$REPO_URL" "$tmp/agent-reach" \
    || die "Cannot reach GitHub. Check your network/proxy and try again."
  "$VENV/bin/pip" install "$tmp/agent-reach"
}

# --- main -------------------------------------------------------------------

command -v git >/dev/null 2>&1 || die "git is required but not installed."

if install_with_pipx; then
  :
else
  install_with_venv
  export PATH="${VENV}/bin:${PATH}"
fi

command -v agent-reach >/dev/null 2>&1 || die \
  "agent-reach installed but is not on PATH. Run 'pipx ensurepath' (pipx install)
   or add ${VENV}/bin to your PATH (virtualenv install), then re-run."

log "agent-reach $(agent-reach --version 2>/dev/null || echo '(version unknown)')"

log "Running installer"
agent-reach install --env=auto "$@"

# --dry-run makes no changes, so a status report would be misleading.
case " $* " in
  *" --dry-run "*) log "Dry run complete; skipping doctor." ;;
  *) log "Channel status"; agent-reach doctor || true ;;
esac

cat <<EOF

Agent Reach is installed outside this repository:
  package    ${VENV} (or your pipx venv)
  config     ~/.agent-reach/
  agent skill ~/.claude/skills/agent-reach/

If you used the virtualenv path, add it to your shell profile:
  export PATH="${VENV}/bin:\$PATH"

Optional channels (Twitter, Reddit, Xiaohongshu, Facebook, Instagram,
LinkedIn, Xueqiu, Bilibili) need either browser cookies or a desktop Chrome
session, so run those on a machine with a real browser:
  agent-reach install --env=auto --channels=all
  agent-reach doctor
EOF
