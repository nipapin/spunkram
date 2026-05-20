#!/usr/bin/env bash
# Проверка resources/plugins перед релизом.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAC="$ROOT/resources/plugins/mac"
WIN="$ROOT/resources/plugins/win"
ERR=0

check_file() {
  if [[ -e "$1" ]]; then
    echo "OK: $2"
  else
    echo "FAIL: missing $2"
    ERR=1
  fi
}

echo "=== Mac CSBridge bundles ==="
for b in MotionflowBridge.bundle MotionflowInit.bundle; do
  check_file "$MAC/$b" "$b"
  if [[ -d "$MAC/$b" ]]; then
    codesign --verify --deep --strict "$MAC/$b" 2>/dev/null && echo "  signature: valid" || {
      echo "  signature: INVALID"
      ERR=1
    }
  fi
done

if [[ -f "$MAC/cep-helpers.zip" ]]; then
  echo "WARN: cep-helpers.zip is obsolete — remove it"
  ERR=1
fi

echo ""
echo "=== Windows CSBridge files ==="
for f in MotionflowBridge.acsrf MotionflowInit.prm Motionflow.dll; do
  check_file "$WIN/$f" "$f"
done

echo ""
if [[ "$ERR" -eq 0 ]]; then
  echo "All plugin checks passed."
else
  echo "Plugin checks failed."
  exit 1
fi
