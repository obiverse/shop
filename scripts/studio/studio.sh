#!/bin/sh
# Phone photo → catalogue photo. macOS only (Apple Vision lifts the subject on-device).
#   pnpm studio <photo> <product-slug> [light=#FFE6CC] [deep=#FFAE6B] [floor|reflect] [tilt°]
#   e.g. pnpm studio ~/Downloads/IMG_1234.HEIC classic-slide "#FFE6CC" "#FFAE6B" floor -6
#        pnpm studio ~/Downloads/box.jpg oud-noir "#F1F2F6" "#A9AEBB" reflect
# Writes the next N.jpg (studio), N-photo.jpg (enhanced original, GPS stripped) and cutout.webp
# into src/content/products/<slug>/. Add them to images:, and set tint: to the deep colour.
set -e
cd "$(dirname "$0")/../.."
[ $# -ge 2 ] || { sed -n 2,6p "$0"; exit 1; }
PHOTO=$1; SLUG=$2; LIGHT=${3:-#FFE6CC}; DEEP=${4:-#FFAE6B}; STYLE=${5:-floor}; TILT=${6:-0}
BIN=scripts/studio/.lift
[ -x $BIN ] || swiftc -O scripts/studio/lift.swift -o $BIN
DIR=src/content/products/$SLUG; mkdir -p "$DIR"
N=$(ls "$DIR"/[0-9].jpg "$DIR"/[0-9][0-9].jpg 2>/dev/null | wc -l | tr -d ' '); N=$((N + 1))
TMP=$(mktemp -d)
$BIN "$PHOTO" "$TMP/cut.png" >/dev/null
CUT=""; [ -f "$DIR/cutout.webp" ] || CUT="$DIR/cutout.webp"
node scripts/studio/compose.mjs "$TMP/cut.png" "$DIR/$N.jpg" "$LIGHT" "$DEEP" "$STYLE" "$TILT" $CUT >/dev/null
sips -s format jpeg "$PHOTO" --out "$TMP/orig.jpg" >/dev/null
node -e 'require("sharp")(process.argv[1]).rotate().resize(1600,1600,{fit:"inside"}).normalise({lower:1,upper:99}).modulate({saturation:1.1,brightness:1.02}).sharpen({sigma:0.7}).jpeg({quality:86,mozjpeg:true}).toFile(process.argv[2])' "$TMP/orig.jpg" "$DIR/$N-photo.jpg"
rm -rf "$TMP"
echo "✓ $DIR/$N.jpg (studio) + $N-photo.jpg (original, enhanced)${CUT:+ + cutout.webp}"
echo "  images: add ./$N.jpg and ./$N-photo.jpg · tint: \"$DEEP\""
