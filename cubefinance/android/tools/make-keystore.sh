#!/usr/bin/env bash
# Create the Play upload keystore.
#
# Run this ONCE, on your own machine, and keep the result safe: if you lose it
# you cannot ship an update to the same Play listing ever again. It is not in
# this repository and must never be committed — .gitignore already blocks
# *.jks, *.keystore and keystore.b64.
#
#   bash cubefinance/android/tools/make-keystore.sh
#
# Needs only a JDK (keytool ships with it). No Android SDK required.
set -euo pipefail

OUT="${1:-upload-keystore.jks}"
ALIAS="${KEY_ALIAS:-upload}"

if [ -e "$OUT" ]; then
  echo "Refusing to overwrite an existing keystore at: $OUT" >&2
  echo "If you really mean to replace it, move the old one aside first." >&2
  exit 1
fi

command -v keytool >/dev/null || { echo "keytool not found — install a JDK first." >&2; exit 1; }

echo "Creating $OUT (alias: $ALIAS, RSA 2048, valid ~27 years)."
echo "You will be asked for a password twice, then for your details."
echo

keytool -genkeypair -v \
  -keystore "$OUT" \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 \
  -validity 10000

echo
echo "Done: $OUT"
echo
echo "Now add these four repository secrets on GitHub"
echo "(Settings → Secrets and variables → Actions → New repository secret):"
echo
echo "  KEYSTORE_BASE64    <the line printed below>"
echo "  KEYSTORE_PASSWORD  the password you just chose"
echo "  KEY_ALIAS          $ALIAS"
echo "  KEY_PASSWORD       the key password (same as above unless you changed it)"
echo
echo "KEYSTORE_BASE64 value — copy the whole line:"
echo "-----------------------------------------------------------"
base64 -w0 "$OUT" 2>/dev/null || base64 "$OUT" | tr -d '\n'
echo
echo "-----------------------------------------------------------"
echo
echo "Back up $OUT somewhere durable (password manager / encrypted drive)."
echo "Losing it means losing the ability to update this app on Play."
