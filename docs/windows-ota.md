# OTA firmware przez Wi‑Fi (Faza 9)

Studio może wgrać `.bin` na ESP32 w LAN bez kabla USB.

## Wymagania na płytce

1. W **Ustawieniach** włącz OTA (domyślnie włączone) — generator C++ dołącza `ArduinoOTA` + endpoint `POST /update`.
2. Wgraj szkic **pierwszy raz po USB** (Bootloader / esptool).
3. ESP32 musi być w tej samej sieci Wi‑Fi co PC (SSID/hasło w Ustawieniach).
4. W Serial Monitorze zobaczysz IP po `WiFi połączone!`.

## UI (desktop Tauri)

**USB → Build → Flash → sekcja OTA Wi‑Fi**

| Pole | Opis |
|------|------|
| IP ESP32 | np. `192.168.1.50` |
| Port | `3232` (espota) lub port WebServer (`8080`) dla HTTP |
| Hasło | musi zgadzać się z `OTA_PASSWORD` w szkicu |
| Metoda | `espota` (ArduinoOTA) lub `HTTP /update` |

Przycisk **OTA Upload** używa zbudowanego / wybranego `.bin`.

## Narzędzia PC

- **espota.py** — sidecar (`Install-PlatformIoSidecar.ps1`) albo z pakietu Arduino-ESP32 (`tools/espota.py`)
- **HTTP** — `curl` (Windows 10+) → `POST http://IP:port/update` (multipart `firmware=@file.bin`)

Override: `ESP32_STUDIO_ESPOTA=C:\path\to\espota.py`

## Bezpieczeństwo

Hasło OTA jest w szkicu w plain text — używaj sieci zaufanej / zmień domyślne `esp32ota` przed produkcją.
