#!/bin/sh
# Hand-held BOX photo → catalogue photo. Straightens the box (Apple Vision finds it, or you give the corners),
# drops the hand and background, then places it on a colour-matched backdrop with a floor reflection.
#   pnpm studio:box <photo> <product-slug> <light> <deep> [TL TR BR BL]
#   e.g. pnpm studio:box ~/Downloads/box.jpg amorous-oud "#F6E8DE" "#A8735A"
#        pnpm studio:box ~/Downloads/box.jpg arco-arabian-oud "#FFF0DC" "#E8964A" 263,172 656,173 657,1130 252,1128
# Corners are pixels from the photo's top-left (open it in Preview, Tools → Show Inspector shows positions).
set -e
cd "$(dirname "$0")/../.."
[ $# -ge 4 ] || { sed -n 2,8p "$0"; exit 1; }
PHOTO=$1; SLUG=$2; LIGHT=$3; DEEP=$4; shift 4
BIN=scripts/studio/.box
[ -x $BIN ] || swiftc -O scripts/studio/box.swift -o $BIN
DIR=src/content/products/$SLUG; mkdir -p "$DIR"
N=$(ls "$DIR"/[0-9].jpg "$DIR"/[0-9][0-9].jpg 2>/dev/null | wc -l | tr -d ' '); N=$((N + 1))
TMP=$(mktemp -d)
$BIN "$PHOTO" "$TMP/box.png" 6 "$@"
CUT=""; [ -f "$DIR/cutout.webp" ] || CUT="$DIR/cutout.webp"
node scripts/studio/compose.mjs "$TMP/box.png" "$DIR/$N.jpg" "$LIGHT" "$DEEP" reflect 0 $CUT >/dev/null
sips -s format jpeg "$PHOTO" --out "$TMP/orig.jpg" >/dev/null
node -e 'require("sharp")(process.argv[1]).rotate().resize(1600,1600,{fit:"inside"}).normalise({lower:1,upper:99}).modulate({saturation:1.1,brightness:1.02}).sharpen({sigma:0.7}).jpeg({quality:86,mozjpeg:true}).toFile(process.argv[2])' "$TMP/orig.jpg" "$DIR/$N-photo.jpg"
rm -rf "$TMP"
echo "✓ $DIR/$N.jpg (studio) + $N-photo.jpg (original, enhanced)${CUT:+ + cutout.webp}"
echo "  images: add ./$N.jpg and ./$N-photo.jpg · tint: \"$DEEP\""
