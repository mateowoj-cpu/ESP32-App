# Kolejny krok po Fazie 15

Indeks docs: [README.md](./README.md). **Nie oznaczaj Faz 16+ jako ukończonych** bez merge’a funkcji.

## Stan po Fazie 15

- **Plugin API marketplace** — manifest v2, Ed25519 podpisy paczek (data-only), allowlista hostów remote fetch (`src/platform/marketplace.ts`, [marketplace-plugin-api.md](./marketplace-plugin-api.md))
- **Live winget prep** — szablon `0.2.8` + checklista merge do `microsoft/winget-pkgs` (SHA z CI draft; merge = human) ([windows-winget.md](./windows-winget.md))
- **Telemetry ops** — `VITE_TELEMETRY_ENDPOINT`, retencja / opt-out / checklista collectora ([telemetry.md](./telemetry.md))
- **Unix updater polish** — `tauri.*.signed.json` (`createUpdaterArtifacts: true` gdy sekret), job multi-platform `latest.json` bez wymyślanych signature
- **i18n** — FlashHelper statusy + `identifyEsp32` feature keys (PL/EN)
- Linia wersji **0.2.8**

## Faza 16+ (backlog)

- Głębsze i18n pozostałych hardkodów (`chipModel` / `architecture` / boot-log PL w `identifyEsp32`, tytuły FlashHelper)
- Self-hosted Windows runner + EV token / cloud HSM w `windows-release.yml`
- macOS notarize kroki w CI gdy sekrety Apple obecne (dziś docs-only hooks)
- Board catalog: community PR flow + automatyczna walidacja offsetów vs esptool chip family
- Live publisher keys w `public/marketplace/publishers.json` + signed community packs w katalogu
- Live merge `winget-pkgs` + hosting collectora telemetrii (ops poza repo)

## Human-only (nie blokuje Fazy 15 w kodzie)

- Authenticode / EV + SmartScreen reputation
- Apple notarize secrets
- `WINGET_GITHUB_TOKEN` + merge PR w `microsoft/winget-pkgs`
- `TAURI_SIGNING_PRIVATE_KEY` na signed Unix updater artifacts
- Live `VITE_TELEMETRY_ENDPOINT` + retencja po stronie collectora
- Marketplace publisher private keys (offline keygen)
