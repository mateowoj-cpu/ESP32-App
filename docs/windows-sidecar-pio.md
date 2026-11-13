# Sidecar PlatformIO (Faza 9)

Build-from-Studio **nie wymaga** `pio` w PATH użytkownika, jeśli zainstalujesz offline **sidecar**.

## Instalacja (Windows)

```powershell
powershell -File .\scripts\windows\Install-PlatformIoSidecar.ps1
```

Skrypt tworzy:

| Ścieżka | Zawartość |
|---------|-----------|
| `%LOCALAPPDATA%\studio.esp32.display\sidecar\platformio\penv\` | venv z PlatformIO Core (`pio.exe`) |
| `%LOCALAPPDATA%\studio.esp32.display\sidecar\ota\espota.py` | klient ArduinoOTA |

Wymaga Python 3 (zaznacz „Add to PATH” przy instalacji).

## Jak Studio szuka toolchainu

Kolejność:

1. `ESP32_STUDIO_PIO` (pełna ścieżka do `pio.exe`)
2. Sidecar w `app_local_data_dir` / zasobach instalatora (`resources/sidecar/…`)
3. `pio` / `platformio` w PATH
4. `arduino-cli` w PATH (fallback)

W UI: **USB → Build → Flash** — hint pokazuje `(sidecar)` gdy użyto lokalnego penv.

## Instalator NSIS/MSI

Pakiet bundluje `resources/sidecar/README.txt` (instrukcja). Pełny penv PlatformIO jest zbyt duży, by trzymać go w repo — stage’uj go lokalnie przy signed release albo uruchom skrypt po instalacji (hook NSIS przypomina o sidecar).

## Docs powiązane

- [windows-build-flash.md](./windows-build-flash.md) — przepływ Build → Flash
- [windows-ota.md](./windows-ota.md) — OTA Wi‑Fi (espota / HTTP)
