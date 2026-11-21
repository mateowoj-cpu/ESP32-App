# Build-from-Studio

Jeden przepływ w shellu Tauri: **Generate → Build → Flash** (od Fazy 7; sidecar / OTA w Fazach 9–11).  
IPC: `get_firmware_toolchain_info`, `build_firmware_from_sketch`, event `build-log` — [architecture.md](./architecture.md).  
Powiązane: [windows-flash.md](./windows-flash.md) · [windows-sidecar-pio.md](./windows-sidecar-pio.md) · [windows-ota.md](./windows-ota.md).

## Wymagania

```powershell
# Preferowane
pip install platformio
# albo
# https://arduino.github.io/arduino-cli/
arduino-cli core update-index
arduino-cli core install esp32:esp32

pip install esptool
```

Sterowniki COM: [windows-drivers.md](./windows-drivers.md).

## UI

**USB → Build → Flash**

| Przycisk | Działanie |
|----------|-----------|
| **Build** | Zapisuje wygenerowany szkic + `platformio.ini` w `%LOCALAPPDATA%/…/firmware-build`, uruchamia `pio run` (lub `arduino-cli compile`) |
| **Flash** | `esptool write_flash` na wybrany COM |
| **Build + Flash** | Oba kroki pod rząd |

Profil płytki (esp32 / s3 / c3 / …) bierze się z wykrytego chipa.

Wejście w zakładkę USB odświeża info o esptool / PlatformIO / arduino-cli **w tle**. Od **0.2.13** te probe’y i same procesy build/flash na Windows **nie otwierają okien CMD** (`CREATE_NO_WINDOW` — [windows-desktop.md](./windows-desktop.md) § „Brak migających okien CMD”). Postęp widać w panelu logów UI (`build-log` / `flash-log`).

## Artefakty i plan flash (P0)

Każdy build dostaje izolowany katalog `firmware-build/artifacts/<build_id>/` (osobno od cache `.pio` / wyjścia arduino-cli). Wynik IPC zawiera:

| Pole | Znaczenie |
|------|-----------|
| `buildId` | Identyfikator tej kompilacji |
| `imageKind` | `usbFullSet` · `otaApp` · `manual` |
| `chipFamily` | np. `esp32` / `esp32c3` / `esp32s3` |
| `flashPlan` | Segmenty `offset + path + role` z `flasher_args.json` |
| `autoFlashAllowed` | `true` tylko przy zaufanym planie USB |

**Build + Flash** używa wyłącznie zweryfikowanego planu (wiele segmentów: bootloader / partycje / app). Brak `flasher_args.json` blokuje auto USB flash (nadal można OTA albo ręczny plik z jawnym offsetem). Nowy build unieważnia poprzedni wynik auto. Ręczny flash **nie** domyśla już `0x1000`.

Cache toolchainu PIO w `workspace/.pio` zostaje między buildami (szybsze kolejne kompilacje); źródłem flash są wyłącznie skopiowane artefakty.

## Sidecar (Faza 9)

Zamiast PATH możesz zainstalować offline PlatformIO:

```powershell
powershell -File .\scripts\windows\Install-PlatformIoSidecar.ps1
```

Szczegóły: [windows-sidecar-pio.md](./windows-sidecar-pio.md). OTA Wi‑Fi: [windows-ota.md](./windows-ota.md).

## Ograniczenia

- Pierwszy build PlatformIO ściąga platformę espressif32 — może trwać długo.
- Port COM nie może być otwarty w Serial Monitorze podczas flash.
- Pełny penv PIO nie jest w repozytorium — użyj skryptu sidecar albo PATH.
