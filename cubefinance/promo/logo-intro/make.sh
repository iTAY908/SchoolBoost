#!/bin/sh
# Rebuild the logo intro: frames from scene.html, music from music.js, then mux.
# Needs node + playwright (PW/CHROME env vars can point at a local install) and ffmpeg.
set -e
cd "$(dirname "$0")"
TMP=$(mktemp -d)
node render.js "$TMP/frames" .
node music.js music.wav
ffmpeg -loglevel error -y -framerate 30 -i "$TMP/frames/%04d.png" -i music.wav \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart \
  cubefinance-logo-intro.mp4
rm -rf "$TMP"
echo "done: cubefinance-logo-intro.mp4"
