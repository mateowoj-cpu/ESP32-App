#!/usr/bin/env bash
# Installs an offline PlatformIO Core sidecar + espota.py for ESP32 Display Studio (Faza 12).
# Places tools under the Tauri app local data dir (identifier: studio.esp32.display).
set -euo pipefail

TARGET_ROOT="${ESP32_STUDIO_DATA_DIR:-}"
SKIP_ESPOTA="${SKIP_ESPOTA:-0}"

studio_local_data() {
  if [[ -n "$TARGET_ROOT" ]]; then
    printf '%s\n' "$TARGET_ROOT"
    return
  fi
  case "$(uname -s)" in
    Darwin)
      printf '%s\n' "${HOME}/Library/Application Support/studio.esp32.display"
      ;;
    *)
      printf '%s\n' "${XDG_DATA_HOME:-$HOME/.local/share}/studio.esp32.display"
      ;;
  esac
}

ROOT="$(studio_local_data)"
PIO_ROOT="$ROOT/sidecar/platformio"
OTA_ROOT="$ROOT/sidecar/ota"
mkdir -p "$PIO_ROOT" "$OTA_ROOT"

echo "==> Sidecar root: $ROOT"

PY=""
for cand in python3 python; do
  if command -v "$cand" >/dev/null 2>&1; then
    PY="$(command -v "$cand")"
    break
  fi
done
if [[ -z "$PY" ]]; then
  echo "Python 3 not found. Install python3 (and venv) then retry." >&2
  exit 1
fi

echo "==> Using Python: $PY"

PENV="$PIO_ROOT/penv"
if [[ ! -x "$PENV/bin/python" ]]; then
  echo "==> Creating virtualenv at $PENV"
  "$PY" -m venv "$PENV"
fi

PIP="$PENV/bin/pip"
PIO="$PENV/bin/pio"
if [[ ! -x "$PIP" ]]; then
  echo "venv pip missing at $PIP" >&2
  exit 1
fi

echo "==> Installing platformio into sidecar venv (this may take several minutes)…"
"$PIP" install --upgrade pip
"$PIP" install "platformio"

if [[ ! -x "$PIO" ]]; then
  echo "pio not found after install: $PIO" >&2
  exit 1
fi

echo "==> PlatformIO OK: $($PIO --version)"

if [[ "$SKIP_ESPOTA" != "1" ]]; then
  ESPOTA="$OTA_ROOT/espota.py"
  URL="https://raw.githubusercontent.com/espressif/arduino-esp32/master/tools/espota.py"
  echo "==> Downloading espota.py → $ESPOTA"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$URL" -o "$ESPOTA" || echo "Warning: could not download espota.py"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$ESPOTA" "$URL" || echo "Warning: could not download espota.py"
  else
    echo "Warning: curl/wget missing — place espota.py at $ESPOTA manually"
  fi
  if [[ -f "$ESPOTA" ]]; then
    echo "==> espota.py ready ($(wc -c < "$ESPOTA") bytes)"
  fi
fi

echo ""
echo "Done. Restart ESP32 Display Studio — Build should show PlatformIO (sidecar)."
echo "Optional env overrides:"
echo "  ESP32_STUDIO_PIO=$PIO"
echo "  ESP32_STUDIO_ESPOTA=$OTA_ROOT/espota.py"
echo "  ESP32_STUDIO_DATA_DIR=$ROOT"
