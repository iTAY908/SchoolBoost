#!/bin/sh
# Places each voiceover sentence on its scene, ducks the music under the voice, and normalizes.
# Sentence boundaries in voiceover.mp3 (found with silencedetect) → start time in the film:
#   0.00-2.75  "הכסף שלכם. בשליטה שלכם."                  → 0.6 s
#   2.90-7.75  "עם קיוב פיננס רואים את התמונה המלאה..."    → 4.3 s
#   7.80-11.10 "מתכננים חיסכון, ורואים איך מתקרבים למטרה." → 9.4 s
#   11.10-15.85 "ויש גם את קיובי — עוזר AI..."               → 14.8 s
#   15.85-19.30 "הכול באפליקציה אחת. עושים סדר בכסף."      → 21.6 s
#   19.30-end  "קיוב פיננס. זמינה עכשיו בגוגל פליי."        → 26.2 s
set -e
cd "$(dirname "$0")"
ffmpeg -loglevel error -y -i voiceover.mp3 -i music.wav -filter_complex "\
[0:a]aresample=44100,pan=stereo|c0=c0|c1=c0,asplit=6[a][b][c][d][e][f];\
[a]atrim=0:2.75,asetpts=PTS-STARTPTS,adelay=600|600[A];\
[b]atrim=2.9:7.75,asetpts=PTS-STARTPTS,adelay=4300|4300[B];\
[c]atrim=7.8:11.1,asetpts=PTS-STARTPTS,adelay=9400|9400[C];\
[d]atrim=11.1:15.85,asetpts=PTS-STARTPTS,adelay=14800|14800[D];\
[e]atrim=15.85:19.3,asetpts=PTS-STARTPTS,adelay=21600|21600[E];\
[f]atrim=19.3,asetpts=PTS-STARTPTS,adelay=26200|26200[F];\
[A][B][C][D][E][F]amix=inputs=6:normalize=0,apad=whole_dur=30,atrim=0:30,volume=1.6,asplit=2[vo][key];\
[1:a]volume=0.55[mus];\
[mus][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[duck];\
[duck][vo]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[out]" \
-map "[out]" -c:a pcm_s16le mix.wav
echo "done: mix.wav"
