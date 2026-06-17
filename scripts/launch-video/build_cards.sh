#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
BASE=assets/launch-video
F=$BASE/fonts
OUT=$BASE/cards
mkdir -p "$OUT"

CREAM="#F6F2E9"
INK="#1A1815"
MUTED="#6B655C"
INDIGO="#4B47E5"
INDIGO_L="#6A66F0"
CORAL="#E26B4F"
PH="#DA552F"

DMB="$F/DMSans-Bold.ttf"
DMM="$F/DMSans-Medium.ttf"
INTR="$F/Inter-Regular.ttf"
INTS="$F/Inter-SemiBold.ttf"

# ---- brand mark (rounded indigo square + white "LP" + coral dot) ----
convert -size 220x220 xc:none \
  -fill "$INDIGO" -draw "roundrectangle 0,0,219,219,58,58" \
  -font "$DMB" -pointsize 120 -fill white -gravity center -annotate +0-8 "LP" \
  -fill "$CORAL" -draw "circle 165,165 165,181" \
  "$OUT/mark.png"
convert "$OUT/mark.png" -resize 132x132 "$OUT/mark_small.png"

# ---- wordmark: "LP" bold + "STUDIO" medium (tracked) ----
convert -background none -fill "$INK" -font "$DMB" -pointsize 104 label:"LP" /tmp/lp.png
convert -background none -fill "$INK" -font "$DMM" -pointsize 104 -kerning 16 label:"STUDIO" /tmp/studio.png
convert /tmp/lp.png -background none -gravity east -splice 44x0 /tmp/studio.png +append -background none "$OUT/wordmark.png"
convert "$OUT/wordmark.png" -trim +repage "$OUT/wordmark.png"

# small accent line
convert -size 90x5 xc:"$INDIGO" "$OUT/accent.png"

# ================= INTRO =================
convert -size 1920x1080 xc:"$CREAM" "$OUT/intro_base.png"
convert "$OUT/intro_base.png" \
  "$OUT/mark.png" -gravity center -geometry +0-210 -composite \
  "$OUT/wordmark.png" -gravity center -geometry +0-10 -composite \
  -font "$INTR" -pointsize 44 -fill "$MUTED" -gravity center \
    -annotate +0+95 "Skip the brief. Ship the page." \
  "$OUT/accent.png" -gravity center -geometry +0+165 -composite \
  "$OUT/intro.png"

# ================= OUTRO =================
# product hunt pill button
PW=860; PH_H=120
convert -size ${PW}x${PH_H} xc:none -fill "$PH" -draw "roundrectangle 0,0,$((PW-1)),$((PH_H-1)),60,60" \
  -font "$DMB" -pointsize 42 -fill white -gravity center -kerning 3 -annotate +0+0 "UPVOTE ON PRODUCT HUNT" \
  "$OUT/pill.png"

convert -size 1920x1080 xc:"$CREAM" "$OUT/outro_base.png"
convert "$OUT/outro_base.png" \
  "$OUT/mark_small.png" -gravity center -geometry +0-300 -composite \
  -font "$DMB" -pointsize 92 -fill "$INK" -gravity center \
    -annotate +0-120 "We’re live on Product Hunt" \
  -font "$INTR" -pointsize 42 -fill "$MUTED" -gravity center \
    -annotate +0-20 "Help us reach the top — your upvote means everything." \
  "$OUT/pill.png" -gravity center -geometry +0+150 -composite \
  -font "$INTS" -pointsize 30 -fill "$PH" -gravity center -kerning 1 \
    -annotate +0+255 "producthunt.com" \
  "$OUT/outro.png"

echo "cards built:"
identify "$OUT/intro.png" "$OUT/outro.png"
