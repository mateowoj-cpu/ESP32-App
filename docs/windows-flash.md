# Flash helper (esptool)

ESP32 Display Studio (shell Tauri) potrafi wgrać gotowy firmware `.bin` przez systemowy **esptool**. IPC: `get_esptool_info`, `flash_write_firmware`, event `flash-log` — [architecture.md](./architecture.md).

## Wymagania

```powershell
pip install esptool
# upewnij się, że `python` / `esptool` są w PATH
```

Sterownik COM: [windows-drivers.md](./windows-drivers.md).

## Przepływ

1. Zaprojektuj UI w Studio.
2. **Opcja A (Faza 7):** **USB → Build → Flash** (PlatformIO/arduino-cli w PATH) — zob. [windows-build-flash.md](./windows-build-flash.md).
3. **Opcja B:** zbuduj `.bin` w Arduino IDE / PlatformIO ręcznie, potem **Flash** w Studio.

Komenda (odpowiednik CLI):

```text
# Auto Build+Flash uses a multi-segment plan from flasher_args.json (bootloader/partitions/app).
# Manual single-file flash requires an explicit offset (no silent 0x1000 default).
esptool --chip auto --port COMx --baud 460800 write_flash -z 0x10000 firmware.bin
```

Offset domyślny `0x1000` (klasyczny ESP32). Dla niektórych chipów / bootloaderów zmień offset w UI (np. `0x0`).

## Konsola Windows

Wykrywanie `esptool` (`where` / `py -m esptool`) oraz sam `write_flash` działają **bez widocznego okna CMD** od **0.2.13** — logi tylko w UI (`flash-log`). Zob. [windows-desktop.md](./windows-desktop.md).

## Ograniczenia

- Helper **nie kompiluje** `.ino` — tylko `write_flash`.
- Port COM nie może być jednocześnie otwarty w Serial Monitorze (zamknij monitor przed flash).
- Przy błędzie: BOOT+RESET w tryb download, niższy baud (115200), sprawdź VID/PID.

## Deep link flash

```text
esp32studio://flash?path=C:\build\firmware.bin
```

Aplikacja otworzy widok USB; wskaż port i uruchom flash ręcznie.
