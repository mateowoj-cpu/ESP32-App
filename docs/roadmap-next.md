# Kolejny krok po Fazie 14

Indeks docs: [README.md](./README.md). **Nie oznaczaj Faz 15+ jako ukończonych** bez merge’a funkcji.

## Stan po Fazie 14

- **Community marketplace** — katalog widgetów / reguł (`public/marketplace/`), import/export JSON z walidacją schematu, sandbox bez `eval` / arbitrary code (`src/platform/marketplace.ts`, UI `MarketplaceView`)
- **EV code signing + SmartScreen** — rozszerzone checklisty [windows-smartscreen.md](./windows-smartscreen.md) / [windows-signing.md](./windows-signing.md) (sekrety człowieka; brak fałszywych certów w repo)
- **Community board catalog** — więcej VID:PID / konserwatywne offsety flash w `public/board-profiles/community.json` (+ bundled mirror); źródła udokumentowane; wpisy PLACEHOLDER oznaczone
- **Unix release polish** — [macos-notarize.md](./macos-notarize.md); AppImage smoke `workflow_dispatch` only; skrypt multi-platform `latest.json` gdy signed
- Linia wersji **0.2.7**

## Faza 15 (rekomendowana)

1. **Plugin API marketplace** — manifest schema v2, podpis paczek community, remote pack fetch z allowlistą hostów
2. **Live winget** — merge do `microsoft/winget-pkgs` po pierwszym signed `v0.2.7` (SHA już liczy CI draft)
3. **Telemetry collector ops** — endpoint `VITE_TELEMETRY_ENDPOINT` + retencja / opt-out docs
4. **Unix updater artifacts** — opcjonalne `createUpdaterArtifacts: true` na signed tagach + attach multi-platform `latest.json` z CI

## Faza 16+ (backlog)

- Głębsze i18n pozostałych hardkodów (FlashHelper statusy PL, identifyEsp32 feature strings)
- Self-hosted Windows runner + EV token / cloud HSM w `windows-release.yml`
- macOS notarize kroki w CI gdy sekrety Apple obecne (dziś docs-only hooks)
- Board catalog: community PR flow + automatyczna walidacja offsetów vs esptool chip family
