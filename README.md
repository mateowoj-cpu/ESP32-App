# ESP32 Display Studio

Wizualne środowisko do projektowania interfejsów OLED/LCD dla ESP32: symulator sprzętowy, edytor UI, automatyzacje, cyber-zwierzak oraz generator gotowego kodu C++ (Arduino / PlatformIO).

Repozytorium: [mateowoj-cpu/ESP32-App](https://github.com/mateowoj-cpu/ESP32-App)

## Wymagania

| Narzędzie | Wersja | Uwagi |
|-----------|--------|--------|
| Node.js | 22 LTS (lub nowszy) | [nodejs.org](https://nodejs.org/) |
| npm | 10+ | dostarczany z Node |
| Przeglądarka | Chrome, Edge, Brave lub inny Chromium | wymagana do **Web Serial** (wykrywanie ESP32 przez USB) |

### Windows

1. Zainstaluj [Node.js 22 LTS](https://nodejs.org/) (zaznacz opcję „Add to PATH”).
2. Używaj **PowerShell** lub **Windows Terminal** (nie starszego `cmd`, jeśli możesz).
3. Do wykrywania ESP32 przez USB użyj **Microsoft Edge** lub **Google Chrome**.
4. Podłącz płytkę i upewnij się, że w **Menedżerze urządzeń** pojawia się port `COMx`.
   - **CH340 / CH9102** (VID `0x1A86`) — sterownik WCH
   - **CP210x** (VID `0x10C4`) — Silicon Labs VCP
   - **Espressif native USB** (VID `0x303A`, m.in. ESP32-S3/C3) — zwykle CDC przez Windows Update

Bez sterownika USB-UART przeglądarka nie zobaczy urządzenia w Web Serial.

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
- `mockSerial` — tryb bez sprzętu (presety / testy)
- miejsce na przyszły adapter desktopowy (np. Tauri)

UI (`UsbDetectorView`) korzysta wyłącznie z tej abstrakcji — nie wywołuje `navigator.serial` bezpośrednio.

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

- **Faza 0–1 (obecna):** README Windows, skrypty cross-platform, abstrakcja Serial
- **Kolejne:** host desktop (Tauri/Electron), natywny COM, instalator MSI/NSIS, agent PC jako `.exe`

## Licencja

Projekt prywatny / bez wskazanej licencji w repozytorium — sprawdź ustawienia właściciela na GitHub.
