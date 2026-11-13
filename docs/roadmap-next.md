# Kolejny krok po Fazie 6

## Stan po Fazie 6

- Tray + close-to-tray, autostart Studio / agenta PC
- i18n PL/EN (chrome + panel Desktop)
- Kanały update stable / beta
- Bump wersji **0.2.0** (gotowość do podpisanego releasu)
- GPU: NVIDIA + best-effort Windows `typeperf` (AMD/Intel)
- Wcześniej: Serial, NSIS/MSI, agent `.exe`, flash, deep link, smoke CI

## Faza 7 (rekomendowana) — Build-from-Studio

1. Integracja **PlatformIO CLI** / `arduino-cli` (wykryj w PATH)
2. Kompilacja wygenerowanego `.ino` → `.bin` z poziomu Studio
3. Jeden przepływ: **Generate → Build → Flash** (esptool)
4. Opcjonalnie cache toolchain / board profile z wykrytego ESP32

## Faza 8 (później)

- Pełne tłumaczenie pozostałych widoków
- Publiczny signed store / winget
- Telemetria diagnostyczna (opt-in) dla flash/COM
