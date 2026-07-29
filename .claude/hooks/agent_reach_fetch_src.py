#!/usr/bin/env python3
"""Reconstruct the agent-reach source tree from raw.githubusercontent.com.

Fallback for environments whose egress policy allows raw.githubusercontent.com
but blocks github.com / codeload.github.com / api.github.com, which makes the
documented `pip install .../archive/main.zip` install fail with HTTP 403.

Walks the package by following imports from the entry modules, then pulls the
non-Python resources the installer needs (skill markdown, transcribe script).

Usage: agent_reach_fetch_src.py <output-dir>
"""

import os
import re
import sys
import urllib.request

BASE = "https://raw.githubusercontent.com/Panniantong/agent-reach/main/"
PKG = "agent_reach"

ENTRY_MODULES = [f"{PKG}/__init__.py", f"{PKG}/cli.py"]
EXTRA_FILES = [
    "pyproject.toml",
    "README.md",
    f"{PKG}/skill/SKILL.md",
    f"{PKG}/skill/SKILL_en.md",
    f"{PKG}/scripts/transcribe_xiaoyuzhou.sh",
]

IMPORT_RE = re.compile(
    r"^\s*(?:from\s+(\.+|agent_reach\.?)([A-Za-z0-9_.]*)\s+import\s+(.+)"
    r"|import\s+agent_reach\.([A-Za-z0-9_.]+))",
    re.M,
)


class Fetcher:
    def __init__(self, out):
        self.out = out
        self.got = set()
        self.missing = set()

    def get(self, relpath):
        if relpath in self.got or relpath in self.missing:
            return None
        try:
            with urllib.request.urlopen(BASE + relpath, timeout=30) as r:
                data = r.read()
        except Exception:
            self.missing.add(relpath)
            return None
        dest = os.path.join(self.out, relpath)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as f:
            f.write(data)
        self.got.add(relpath)
        return data


def referenced_modules(relpath, text):
    """Dotted module names (relative to the package) imported by this file."""
    pkgdir = os.path.dirname(relpath)[len(PKG) :].strip("/")
    parts = [p for p in pkgdir.split("/") if p]
    out = []
    for m in IMPORT_RE.finditer(text):
        dots, mod, names, absmod = m.groups()
        if absmod:
            out.append(absmod)
            continue
        if dots is None:
            continue
        if dots.startswith("."):
            up = len(dots) - 1
            base = parts[: len(parts) - up] if up else parts
            prefix = ".".join(base)
        else:  # "agent_reach" / "agent_reach."
            prefix = ""
        full = ".".join(x for x in (prefix, mod) if x)
        if full:
            out.append(full)
        # `from .pkg import submodule` — the imported name may itself be a module
        for name in re.split(r"[,\s()]+", names or ""):
            if re.fullmatch(r"[a-z_][a-z0-9_]*", name or ""):
                out.append(".".join(x for x in (full, name) if x))
    return out


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "agent-reach-src"
    f = Fetcher(out)

    queue = list(ENTRY_MODULES)
    done = set()
    while queue:
        rel = queue.pop(0)
        if rel in done:
            continue
        done.add(rel)
        data = f.get(rel)
        if data is None:
            continue
        for mod in referenced_modules(rel, data.decode("utf-8", "replace")):
            path = mod.replace(".", "/")
            for cand in (f"{PKG}/{path}.py", f"{PKG}/{path}/__init__.py"):
                if cand not in done:
                    queue.append(cand)

    for rel in EXTRA_FILES:
        f.get(rel)

    # references/*.md are named only inside the skill markdown
    refs = set()
    for name in ("SKILL.md", "SKILL_en.md"):
        p = os.path.join(out, PKG, "skill", name)
        if os.path.isfile(p):
            with open(p, encoding="utf-8", errors="replace") as fh:
                refs.update(re.findall(r"references/([A-Za-z0-9_.-]+\.md)", fh.read()))
    for ref in sorted(refs):
        f.get(f"{PKG}/skill/references/{ref}")

    # Package dirs without an __init__.py upstream (implicit namespace packages)
    # still need one here, since hatchling builds a regular package.
    for root, _dirs, files in os.walk(os.path.join(out, PKG)):
        if any(x.endswith(".py") for x in files) and "__init__.py" not in files:
            open(os.path.join(root, "__init__.py"), "w").close()

    if not os.path.isfile(os.path.join(out, "pyproject.toml")):
        print("error: could not fetch pyproject.toml", file=sys.stderr)
        return 1
    print(f"reconstructed {len(f.got)} files into {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
