# Kolejny krok po Fazie 4

## Stan po Fazie 4

- Agent PC (Python + build `.exe`, start/stop w Tauri, Releases)
- Auto-update (plugin updater + pubkey + CI secrets)
- Wcześniej: Serial native, NSIS/MSI, docs sterowników/podpisu

## Faza 5 (rekomendowana) — Flash & Deep Link

Cel: domknąć pętlę „zaprojektuj UI → wgraj na ESP32” bez ręcznego Arduino IDE.

Zakres:

1. **Flash helper** — sidecar / wrapper `esptool` (wybór COM, baud, `.bin`/`.ino` build via PlatformIO CLI opcjonalnie)
2. **Deep link / file association** — otwieranie `.ino` / project JSON z Explorera Windows w Studio
3. **Smoke CI na PR** — `windows-latest`: `npm ci`, `lint`, `build`, (opcjonalnie) build PC agent bez pełnego `tauri build`
4. **Tray / autostart agenta PC** — opcjonalnie skrót „uruchom agenta z Windows”

Dlaczego to następne: Fazy 0–4 dają środowisko Windows + COM + instalator + update + telemetrię PC. Brakuje jeszcze jednego-click wgrania firmware i twardej bramki jakości na każdym PR.

## Faza 6 (później) — Polish produktowy

- Podpisane auto-update end-to-end na prawdziwym certyfikacie + pierwsze publiczne `v0.2.0`
- GPU AMD/Intel (opcjonalnie LibreHardwareMonitor / Performance Counters)
- Lokalizacja EN UI
- Auto-update kanału `beta` vs `stable`
