# Kolejny krok po Fazie 5

## Stan po Fazie 5

- Flash helper (`esptool`) w widoku USB
- Deep link `esp32studio://` + asocjacje `.esp32studio` / `.ino`
- Smoke CI na PR (lint, testy, build, cargo check, agent `--once`)
- Wcześniej: Serial native, NSIS/MSI, agent PC `.exe`, auto-update

## Faza 6 (rekomendowana) — Polish produktowy

1. **Podpisany release `v0.2.0`** — Authenticode + updater E2E na prawdziwym certyfikacie
2. **Tray / autostart agenta PC** — skrót Windows, opcjonalny start z logowaniem
3. **GPU AMD/Intel** (opcjonalnie) — LibreHardwareMonitor / Performance Counters
4. **Lokalizacja EN** UI
5. **Kanał beta vs stable** auto-update

## Faza 7 (opcjonalna) — Build-from-Studio

- Integracja PlatformIO CLI / `arduino-cli` → kompilacja `.ino` → `.bin` bez opuszczania Studio
- Flash jednym przyciskiem: Generate → Build → Write
