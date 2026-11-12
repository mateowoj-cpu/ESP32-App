# ESP32 Display Studio

Wizualne środowisko do projektowania interfejsów OLED/LCD dla ESP32: symulator sprzętowy, edytor UI, automatyzacje, cyber-zwierzak oraz generator gotowego kodu C++ (Arduino / PlatformIO).

Repozytorium: [mateowoj-cpu/ESP32-App](https://github.com/mateowoj-cpu/ESP32-App)

## Wymagania

| Narzędzie | Wersja | Uwagi |
|-----------|--------|--------|
| Node.js | 22 LTS (lub nowszy) | [nodejs.org](https://nodejs.org/) |
| npm | 10+ | dostarczany z Node |
| Przeglądarka | Chrome, Edge, Brave lub inny Chromium | wymagana do **Web Serial** w trybie przeglądarkowym |
| Rust + VS Build Tools | do desktopa Tauri | tylko gdy budujesz `npm run tauri:dev` / `tauri:build` |
| WebView2 Runtime | Windows 10/11 | zwykle preinstalowany; installer Tauri potrafi dociągnąć bootstrapper |

### Windows

1. Zainstaluj [Node.js 22 LTS](https://nodejs.org/) (zaznacz opcję „Add to PATH”).
2. Używaj **PowerShell** lub **Windows Terminal**.
3. **Tryb przeglądarki:** Edge/Chrome + Web Serial.
4. **Tryb desktop (Tauri):** natywne porty `COMx` bez Web Serial — zobacz sekcję [Aplikacja desktop (Tauri)](#aplikacja-desktop-tauri).
5. Podłącz płytkę i upewnij się, że w **Menedżerze urządzeń** pojawia się port `COMx`.
   - **CH340 / CH9102** (VID `0x1A86`) — sterownik WCH
   - **CP210x** (VID `0x10C4`) — Silicon Labs VCP
   - **Espressif native USB** (VID `0x303A`, m.in. ESP32-S3/C3) — zwykle CDC przez Windows Update

Bez sterownika USB-UART ani przeglądarka, ani shell Tauri nie zobaczą urządzenia.

## Szybki start

```bash
npm install
npm run dev
```

Aplikacja startuje na [http://localhost:3000](http://localhost:3000).

### Przydatne skrypty

| Skrypt | Opis |
|--------|------|
| `npm run dev` | Serwer deweloperski Vite (port 3000) |
| `npm run build` | Build produkcyjny do `dist/` |
| `npm run preview` | Podgląd builda |
| `npm run lint` | Sprawdzenie TypeScript (`tsc --noEmit`) |
| `npm run clean` | Usuwa `dist` i artefakty (działa na Windows, macOS i Linux) |
| `npm run tauri:dev` | Desktop Tauri + Vite (natywny COM) |
| `npm run tauri:build` | Instalator desktop (na Windows: NSIS/MSI) |
| `npm run tauri:build:signed` | Build z nakładką Authenticode (`tauri.windows-signing.local.json`) |

## Funkcje

- **Symulator sprzętowy** — OLED/LCD, sensory, GPIO, USB/Bluetooth
- **Edytor graficzny UI** — widgety, animacje, sekwencje ekranów
- **Wykryj ESP32 (USB)** — Web Serial + baza popularnych płytek (preset)
- **Automatyzacje i cyber-zwierzak** — triggery PIR/czas/dotyk/USB
- **Integracje** — pogoda (Open-Meteo i inne), agent PC (CPU/RAM/dysk)
- **Generator C++** — plik `.ino`, `platformio.ini`, mapa pinów

## Port szeregowy (warstwa platform)

Dostęp do USB/Serial jest odizolowany w `src/platform/`:

- `webSerial` — natywne Web Serial API w Chromium
- `nativeSerial` — Tauri + Rust (`serialport`), porty `COMx` / `/dev/tty*`
- `mockSerial` — tryb bez sprzętu (presety / testy)

UI (`UsbDetectorView`) korzysta wyłącznie z tej abstrakcji — nie wywołuje `navigator.serial` bezpośrednio. W shellu Tauri `main.tsx` rejestruje adapter native przed renderem.

## Aplikacja desktop (Tauri)

Scaffold leży w `src-tauri/` (Tauri 2). Komendy Rust:

- `list_serial_ports`
- `open_serial_port` (domyślnie 115200 baud)
- `write_serial_port` / `close_serial_port`
- eventy: `serial-data`, `serial-disconnected`

### Dev (Windows)

1. Zainstaluj [Rust](https://rustup.rs/) oraz **Visual Studio Build Tools** (workload C++).
2. Upewnij się, że WebView2 jest dostępny.
3. W katalogu projektu:

```powershell
npm install
npm run tauri:dev
```

W zakładce **Wykryj ESP32 (USB)** zobaczysz backend `Native COM` i listę portów.

### Build instalatora Windows

Na maszynie Windows (MSVC):

```powershell
npm install
npm run tauri:build
```

Artefakty NSIS/MSI pojawią się w `src-tauri/target/release/bundle/`.

Instalator:

- **NSIS** (`.exe`) — język PL/EN, instalacja dla bieżącego użytkownika, hook ze wskazówką o sterownikach COM
- **MSI** — stały `upgradeCode` do aktualizacji in-place
- **WebView2** — bootstrapper dociągany przy braku Runtime
- Zasoby: `DRIVERS.txt`, `SIGNING.txt` w katalogu aplikacji

Dokumentacja:

- [docs/windows-installer.md](./docs/windows-installer.md) — bundlowanie NSIS/MSI
- [docs/windows-drivers.md](./docs/windows-drivers.md) — CH340 / CP210x / Espressif
- [docs/windows-signing.md](./docs/windows-signing.md) — Authenticode + sekrety CI

Podpis (opcjonalnie):

```powershell
Copy-Item src-tauri\tauri.windows-signing.example.json src-tauri\tauri.windows-signing.local.json
# wstaw thumbprint certyfikatu
npm run tauri:build:signed
```

CI: `.github/workflows/windows-release.yml` (tag `v*` lub ręczne uruchomienie).

## Agent PC (monitor zasobów)

Wygenerowany skrypt Python (`esp32_pc_agent.py`) wysyła CPU/RAM/dysk do ESP32 przez HTTP.

```bash
pip install psutil requests
python esp32_pc_agent.py
```

Na Windows zajętość dysku jest liczona z `C:\`.

## Eksport firmware

1. Skonfiguruj wyświetlacz, ekrany i automatyzacje.
2. Pobierz `.ino` (przycisk w pasku) albo skopiuj kod z zakładki **Generator Kodu C++**.
3. Otwórz szkic w Arduino IDE 2.x / PlatformIO, wybierz płytkę ESP32 i port `COMx`, wgraj firmware.

Wymagane biblioteki Arduino (przykład OLED SSD1306): Adafruit SSD1306, Adafruit GFX, ArduinoJson.

## Zmienne środowiskowe

Skopiuj `.env.example` → `.env` w razie potrzeby (np. klucz Gemini — obecnie opcjonalny / nieużywany w UI).

```
GEMINI_API_KEY=...
APP_URL=http://localhost:3000
```

## Roadmapa Windows (skrót)

- **Faza 0–1:** README Windows, skrypty cross-platform, abstrakcja Serial
- **Faza 2:** scaffold Tauri 2 + natywny COM (`src-tauri`, adapter `native`)
- **Faza 3 (obecna):** NSIS/MSI, docs sterowników, Authenticode + workflow `windows-release`
- **Kolejne:** agent PC jako `.exe`, auto-update

## Licencja

Projekt prywatny / bez wskazanej licencji w repozytorium — sprawdź ustawienia właściciela na GitHub.
