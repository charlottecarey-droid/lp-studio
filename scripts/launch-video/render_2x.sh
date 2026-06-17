#!/usr/bin/env bash
set -euo pipefail
cd /home/runner/workspace
IN="attached_assets/Untitled_video_(1)_1781658740343.mp4"
OUT="assets/launch-video/demo_2x.mp4"
mkdir -p assets/launch-video
echo "Rendering 2x base from $IN ..."
ffmpeg -y -i "$IN" \
  -filter_complex "[0:v]setpts=0.5*PTS[v];[0:a]atempo=2.0[a]" \
  -map "[v]" -map "[a]" -r 30 \
  -c:v libx264 -preset veryfast -crf 21 -pix_fmt yuv420p \
  -c:a aac -b:a 160k -movflags +faststart "$OUT"
echo "DONE_2X"
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 "$OUT"
