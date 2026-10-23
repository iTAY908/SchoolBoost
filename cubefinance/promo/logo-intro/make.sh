#!/bin/sh
# Rebuild both videos:
#   cubefinance-logo-intro.mp4  5 s  logo only            (scene.html + music.js)
#   cubefinance-ad-10s.mp4      10 s AI demo, then logo   (ai-scene.html + ai-music.js, then the above)
# Needs node + playwright (PW/CHROME env vars can point at a local install) and ffmpeg.
set -e
cd "$(dirname "$0")"
TMP=$(mktemp -d)
ENC="-c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart"
node render.js "$TMP/ad" . ai-scene.html 0       # frames 0000-0149 (+ writes type-times.json)
node render.js "$TMP/ad" . scene.html 150        # frames 0150-0299
node music.js music.wav
node ai-music.js ai-music.wav
ffmpeg -loglevel error -y -i ai-music.wav -i music.wav -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[a]" -map "[a]" ad-music.wav
ffmpeg -loglevel error -y -framerate 30 -i "$TMP/ad/%04d.png" -i ad-music.wav $ENC cubefinance-ad-10s.mp4
ffmpeg -loglevel error -y -framerate 30 -start_number 150 -i "$TMP/ad/%04d.png" -i music.wav $ENC cubefinance-logo-intro.mp4
rm -rf "$TMP"
echo "done: cubefinance-ad-10s.mp4, cubefinance-logo-intro.mp4"
