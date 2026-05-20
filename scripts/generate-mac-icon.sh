#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/resources/icon.png"
ICONSET="$ROOT/build/icon.iconset"
OUT="$ROOT/build/icon.icns"

if [[ "$(uname)" != Darwin ]]; then
  echo "generate-mac-icon.sh: skipped (macOS only)"
  exit 0
fi

if [[ ! -f "$SRC" ]]; then
  echo "Missing $SRC"
  exit 1
fi

mkdir -p "$ROOT/build"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"

for size in 16 32 128 256 512; do
  s2=$((size * 2))
  sips -z "$size" "$size" "$SRC" --out "${ICONSET}/icon_${size}x${size}.png" >/dev/null
  sips -z "$s2" "$s2" "$SRC" --out "${ICONSET}/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "$ICONSET" -o "$OUT"
rm -rf "$ICONSET"
echo "macOS icon written: $OUT"
