#!/usr/bin/env bash
# Проверка подписи / entitlements / staple после сборки на Mac.
# Использование: ./scripts/verify-mac-app.sh "dist/mac-universal/Gal Toolkit MAX Manager.app"

set -euo pipefail

APP="${1:-}"
if [[ -z "$APP" || ! -d "$APP" ]]; then
  echo "Usage: $0 \"path/to/Gal Toolkit MAX Manager.app\"" >&2
  exit 1
fi

BIN="$APP/Contents/MacOS/Gal Toolkit MAX Manager"

echo "=== 1. codesign verify ==="
codesign --verify --deep --strict --verbose=2 "$APP"

echo ""
echo "=== 2. signing identity ==="
codesign -dv "$APP" 2>&1 | grep -E "Identifier=|Authority=|TeamIdentifier=|Signature=" || true

echo ""
echo "=== 3. entitlements (нужен allow-jit для Electron) ==="
if codesign -d --entitlements - "$APP" 2>/dev/null | grep -q "allow-jit"; then
  echo "OK: com.apple.security.cs.allow-jit present"
else
  echo "FAIL: allow-jit missing — app will not launch with hardened runtime" >&2
  exit 1
fi

echo ""
echo "=== 4. Gatekeeper ==="
spctl -a -vv "$APP" || true

echo ""
echo "=== 5. notarization staple ==="
if xcrun stapler validate "$APP" 2>/dev/null; then
  echo "OK: staple valid"
else
  echo "WARN: no staple on .app (нужно notarize + staple перед раздачей DMG)"
fi

echo ""
echo "=== 6. launch test (5s) ==="
"$BIN" &
PID=$!
sleep 5
if kill -0 "$PID" 2>/dev/null; then
  echo "OK: process still running (pid $PID)"
  kill "$PID" 2>/dev/null || true
else
  echo "FAIL: process exited immediately — смотрите Console.app / crash reports" >&2
  exit 1
fi

echo ""
echo "All checks passed."
