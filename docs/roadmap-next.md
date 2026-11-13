# Kolejny krok po Fazie 10

## Stan po Fazie 10

- Pełniejsze i18n PL/EN głębokich paneli (widgety edytora, szablony reguł, OTA/mDNS, Wi‑Fi/ustawienia, chrome symulatora)
- Bundling penv PIO: `Stage-PlatformIoPenv.ps1` → `resources/sidecar/**/*` w signed installer (penv gitignored; bez sekretów w repo)
- **mDNS discovery** OTA w LAN (`discover_ota_hosts` — `_arduino._tcp` / `_http._tcp`) + UI listy hostów
- Przygotowanie publikacji winget: szablon YAML `0.2.2` + `packaging/winget/.../PR_BODY.md` (SHA256 / credentials tylko u człowieka)
- Audit UI: kontrast hintów, `cursor-pointer` / touch targets, usunięcie purple glow slop w szablonach reguł, `aria-live` status OTA
- Linia wersji **0.2.3** (winget pierwszego signed release może pozostać `v0.2.2` — uzupełnij SHA w manifeście)

## Faza 11 (rekomendowana)

1. **Dokończenie i18n treści** — nazwy kroków timeline / presetów cyber-pet, komunikaty pinout/GPIO, IntegrationsView (miasta, agent PC) w 100% przez słownik
2. **winget-pkgs live** — po Authenticode `v0.2.2`/`v0.2.3`: SHA256 → PR do microsoft/winget-pkgs (patrz `PR_BODY.md`)
3. **CI artifact penv** — opcjonalny job Windows budujący i cache’ujący penv (artifact, nie git) pod `Stage-PlatformIoPenv.ps1`
4. **mDNS UX** — filtr po `mdnsName` projektu, preferencja IPv4, zapamiętanie ostatnich hostów OTA
5. **Hardening OTA** — timeout UI, cancel in-flight, lepsze mapowanie błędów espota/HTTP

## Faza 12+ (backlog)

- Store / SmartScreen reputation po pierwszym signed winget
- Telemetria diagnostyczna opt-in (już jest lokalny log) → eksport ZIP
- Board profiles online sync / community presets
- Linux/macOS desktop parity (serial + OTA) poza Windows-first
