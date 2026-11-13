# ESP32 Display Studio

[![Smoke](https://github.com/mateowoj-cpu/ESP32-App/actions/workflows/smoke.yml/badge.svg)](https://github.com/mateowoj-cpu/ESP32-App/actions/workflows/smoke.yml)
[![Version](https://img.shields.io/badge/version-0.2.6-blue)](./package.json)
[![Tauri](https://img.shields.io/badge/desktop-Tauri%202-24C8DB)](./src-tauri/)
[![i18n](https://img.shields.io/badge/i18n-PL%20%7C%20EN-informational)](./src/i18n/)

**Wizualne studio UI OLED/LCD dla ESP32** — symulator sprzętowy, edytor ekranów, automatyzacje, wykrywanie USB (Web Serial / natywny COM), Build → Flash → OTA, agent PC oraz generator C++ (Arduino / PlatformIO).

Repozytorium: [mateowoj-cpu/ESP32-App](https://github.com/mateowoj-cpu/ESP32-App) · Wersja **0.2.6** (Fazy 0–13) · Następna: [Faza 14](./docs/roadmap-next.md)

> **EN (short):** Design ESP32 OLED/LCD UIs visually, preview hardware, generate Arduino/PlatformIO firmware, and (on desktop) flash over USB or OTA Wi‑Fi with a Tauri 2 shell.

## Spis treści

- [Szybki start](#szybki-start)
- [Kluczowe funkcje](#kluczowe-funkcje)
- [Dokumentacja](#dokumentacja)
- [Wymagania](#wymagania)
- [Desktop (Tauri)](#desktop-tauri)
- [Status i roadmapa](#status-i-roadmapa)
- [Contributing](#contributing)

## Szybki start

### Web (Vite)

```bash
npm install
npm run dev
```

Aplikacja: [http://localhost:3000](http://localhost:3000) — Chromium z **Web Serial** do USB.

### Desktop (Tauri)

```bash
npm install
npm run tauri:dev          # natywne COMx / /dev/tty*
npm run tauri:build        # instalator (Windows: NSIS/MSI)
```

Instalatory z CI: workflow `windows-release.yml` (tag `v*`) oraz `desktop-unix-release.yml` (AppImage / deb / dmg).  
Szczegóły: [docs/developer-setup.md](./docs/developer-setup.md) · [docs/user-guide.md](./docs/user-guide.md).

### Przydatne skrypty

| Skrypt | Opis |
|--------|------|
| `npm run dev` / `build` / `preview` | Vite |
| `npm run lint` | TypeScript (`tsc --noEmit`) |
| `npm run smoke` | Lint + testy platform + build |
| `npm run tauri:dev` / `tauri:build` | Shell desktop |
| `npm run tauri:build:signed` | Build + nakładka Authenticode (lokalny JSON) |

## Kluczowe funkcje

| Obszar | Co dostajesz |
|--------|----------------|
| **Projektowanie** | Symulator OLED/LCD, edytor widgetów, sekwencje ekranów, mapa pinów |
| **Automatyzacje** | Triggery PIR / czas / dotyk / USB, cyber-zwierzak |
| **USB** | Web Serial (przeglądarka) lub natywny serial (Tauri); baza płytek + board cache/sync |
| **Firmware** | Generator `.ino` + `platformio.ini`; **Build-from-Studio** (PIO / arduino-cli) |
| **Flash / OTA** | `esptool` na COM; OTA Wi‑Fi (`espota` / HTTP) + odkrywanie **mDNS** |
| **Desktop** | Tray, close-to-tray, autostart, deep link `esp32studio://`, pliki `.esp32studio` |
| **Agent PC** | CPU / RAM / dysk (/ GPU) → ESP32 (`tools/pc-agent`) |
| **Aktualizacje** | Kanały stable / beta (`latest.json` / `latest-beta.json`) |
| **i18n** | PL / EN (chrome + treści paneli) |
| **Diagnostyka** | Lokalny log + eksport ZIP; **opt-in** telemetria sieciowa (domyślnie off) |
| **Dystrybucja** | NSIS/MSI, szablony winget + draft CI, paczki Unix z CI |

## Dokumentacja

Pełny indeks: **[docs/README.md](./docs/README.md)**

| Start | Temat |
|-------|--------|
| [Przewodnik użytkownika](./docs/user-guide.md) | Jak korzystać z Studio |
| [Setup developera](./docs/developer-setup.md) | Środowisko, skrypty, CI, PR |
| [Architektura](./docs/architecture.md) | UI ↔ platform ↔ Tauri |
| [Roadmapa](./docs/roadmap-next.md) | Po Fazie 13 → Faza 14 |

**Desktop / Windows:** [installer](./docs/windows-installer.md) · [drivers](./docs/windows-drivers.md) · [desktop polish](./docs/windows-desktop.md) · [updater](./docs/windows-updater.md) · [signing](./docs/windows-signing.md) · [SmartScreen](./docs/windows-smartscreen.md) · [winget](./docs/windows-winget.md) · [deep link](./docs/windows-deep-link.md) · [PC agent](./docs/windows-pc-agent.md) · [diagnostics](./docs/windows-diagnostics.md)

**Build / flash / OTA:** [build-flash](./docs/windows-build-flash.md) · [flash](./docs/windows-flash.md) · [sidecar PIO](./docs/windows-sidecar-pio.md) · [OTA](./docs/windows-ota.md)

**Unix & privacy:** [desktop-unix](./docs/desktop-unix.md) · [telemetry](./docs/telemetry.md)

## Wymagania

| Narzędzie | Wersja | Uwagi |
|-----------|--------|--------|
| Node.js | 22 LTS+ | [nodejs.org](https://nodejs.org/) |
| npm | 10+ | z Node |
| Przeglądarka | Chromium | Web Serial w trybie web |
| Rust + C++ toolchain | stable | tylko desktop Tauri |
| WebView2 | Win 10/11 | zwykle preinstalowany |

### Windows — port COM

1. Node 22 LTS (Add to PATH), PowerShell / Windows Terminal.  
2. Przeglądarka **lub** shell Tauri (natywny COM bez Web Serial).  
3. W Menedżerze urządzeń musi być `COMx`:
   - **CH340 / CH9102** (`0x1A86`) — WCH  
   - **CP210x** (`0x10C4`) — Silicon Labs  
   - **Espressif USB** (`0x303A`, m.in. S3/C3) — zwykle CDC przez Windows Update  

Bez sterownika USB-UART ani przeglądarka, ani Tauri nie zobaczą urządzenia — [docs/windows-drivers.md](./docs/windows-drivers.md).

## Desktop (Tauri)

Scaffold: `src-tauri/` (Tauri 2). Serial: `list_serial_ports`, `open_serial_port` (domyślnie 115200), `write` / `close`; eventy `serial-data`, `serial-disconnected`.

Warstwa JS: `src/platform/` (`webSerial` / `nativeSerial` / `mockSerial`) — UI nie woła `navigator.serial` bezpośrednio.

### Build Windows

```powershell
npm install
npm run tauri:build
```

Artefakty: `src-tauri/target/release/bundle/` (NSIS PL/EN, MSI ze stałym `upgradeCode`, WebView2 bootstrapper).  
Podpis (opcjonalnie, sekrety lokalne / CI — **nie w git**): [docs/windows-signing.md](./docs/windows-signing.md).

### Agent PC

```bash
cd tools/pc-agent && pip install -r requirements.txt
python esp32_pc_agent.py --host 192.168.1.150 --port 8080
```

Windows `.exe`: `scripts/windows/Build-PcAgent.ps1`. W UI: **Integracje → Monitor PC**. Docs: [windows-pc-agent.md](./docs/windows-pc-agent.md).

### Firmware z Studio

1. Skonfiguruj UI / automatyzacje.  
2. Desktop: **USB → Build → Flash** (sidecar PIO lub PATH); OTA w tej samej zakładce.  
3. Albo eksport `.ino` z generatora i build w Arduino IDE / PlatformIO.

```powershell
powershell -File .\scripts\windows\Install-PlatformIoSidecar.ps1
```

### Zmienne środowiskowe

Skopiuj `.env.example` → `.env` w razie potrzeby:

```text
GEMINI_API_KEY=...          # opcjonalny / obecnie nieużywany w UI
APP_URL=http://localhost:3000
# VITE_TELEMETRY_ENDPOINT=  # tylko build z opt-in telemetry (docs/telemetry.md)
```

Sekrety Authenticode / updater / winget — wyłącznie GitHub Secrets lub lokalny sejf (zob. `.env.example` komentarze).

## Status i roadmapa

| Faza | Skrót |
|------|--------|
| 0–5 | README Windows, Serial abstrakcja, Tauri COM, NSIS/MSI, agent PC, flash + deep link |
| 6–8 | Tray/autostart, i18n, kanały update, Build-from-Studio, winget template, diagnostyka |
| 9–11 | Sidecar PIO, OTA + mDNS, głębokie i18n, penv CI, winget path |
| **12** | SmartScreen checklist, ZIP diagnostyki, board sync, Unix parity (`0.2.5`) |
| **13 (obecna)** | CI AppImage/deb/dmg, opt-in telemetria, draft winget SHA, i18n pinout/USB (`0.2.6`) |
| **14 (następna)** | Community marketplace, EV/SmartScreen, board catalog, Unix polish |

Szczegóły: [docs/roadmap-next.md](./docs/roadmap-next.md).

**Uwaga dystrybucji:** draft winget i checklisty SmartScreen **nie** oznaczają live publish do `winget-pkgs` ani gotowej reputacji EV — to kroki człowieka po signed release.

## Contributing

1. Fork / branch od `main`.  
2. `npm install` → `npm run smoke`.  
3. Zachowaj i18n PL+EN dla nowych stringów UI.  
4. Aktualizuj docs przy zmianie zachowania użytkownika.  
5. Nie commituj sekretów, `.pfx`, prywatnych kluczy updatera.

Pełny setup: [docs/developer-setup.md](./docs/developer-setup.md).

## Licencja

Projekt bez wskazanej licencji w repozytorium — sprawdź ustawienia właściciela na GitHub.

## Screenshots

Zrzuty ekranu UI można dodać do `docs/media/` i podlinkować tutaj po pierwszym publicznym releasie wizualnym (obecnie brak oficjalnych assetów w repo).
