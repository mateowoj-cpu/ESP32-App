# Kolejny krok po Fazie 7

## Stan po Fazie 7

- Build-from-Studio: PlatformIO / arduino-cli → `.bin` → esptool
- UI: Build / Flash / Build+Flash w widoku USB
- Profile płytki z wykrytego ESP32
- Wcześniej: Serial, installer, agent PC, updater, tray, i18n, deep link, smoke CI

## Faza 8 (rekomendowana) — Product polish & dystrybucja

1. **Pełne tłumaczenie** pozostałych widoków (nie tylko chrome)
2. **winget / signed public release** `v0.2.x` z Authenticode + updater E2E
3. **Opt-in diagnostyka** flash/COM (logi do pliku, bez telemetrii chmurowej)
4. **Board presets cache** — zapamiętaj ostatni udany env PIO / offset flash per VID:PID

## Faza 9 (opcjonalna)

- Wbudowany / sidecare’owany PlatformIO Core (offline installer)
- OTA update firmware przez Wi‑Fi z Studio
