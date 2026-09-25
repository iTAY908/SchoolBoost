# tools

## `scan-secrets.py`

Refuses to let a credential into the repository. No dependencies, no network.

```bash
python3 tools/scan-secrets.py              # whole tree
python3 tools/scan-secrets.py path/to/file # specific files
python3 tools/scan-secrets.py --staged     # what is staged for commit
```

It matches provider-issued key shapes (Anthropic, OpenAI, Google, GitHub,
Slack, AWS, Stripe, SendGrid, Composio, Kinovi), PEM private-key blocks, JWTs,
and high-entropy values assigned to a secret-ish name — both quoted, as in
source, and bare, as in a `.env`.

The rules are deliberately narrow. A scanner that cries wolf gets switched off
within a week, so prose containing the word "token", AdMob unit ids (which ship
inside every published APK and are not secrets), HTML `autocomplete` values and
`.env.example` placeholders are all ignored by design.

If a match is genuinely not a secret, put an `allow-secret` comment on that
line. Prefer fixing the code.

### Install the pre-commit hook

```bash
ln -sf ../../tools/pre-commit .git/hooks/pre-commit
```

Hooks are not versioned by git, so each clone installs its own. CI runs the
same script (`.github/workflows/secret-scan.yml`) over both the working tree
and the commits a push or pull request adds, which is the check that actually
gates the repository — the hook is just the faster feedback.

### If a real key was ever pushed

**Rotate it.** Rewriting history is not enough on its own: the old objects stay
reachable through the reflog, through forks, and through anything that already
cloned or cached the repository. Revoke the key at the provider, issue a new
one, and keep the new one in an environment variable.
