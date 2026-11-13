# Flash helper (esptool)

ESP32 Display Studio (shell Tauri) potrafi wgrać gotowy firmware `.bin` przez systemowy **esptool**.

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
esptool --chip auto --port COMx --baud 460800 write_flash -z 0x1000 firmware.bin
```

Offset domyślny `0x1000` (klasyczny ESP32). Dla niektórych chipów / bootloaderów zmień offset w UI (np. `0x0`).

## Ograniczenia

- Helper **nie kompiluje** `.ino` — tylko `write_flash`.
- Port COM nie może być jednocześnie otwarty w Serial Monitorze (zamknij monitor przed flash).
- Przy błędzie: BOOT+RESET w tryb download, niższy baud (115200), sprawdź VID/PID.

## Deep link flash

```text
esp32studio://flash?path=C:\build\firmware.bin
```

Aplikacja otworzy widok USB; wskaż port i uruchom flash ręcznie.
