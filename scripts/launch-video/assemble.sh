#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
BASE=assets/launch-video
OUT=exports/launch-video
mkdir -p "$OUT"

DEMO="$BASE/demo_2x.mp4"
INTRO="$BASE/cards/intro.png"
OUTRO="$BASE/cards/outro.png"
FINAL="$OUT/lpstudio-product-hunt-launch.mp4"

# demo duration (for end fades)
DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$DEMO")
VFO=$(awk "BEGIN{printf \"%.3f\", $DUR-0.6}")   # video fade-out start
AFO=$(awk "BEGIN{printf \"%.3f\", $DUR-0.6}")   # audio fade-out start

ffmpeg -y -nostdin \
  -loop 1 -t 4 -i "$INTRO" \
  -i "$DEMO" \
  -loop 1 -t 6 -i "$OUTRO" \
  -f lavfi -t 4 -i anullsrc=channel_layout=stereo:sample_rate=48000 \
  -f lavfi -t 6 -i anullsrc=channel_layout=stereo:sample_rate=48000 \
  -filter_complex "\
[0:v]scale=1920:1080,setsar=1,fps=30,format=yuv420p,fade=t=in:st=0:d=0.6,fade=t=out:st=3.4:d=0.6[v0];\
[1:v]scale=1920:1080,setsar=1,fps=30,format=yuv420p,fade=t=in:st=0:d=0.5,fade=t=out:st=${VFO}:d=0.6[v1];\
[2:v]scale=1920:1080,setsar=1,fps=30,format=yuv420p,fade=t=in:st=0:d=0.6,fade=t=out:st=5.4:d=0.6[v2];\
[3:a]aformat=sample_fmts=fltp:channel_layouts=stereo:sample_rates=48000[a0];\
[1:a]afade=t=in:st=0:d=0.3,afade=t=out:st=${AFO}:d=0.6,aformat=sample_fmts=fltp:channel_layouts=stereo:sample_rates=48000[a1];\
[4:a]aformat=sample_fmts=fltp:channel_layouts=stereo:sample_rates=48000[a2];\
[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" \
  -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 160k -ar 48000 -ac 2 \
  -movflags +faststart \
  "$FINAL"

echo "=== final ==="
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height -of default=noprint_wrappers=1 "$FINAL"
