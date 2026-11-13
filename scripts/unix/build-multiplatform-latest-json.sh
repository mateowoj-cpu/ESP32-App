#!/usr/bin/env bash
# Faza 14 — assemble a multi-platform Tauri updater latest.json template
# from already-signed platform artifacts. Does NOT invent signatures.
#
# Usage:
#   ./scripts/unix/build-multiplatform-latest-json.sh \
#     --version 0.2.7 \
#     --notes "Release notes" \
#     --out latest.json \
#     [--windows path/to/nsis.json] \
#     [--linux path/to/appimage.json] \
#     [--darwin path/to/macos.json]
#
# Each platform JSON fragment should be the Tauri updater platform object
# (url, signature, withOptional …) produced by a *signed* tauri build.
# Fragments without a real signature are refused.

set -euo pipefail

VERSION=""
NOTES=""
OUT="latest.json"
WIN_JSON=""
LINUX_JSON=""
DARWIN_JSON=""

usage() {
  sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="${2:-}"; shift 2 ;;
    --notes) NOTES="${2:-}"; shift 2 ;;
    --out) OUT="${2:-}"; shift 2 ;;
    --windows) WIN_JSON="${2:-}"; shift 2 ;;
    --linux) LINUX_JSON="${2:-}"; shift 2 ;;
    --darwin) DARWIN_JSON="${2:-}"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown arg: $1" >&2; usage ;;
  esac
done

if [[ -z "$VERSION" ]]; then
  echo "--version is required" >&2
  exit 1
fi

require_signed_platform() {
  local label="$1"
  local path="$2"
  if [[ -z "$path" ]]; then
    return 1
  fi
  if [[ ! -f "$path" ]]; then
    echo "[$label] file not found: $path" >&2
    exit 1
  fi
  if ! grep -q '"signature"' "$path"; then
    echo "[$label] refusing unsigned fragment (no signature field): $path" >&2
    exit 1
  fi
  # Empty / placeholder signatures
  if grep -Eq '"signature"[[:space:]]*:[[:space:]]*(""|null|"REPLACE|"TODO|"PLACEHOLDER)' "$path"; then
    echo "[$label] refusing placeholder signature: $path" >&2
    exit 1
  fi
  return 0
}

PLATFORMS_JSON="{}"

add_platform() {
  local key="$1"
  local path="$2"
  if [[ -z "$path" ]]; then
    return 0
  fi
  require_signed_platform "$key" "$path" || true
  PLATFORMS_JSON=$(python3 - "$PLATFORMS_JSON" "$key" "$path" <<'PY'
import json, sys
base = json.loads(sys.argv[1])
key = sys.argv[2]
path = sys.argv[3]
with open(path, encoding="utf-8") as f:
    frag = json.load(f)
# Accept either a bare platform object or a full latest.json with platforms[key]
if isinstance(frag, dict) and "platforms" in frag and key in frag["platforms"]:
    base[key] = frag["platforms"][key]
elif isinstance(frag, dict) and "url" in frag and "signature" in frag:
    base[key] = frag
else:
    raise SystemExit(f"Unrecognized platform fragment for {key}: {path}")
print(json.dumps(base))
PY
)
}

add_platform "windows-x86_64" "$WIN_JSON"
add_platform "linux-x86_64" "$LINUX_JSON"
add_platform "darwin-aarch64" "$DARWIN_JSON"
# Optional Intel Mac alias if same fragment provided twice under different flags — skip.

if [[ "$PLATFORMS_JSON" == "{}" ]]; then
  echo "Provide at least one of --windows / --linux / --darwin with a signed fragment." >&2
  exit 1
fi

PUB_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

python3 - "$VERSION" "$NOTES" "$PUB_DATE" "$PLATFORMS_JSON" "$OUT" <<'PY'
import json, sys
version, notes, pub_date, platforms_raw, out = sys.argv[1:6]
platforms = json.loads(platforms_raw)
doc = {
    "version": version,
    "notes": notes,
    "pub_date": pub_date,
    "platforms": platforms,
}
with open(out, "w", encoding="utf-8") as f:
    json.dump(doc, f, indent=2)
    f.write("\n")
print(f"Wrote {out} with platforms: {', '.join(platforms.keys())}")
PY
