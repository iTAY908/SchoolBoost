#!/usr/bin/env python3
"""Refuse to let a credential into the repository.

Run over the whole tree:      python3 tools/scan-secrets.py
Run over specific files:      python3 tools/scan-secrets.py FILE [FILE ...]

Exit code 1 means something that looks like a live credential was found.

The rules below are deliberately narrow. A scanner that cries wolf gets
switched off within a week, so it matches provider-issued key shapes and
high-entropy values assigned to secret-ish names -- not every occurrence of
the word "token".
"""
import base64
import math
import os
import re
import subprocess
import sys

# --- what counts as a secret ------------------------------------------------
# Provider-issued keys have distinctive prefixes; these are near-zero false
# positive and worth failing on immediately.
PROVIDER = [
    ("Anthropic API key",   re.compile(r"sk-ant-[A-Za-z0-9_\-]{20,}")),
    ("OpenAI API key",      re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9]{32,}")),
    ("Google API key",      re.compile(r"\bAIza[0-9A-Za-z_\-]{35}")),
    ("GitHub token",        re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}")),
    ("Slack token",         re.compile(r"\bxox[baprs]-[A-Za-z0-9\-]{10,}")),
    ("AWS access key id",   re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("SendGrid key",        re.compile(r"\bSG\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}")),
    ("Composio key",        re.compile(r"\bcomp_[A-Za-z0-9]{20,}")),
    ("Kinovi key",          re.compile(r"\bzimg_[A-Za-z0-9]{16,}")),
    ("Stripe key",          re.compile(r"\b[sr]k_(?:live|test)_[A-Za-z0-9]{20,}")),
    ("Private key block",   re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----")),
    ("JSON Web Token",      re.compile(r"\beyJ[A-Za-z0-9_\-]{15,}\.eyJ[A-Za-z0-9_\-]{15,}\.[A-Za-z0-9_\-]{10,}")),
]

# A long, high-entropy literal assigned to a secret-ish name. This is the rule
# that catches keys we have no prefix for, so it is entropy-gated to stay quiet.
ASSIGNED = re.compile(
    r"""(?ix)
    \b(api[_-]?key|apikey|secret|access[_-]?token|auth[_-]?token|
       client[_-]?secret|private[_-]?key|passwd|password|passphrase|
       keystore[_-]?password|credential)\b
    \s*[:=]\s*
    (?: ["'`]([^"'`\n]{16,})["'`]        # quoted, as in source
      | ([^\s"'`#;]{16,})\s*(?:\#.*)?$  # bare, as in a .env or .properties
    )
    """)

# --- what is allowed --------------------------------------------------------
SKIP_DIRS = {".git", "node_modules", "build", "dist", ".gradle", ".idea",
             "web-build", ".expo", "__pycache__", ".agents", ".claude"}
SKIP_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg", ".pdf",
            ".zip", ".aab", ".apk", ".jks", ".keystore", ".ttf", ".woff",
            ".woff2", ".mp3", ".mp4", ".webm", ".lock"}
SKIP_FILES = {"package-lock.json", "yarn.lock", "skills-lock.json"}

# Values that are obviously not live credentials.
PLACEHOLDER = re.compile(
    r"""(?ix)
    ^( x{4,} | \.{3} | -+ | \s* )$
    | xxxx | placeholder | your[_\-\s]? | example | sample | dummy | changeme
    | \bfake\b | \btest\b | redacted | \bTODO\b | <[^>]+> | \$\{ | \{\{
    | ^ca-app-pub-                       # AdMob ids ship inside every APK
    | ^(?:current|new)-password$         # HTML autocomplete tokens
    | ^[••]+$
    """)

# Google's documented public test ad unit, and the AdMob ids generally.
LITERAL_ALLOW = {
    "ca-app-pub-3940256099942544/1033173712",
    "ca-app-pub-8901066122989701/4541323300",
    "ca-app-pub-8901066122989701~1639827795",
}

def shannon(s):
    if not s:
        return 0.0
    counts = {}
    for ch in s:
        counts[ch] = counts.get(ch, 0) + 1
    n = float(len(s))
    return -sum((c / n) * math.log(c / n, 2) for c in counts.values())

def looks_random(v):
    """High-entropy and not obviously prose or a placeholder."""
    if v in LITERAL_ALLOW or PLACEHOLDER.search(v):
        return False
    if " " in v.strip():          # a sentence, not a key
        return False
    if not re.fullmatch(r"[A-Za-z0-9+/=_\-.:~]{16,}", v):
        return False
    return shannon(v) >= 3.6

def walk(paths):
    for p in paths:
        if os.path.isfile(p):
            yield p
            continue
        for root, dirs, files in os.walk(p):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for f in files:
                if f in SKIP_FILES or os.path.splitext(f)[1].lower() in SKIP_EXT:
                    continue
                yield os.path.join(root, f)

def scan(path):
    hits = []
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            for n, line in enumerate(fh, 1):
                if len(line) > 4000 or "scan-secrets" in line:
                    continue          # minified blob, or this file's own rules
                if "allow-secret" in line:
                    continue          # explicit, reviewed opt-out
                for label, rx in PROVIDER:
                    m = rx.search(line)
                    if m and not PLACEHOLDER.search(m.group(0)):
                        hits.append((n, label, m.group(0)))
                m = ASSIGNED.search(line)
                if m:
                    value = m.group(2) or m.group(3) or ""
                    if looks_random(value):
                        hits.append((n, "high-entropy value assigned to '%s'" % m.group(1), value))
    except (IOError, OSError):
        pass
    return hits

def main():
    args = [a for a in sys.argv[1:] if a != "--staged"]
    if "--staged" in sys.argv[1:]:
        out = subprocess.run(["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
                             capture_output=True, text=True).stdout.split()
        args = [f for f in out if os.path.isfile(f)]
        if not args:
            print("scan-secrets: nothing staged")
            return 0
    paths = args or ["."]

    total = 0
    for path in walk(paths):
        for n, label, value in scan(path):
            shown = value if len(value) <= 12 else value[:6] + "…" + value[-4:]
            print("%s:%d: %s -> %s" % (path, n, label, shown))
            total += 1

    if total:
        print("\n%d possible credential(s) found." % total)
        print("Move the value into an environment variable and keep it out of git.")
        print("If a match is genuinely not a secret, append an 'allow-secret' comment")
        print("to that line. If a real key was ever pushed, ROTATE it -- deleting the")
        print("commit is not enough, the value stays reachable in the history.")
        return 1
    print("scan-secrets: clean")
    return 0

if __name__ == "__main__":
    sys.exit(main())
