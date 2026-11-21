# Linux / macOS desktop parity (Faza 12 → 15)

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

## Bundling / CI (Faza 13–15)

[`desktop-release.yml`](../.github/workflows/desktop-release.yml) buduje cztery warianty z jednego commita.

| Runner | Instalatory |
| --- | --- |
| `windows-2022` | NSIS, MSI i osobny agent PC x64 |
| `ubuntu-22.04` | AppImage i DEB x64 |
| `macos-15` | DMG Apple Silicon |
| `macos-15-intel` | DMG Intel |

Release Please wylicza wersję po zmianach `fix:`, `feat:` i `BREAKING CHANGE`. Po scaleniu PR wydawniczego powstaje draft. Publikacja następuje po weryfikacji całej macierzy, gdy `DESKTOP_AUTO_PUBLISH=true`.

- Zmienna `RELEASE_APP_ID` i sekret `RELEASE_APP_PRIVATE_KEY` wskazują aplikację GitHub z dostępem zapisu do Contents, Pull requests i Issues.
- `DESKTOP_SYSTEM_SIGNED=true` wymaga kluczy systemowych Windows i Apple. [Windows](./windows-signing.md) · [macOS](./macos-notarize.md)
- `DESKTOP_UPDATER_SIGNED=true` wymaga klucza Tauri. CI zweryfikuje podpis i wersję, a następnie złoży wspólny `latest.json`. [Updater](./windows-updater.md)

Uruchom **Desktop Release → Run workflow** na `main` z pustym `tag`, aby pobrać instalatory testowe z Artifacts. Podanie istniejącego taga draftu ponawia build tego commita. Wersję produktu przechowuje `package.json`. Kontrola `npm run assert:app-version` porównuje ją z lockfile npm i opcjonalnym tagiem.

[Lokalny smoke AppImage](../.github/workflows/desktop-unix-appimage-smoke.yml) nadal można uruchamiać osobno. W lokalnej kompilacji podstawowa konfiguracja automatycznie ładuje plik `tauri.<platform>.conf.json`.

## Docs powiązane

- [macos-notarize.md](./macos-notarize.md) — codesign / notarize (opcjonalnie)
- [windows-sidecar-pio.md](./windows-sidecar-pio.md) — model sidecar (Windows + Unix)
- [windows-build-flash.md](./windows-build-flash.md)
- [windows-ota.md](./windows-ota.md)
- [windows-diagnostics.md](./windows-diagnostics.md)
- [windows-updater.md](./windows-updater.md)
- [telemetry.md](./telemetry.md)
