#!/bin/sh
# Phone photo → catalogue photo. macOS only (Apple Vision lifts the subject on-device).
#   pnpm studio <photo> <product-slug> [sand|dusk]
# Appends the studio shot (and the untouched original) to src/content/products/<slug>/.
set -e
cd "$(dirname "$0")/../.."
[ $# -ge 2 ] || { echo "usage: pnpm studio <photo> <product-slug> [sand|dusk]"; exit 1; }
PHOTO=$1; SLUG=$2; TONE=${3:-sand}
BIN=scripts/studio/.lift
[ -x $BIN ] || swiftc -O scripts/studio/lift.swift -o $BIN
DIR=src/content/products/$SLUG; mkdir -p "$DIR"
N=$(ls "$DIR"/*.jpg 2>/dev/null | wc -l | tr -d ' '); N=$((N + 1))
TMP=$(mktemp -d)
$BIN "$PHOTO" "$TMP/cut.png" >/dev/null
node scripts/studio/compose.mjs "$TMP/cut.png" "$DIR/$N.jpg" "$TONE" >/dev/null
# the untouched photo, upright, resized, with ALL metadata (GPS!) stripped
sips -s format jpeg "$PHOTO" --out "$TMP/orig.jpg" >/dev/null
node -e 'require("sharp")(process.argv[1]).rotate().resize(1600,1600,{fit:"inside"}).jpeg({quality:86,mozjpeg:true}).toFile(process.argv[2])' "$TMP/orig.jpg" "$DIR/$N-photo.jpg"
rm -rf "$TMP"
echo "✓ $DIR/$N.jpg (studio) + $DIR/$N-photo.jpg (original) — add them to images: in $DIR/index.md"
