#!/usr/bin/env bash
# Full compile checklist for ESP32 Display Studio (web + Rust + optional Linux bundles).
# Usage:
#   ./scripts/full-compile.sh              # lint/tests/build + cargo check
#   ./scripts/full-compile.sh --release    # also cargo build --release
#   ./scripts/full-compile.sh --linux-bundle   # also tauri Linux AppImage/deb (slow)
#   ./scripts/full-compile.sh --release --linux-bundle
#
# Windows NSIS/MSI and macOS dmg/notarize are NOT run here — use a Windows/macOS
# host or the release CI workflows (see docs/developer-setup.md).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DO_RELEASE=0
DO_LINUX_BUNDLE=0
for arg in "$@"; do
  case "$arg" in
    --release) DO_RELEASE=1 ;;
    --linux-bundle) DO_LINUX_BUNDLE=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg (try --help)" >&2
      exit 2
      ;;
  esac
done

echo "==> [1/3] npm run smoke (lint + unit tests + board-catalog + vite production build)"
npm run smoke

echo "==> [2/3] cargo check (src-tauri)"
(cd src-tauri && cargo check)

if [[ "$DO_RELEASE" -eq 1 ]]; then
  echo "==> [extra] cargo build --release (src-tauri)"
  (cd src-tauri && cargo build --release)
fi

if [[ "$DO_LINUX_BUNDLE" -eq 1 ]]; then
  if [[ "$(uname -s)" != "Linux" ]]; then
    echo "Skipping --linux-bundle: host is $(uname -s), not Linux." >&2
  else
    echo "==> [3/3] tauri Linux bundles (AppImage + deb)"
    npm run tauri:build -- --config src-tauri/tauri.linux.json
  fi
else
  echo "==> [3/3] skip Linux bundles (pass --linux-bundle to build AppImage/deb)"
fi

echo
echo "Full compile OK."
echo "Not covered on this script (by design):"
echo "  - Windows NSIS/MSI  → Windows host or .github/workflows/desktop-release.yml"
echo "  - macOS dmg/notarize → macOS host or .github/workflows/desktop-release.yml"
echo "  - Authenticode / Apple / Tauri updater signing secrets → human ops only"
