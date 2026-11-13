# Sidecar PlatformIO (Faza 9–11)

Build-from-Studio **nie wymaga** `pio` w PATH użytkownika, jeśli zainstalujesz offline **sidecar** albo spakujesz penv w signed installerze.

## Instalacja po instalacji Studio (Windows)

```powershell
powershell -File .\scripts\windows\Install-PlatformIoSidecar.ps1
```

Skrypt tworzy:

| Ścieżka | Zawartość |
|---------|-----------|
| `%LOCALAPPDATA%\studio.esp32.display\sidecar\platformio\penv\` | venv z PlatformIO Core (`pio.exe`) |
| `%LOCALAPPDATA%\studio.esp32.display\sidecar\ota\espota.py` | klient ArduinoOTA |

Wymaga Python 3 (zaznacz „Add to PATH” przy instalacji).

## Bundling penv w instalatorze (Faza 10)

Pełny penv jest zbyt duży na git. Na maszynie release / w CI (`windows-penv-artifact.yml` → artifact `platformio-penv-windows`):

```powershell
powershell -File .\scripts\windows\Stage-PlatformIoPenv.ps1 -BuildIfMissing
npm run tauri:build:windows
```

To kopiuje penv do `src-tauri/resources/sidecar/platformio/penv/` (gitignored).  
`tauri.conf.json` bundluje `resources/sidecar/**/*`, więc signed NSIS/MSI może zawierać offline PIO.

Bez stage’owania instalator nadal dostarcza `README.txt` + NSIS hook z instrukcją sidecar.

## Jak Studio szuka toolchainu

Kolejność:

1. `ESP32_STUDIO_PIO` (pełna ścieżka do `pio.exe`)
2. Sidecar w `app_local_data_dir` / zasobach instalatora (`resources/sidecar/…`)
3. `pio` / `platformio` w PATH
4. `arduino-cli` w PATH (fallback)

W UI: **USB → Build → Flash** — hint pokazuje `(sidecar)` gdy użyto lokalnego penv.

## Docs powiązane

- [windows-build-flash.md](./windows-build-flash.md) — przepływ Build → Flash
- [windows-ota.md](./windows-ota.md) — OTA Wi‑Fi + mDNS
- [windows-winget.md](./windows-winget.md) — winget po signed release
