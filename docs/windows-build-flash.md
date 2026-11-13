# Build-from-Studio (Faza 7)

Jeden przepływ w shellu Tauri: **Generate → Build → Flash**.

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

## Artefakty

- PlatformIO: `.pio/build/<env>/firmware.bin`
- arduino-cli: `build/*.ino.bin`

Cache toolchainu PIO zostaje między buildami (szybsze kolejne kompilacje).

## Ograniczenia

- Pierwszy build PlatformIO ściąga platformę espressif32 — może trwać długo.
- Port COM nie może być otwarty w Serial Monitorze podczas flash.
- Studio **nie** bundluje PlatformIO; musi być w PATH użytkownika.
