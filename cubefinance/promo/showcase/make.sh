#!/bin/sh
# Rebuild cubefinance-showcase.mp4: frames from scene.html, music from music.js, mix with the voiceover.
set -e
cd "$(dirname "$0")"
TMP=$(mktemp -d)
node render.js frames "$TMP"
node render.js stills stills 1.8 6.8 11.8 18.8 23.2 28.5
node music.js music.wav
./mix.sh
ffmpeg -loglevel error -y -framerate 30 -i "$TMP/%04d.png" -i mix.wav \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart \
  cubefinance-showcase.mp4
rm -rf "$TMP"
echo "done: cubefinance-showcase.mp4"
