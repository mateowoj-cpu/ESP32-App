#!/usr/bin/env bash
# Faza 16 — optional macOS notarize + staple for CI / local release.
# Requires Apple secrets in the environment. Never invent credentials.
# Skips cleanly when required vars are missing (exit 0).
set -euo pipefail

DMG_GLOB="${1:-src-tauri/target/release/bundle/dmg/*.dmg}"

if [[ -z "${APPLE_ID:-}" || -z "${APPLE_PASSWORD:-}" || -z "${APPLE_TEAM_ID:-}" ]]; then
  echo "APPLE_ID / APPLE_PASSWORD / APPLE_TEAM_ID unset — skip notarize."
  exit 0
fi

shopt -s nullglob
dmgs=( $DMG_GLOB )
if [[ ${#dmgs[@]} -eq 0 ]]; then
  echo "No dmg matched $DMG_GLOB — skip notarize."
  exit 0
fi

for dmg in "${dmgs[@]}"; do
  echo "Submitting $dmg to notarytool…"
  xcrun notarytool submit "$dmg" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait
  echo "Stapling $dmg…"
  xcrun stapler staple "$dmg"
done

echo "Notarize + staple complete."
