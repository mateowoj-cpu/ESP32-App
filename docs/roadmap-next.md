# Kolejny krok po Fazie 9

## Stan po Fazie 9

- Sidecar / offline PlatformIO Core (resolve bez PATH + `Install-PlatformIoSidecar.ps1`)
- OTA firmware Wi‑Fi ze Studio (`espota` / HTTP `/update`) + ArduinoOTA w generatorze C++
- Chrome i18n PL/EN dla symulatora, edytora, automatyzacji (+ ustawienia OTA)
- Przygotowanie winget `0.2.2` + checklista PR do `winget-pkgs`
- Wersja linii **0.2.2**

## Faza 10 (rekomendowana)

1. **Pełne tłumaczenia** pozostałych stringów w głębokich panelach (widgety, kreator reguł, timeline)
2. **Bundling penv PIO** opcjonalnie w instalatorze signed (offline CI artifact → NSIS resources)
3. **mDNS discovery** urządzeń OTA w LAN (lista hostów zamiast ręcznego IP)
4. Publikacja `Studio.ESP32DisplayStudio` w [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) po podpisanym `v0.2.2`
