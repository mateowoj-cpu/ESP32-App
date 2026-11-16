# Kolejny krok po Fazie 16

Indeks docs: [README.md](./README.md). **Nie oznaczaj Faz 17+ jako ukończonych** bez merge’a funkcji.

## Stan po Fazie 16

- **Board catalog PR validation** — `boardCatalogValidate` + `npm run test:board-catalog` + [board-catalog.md](./board-catalog.md) (offset ↔ esptool chip, community PR flow)
- **Głębsze i18n identify** — `chipModelKey` / `architectureKey` / `bootLogKey` (PL/EN) w `identifyEsp32` + UsbDetectorView
- **EV HSM / self-hosted Windows** — `Resolve-CodeSigningOverlay.ps1`, input/var `runner` / `WINDOWS_RUNNER`, thumbprint-only path ([windows-signing.md](./windows-signing.md))
- **macOS notarize CI** — opcjonalny import `.p12` + `macos-notarize-dmg.sh` gdy sekrety Apple obecne ([macos-notarize.md](./macos-notarize.md))
- Linia wersji **0.2.9**

## Priorytety dalej (kolejność)

1. **Faza 17 — Marketplace live publisher bootstrap** — onboarding publisherów: docs + szablon `publishers.json`, przykładowe **sandbox** signed packs w katalogu (klucze demo wyraźnie oznaczone; prawdziwe live keys = human offline keygen). Marketplace nadal **data-only / no eval**.
2. Live merge `winget-pkgs` + hosting collectora telemetrii (ops poza repo; checklisty już w docs).
3. Authenticode EV na self-hosted / cloud HSM w praktyce (sekrety + runner — human).
4. Apple notarize secrets na CI (human) + ewentualnie App Store Connect API key path.
5. Dalsze i18n / UX polish poza identify USB.

## Human-only (nie blokuje Fazy 16 w kodzie)

- Authenticode / EV + SmartScreen reputation
- Apple notarize secrets / Team ID
- `WINGET_GITHUB_TOKEN` + merge PR w `microsoft/winget-pkgs`
- `TAURI_SIGNING_PRIVATE_KEY` na signed Unix updater artifacts
- Live `VITE_TELEMETRY_ENDPOINT` + retencja po stronie collectora
- Marketplace publisher private keys (offline keygen — nie commituj)
