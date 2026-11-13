# Kolejny krok po Fazie 13

## Stan po Fazie 13

- **CI desktop non-Windows** — workflow `desktop-unix-release.yml` (AppImage/deb na Ubuntu, `.dmg` na macOS); nakładki `tauri.linux.json` / `tauri.macos.json` (bez store submit)
- **Opt-in telemetria** — przełącznik w Ustawienia → Desktop; klient `src/platform/telemetry.ts`; docs [telemetry.md](./telemetry.md); domyślnie wyłączona, bez PII
- **Draft winget z CI** — `scripts/winget/prepare-draft-manifest.sh` + `winget-draft.yml` (SHA z prawdziwego assetu; opcjonalny draft PR gdy `WINGET_GITHUB_TOKEN`)
- **Głębsze i18n** — modal pinout + katalog USB / monitor / błędy portów (PL/EN)
- Linia wersji **0.2.6**

## Faza 14 (rekomendowana)

1. **Community marketplace** — widgety UI / reguły automatyzacji (katalog + import JSON, sandbox bez arbitrary code)
2. **EV code signing + SmartScreen** — kontynuacja checklisty [windows-smartscreen.md](./windows-smartscreen.md) / [windows-signing.md](./windows-signing.md) (sekrety człowieka)
3. **Rozszerzenie community board catalog** — więcej VID:PID / offsetów flash w `public/board-profiles/community.json`
4. **Unix release polish** — codesign/notarize macOS (opcjonalnie), AppImage smoke na PR `workflow_dispatch` only, auto-attach do `latest.json` multi-platform gdy signed

## Faza 15+ (backlog)

- Live `microsoft/winget-pkgs` po pierwszym signed `v0.2.6` (ludzki SHA już liczy CI — zostaje review/merge)
- Telemetry collector endpoint ops (`VITE_TELEMETRY_ENDPOINT`) + retencja / opt-out docs
- Plugin API dla community marketplace (manifest schema, signing)
- Głębsze i18n pozostałych hardkodów (FlashHelper statusy PL, identifyEsp32 feature strings)
