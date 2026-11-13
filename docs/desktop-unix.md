# Linux / macOS desktop parity (Faza 12 → 13)

Windows pozostaje ścieżką release Authenticode / winget.  
Shell Tauri 2 + natywny serial / OTA / Build działają też na **Linux** i **macOS**, o ile toolchain jest dostępny.

## Co działa out-of-the-box

| Funkcja | Linux | macOS | Uwagi |
|---------|-------|-------|--------|
| Serial (list/open/write) | tak | tak | `serialport` — urządzenia `/dev/ttyUSB*`, `/dev/ttyACM*`, `/dev/cu.*` |
| Flash (`esptool`) | tak | tak | `pip install esptool` lub `esptool` w PATH |
| OTA (`espota` / HTTP) | tak | tak | `curl` + opcjonalnie sidecar `espota.py` |
| Build (PlatformIO / arduino-cli) | tak | tak | PATH albo sidecar (poniżej) |
| Tray / close-to-tray | tak | tak | |
| Autostart aplikacji | tak | LaunchAgent | `tauri-plugin-autostart` |
| Autostart agenta PC | `.desktop` | `.desktop` w `~/.config/autostart` | wymaga `python3` + `tools/pc-agent/esp32_pc_agent.py` lub binarki |

## Sidecar PlatformIO (Unix)

```bash
chmod +x scripts/unix/install-platformio-sidecar.sh
./scripts/unix/install-platformio-sidecar.sh
```

Tworzy (identifier `studio.esp32.display`):

| OS | Sidecar root (domyślnie) |
|----|--------------------------|
| Linux | `~/.local/share/studio.esp32.display/sidecar/…` |
| macOS | `~/Library/Application Support/studio.esp32.display/sidecar/…` |

Nadpisania: `ESP32_STUDIO_PIO`, `ESP32_STUDIO_ESPOTA`, `ESP32_STUDIO_DATA_DIR`.

## Dev

```bash
npm install
npm run tauri:dev
```

Wymaga Rust + zależności systemowych Tauri 2 ([prerequisites](https://v2.tauri.app/start/prerequisites/)).

## Bundling / CI (Faza 13)

Workflow [`.github/workflows/desktop-unix-release.yml`](../.github/workflows/desktop-unix-release.yml):

| Job | Runner | Targets | Config overlay |
|-----|--------|---------|----------------|
| `linux-packages` | `ubuntu-22.04` | AppImage + deb | `src-tauri/tauri.linux.json` |
| `macos-dmg` | `macos-14` | dmg | `src-tauri/tauri.macos.json` |

Wyzwalacze: tag `v*` oraz `workflow_dispatch`. Artefakty upload + opcjonalnie attach do GitHub Release.  
**Bez** store submit / notarize (backlog Faza 14). Updater artifacts wyłączone w nakładkach Unix (`createUpdaterArtifacts: false`).

Lokalnie:

```bash
npm run tauri:build -- --config src-tauri/tauri.linux.json
npm run tauri:build -- --config src-tauri/tauri.macos.json
```

## Docs powiązane

- [windows-sidecar-pio.md](./windows-sidecar-pio.md) — model sidecar (Windows + Unix)
- [windows-build-flash.md](./windows-build-flash.md)
- [windows-ota.md](./windows-ota.md)
- [windows-diagnostics.md](./windows-diagnostics.md)
- [telemetry.md](./telemetry.md)
