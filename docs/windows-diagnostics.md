# Diagnostyka flash/COM (opt-in)

Lokalny log diagnostyczny — **bez telemetrii chmurowej** (opcjonalna sieć: [telemetry.md](./telemetry.md), osobny przełącznik, domyślnie off).

## Włączenie

**Ustawienia → Desktop → Diagnostyka flash/COM**

Log: `%LOCALAPPDATA%\studio.esp32.display\diagnostics\studio.log` (Windows)  
Na Linux/macOS: katalog `diagnostics` w app local data Tauri (zob. [desktop-unix.md](./desktop-unix.md)).

Przycisk „Otwórz folder logów”.

## Eksport ZIP (Faza 12)

**Ustawienia → Desktop → Eksportuj diagnostykę ZIP**

Tworzy paczkę supportową:

| Plik | Zawartość |
|------|-----------|
| `manifest.json` | OS/arch, flaga enabled, rozmiar logu, timestamp |
| `studio.log` | lokalny log (lub placeholder jeśli pusty) |
| `extra/*` | opcjonalne `.log` / `.txt` / `.json` z folderu diagnostyki |

Dialog zapisu (Tauri) albo domyślna ścieżka w folderze `diagnostics/`.  
Studio **nie wysyła** ZIP nigdzie — dołączasz go ręcznie do issue / supportu.

## Co trafia do logu

- Wyniki **Build** / **Flash** / **OTA** (komunikat, port, chip, offset)
- Tylko gdy przełącznik jest włączony (preferencja w `localStorage` + flaga w shellu Tauri)

## Board presets cache + sync

Po udanym build/flash Studio zapamiętuje per `VID:PID` (+ port):

- chip / offset / baud / board profile

Przy kolejnym podłączeniu tej samej płytki wartości wracają automatycznie (`localStorage`).

**Synchronizuj profile płytek (community)** pobiera katalog z
`public/board-profiles/community.json` (GitHub `main`) i scala do lokalnego cache.
Bez sieci używa katalogu bundlowanego w aplikacji.
