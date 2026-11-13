# Przewodnik użytkownika — ESP32 Display Studio

Krótki przewodnik po aplikacji **0.2.7**. Szczegóły techniczne (sterowniki, OTA, winget) są w dokumentach powiązanych.

## Dwa tryby uruchomienia

| Tryb | Jak | Serial USB |
|------|-----|------------|
| **Przeglądarka** | `npm run dev` → [http://localhost:3000](http://localhost:3000) | Web Serial (Chrome / Edge / Brave) |
| **Desktop (Tauri)** | `npm run tauri:dev` lub instalator z Releases | Natywne `COMx` / `/dev/tty*` |

Desktop dodaje: Build → Flash → OTA, tray/autostart, auto-update, deep link, agent PC, diagnostykę ZIP.

## Pierwsze kroki (przeglądarka)

1. Zainstaluj [Node.js 22 LTS](https://nodejs.org/), potem `npm install` i `npm run dev`.
2. Otwórz Chromium z Web Serial.
3. Zaprojektuj wyświetlacz w **Symulatorze** / **Edytorze UI**.
4. Podłącz ESP32 → **Wykryj ESP32 (USB)** → wybierz port.
5. Wyeksportuj kod w **Generatorze C++** (`.ino` + `platformio.ini`) albo zapisz projekt `.esp32studio`.

## Pierwsze kroki (Windows desktop)

1. Zainstaluj Studio z GitHub Releases (NSIS `.exe` zalecane) albo zbuduj lokalnie — [windows-installer.md](./windows-installer.md).
2. Podłącz płytkę; upewnij się, że w Menedżerze urządzeń jest `COMx` — [windows-drivers.md](./windows-drivers.md).
3. **Wykryj ESP32 (USB)** — backend `Native COM`.
4. **USB → Build → Flash** — pierwszy build może długo ściągać platformę espressif32.
5. Bez `pio` w PATH: [sidecar PlatformIO](./windows-sidecar-pio.md).

Linux / macOS: [desktop-unix.md](./desktop-unix.md).

## Główne funkcje

- **Symulator sprzętowy** — OLED/LCD, sensory, GPIO  
- **Edytor UI** — widgety, animacje, sekwencje ekranów  
- **Automatyzacje / cyber-zwierzak** — PIR, czas, dotyk, USB  
- **Marketplace** — gotowe paczki widgetów / reguł (import JSON, sandbox bez wykonywania kodu)  
- **Integracje** — pogoda (Open-Meteo itd.), **Monitor PC** (CPU/RAM/dysk)  
- **Generator C++** — Arduino / PlatformIO + mapa pinów  
- **i18n** — PL / EN (Ustawienia lub chrome aplikacji)

## Build, Flash, OTA (desktop)

1. Skonfiguruj wyświetlacz, Wi‑Fi (dla OTA) i automatyzacje.  
2. W zakładce USB użyj **Build** / **Flash** / **Build + Flash**.  
3. **OTA Wi‑Fi**: po pierwszym wgraniu USB użyj mDNS lub IP — [windows-ota.md](./windows-ota.md).  
4. Zamknij Serial Monitor przed flashowaniem USB.

## Ustawienia desktop

**Ustawienia → Desktop:**

| Opcja | Opis |
|-------|------|
| Język | PL / EN |
| Zamykaj do zasobnika | Okno ukrywa się w tray |
| Autostart Studio / agenta PC | Start z systemem |
| Kanał aktualizacji | stable (`latest.json`) / beta (`latest-beta.json`) |
| Diagnostyka flash/COM | Lokalny log + eksport ZIP |
| Synchronizuj profile płytek | Community catalog VID:PID |
| Telemetria diagnostyczna | **Opt-in**, domyślnie off — [telemetry.md](./telemetry.md) |

## Projekty i deep link

- Zapis / otwarcie: plik **`.esp32studio`**  
- Protokół: `esp32studio://open?path=…`, `esp32studio://flash?path=…`  
- Szczegóły: [windows-deep-link.md](./windows-deep-link.md)

## Agent PC

W desktopie: **Integracje → Monitor PC → Start/Stop**.  
Samodzielnie: `tools/pc-agent` — [windows-pc-agent.md](./windows-pc-agent.md).

## Gdy coś nie działa

| Objaw | Co sprawdzić |
|-------|----------------|
| Brak portu COM | Sterownik CH340 / CP210x / Espressif |
| Flash fails | Port wolny, offset chipa, BOOT+RESET |
| OTA nie znajduje hosta | Ta sama sieć Wi‑Fi, mDNS UDP 5353, pierwsze flash USB |
| SmartScreen | Oficjalny Release + [windows-smartscreen.md](./windows-smartscreen.md) |
| Support | Eksport ZIP diagnostyki — [windows-diagnostics.md](./windows-diagnostics.md) |

Powrót: [indeks docs](./README.md).
