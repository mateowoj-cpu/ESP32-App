# Kolejny krok po full-compile closure

Indeks docs: [README.md](./README.md). **Nie oznaczaj Faz 18+ jako ukończonych** bez merge’a funkcji.

## Stan (main · 0.2.10)

- **Fazy 0–17** na `main` (marketplace sandbox publisher bootstrap, board catalog, Unix/Windows packaging CI).
- **Full build closure** — udokumentowana i zweryfikowana ścieżka: `npm run smoke` + `cargo check` (+ Linux AppImage/deb w środowisku Linux). Checklist: [developer-setup.md](./developer-setup.md) § „Pełna kompilacja”; skrypt `npm run compile:full` / `scripts/full-compile.sh`.
- **Docs** — README + [architecture.md](./architecture.md) opisują IPC / macierz build; indeks: [README.md](./README.md).

## Priorytety dalej (kolejność)

1. **Faza 18 — Ops live path** — winget-pkgs merge checklist execution + telemetry collector hosting runbook (human secrets / infra; repo tylko checklisty i ewentualne CI draft polish).
2. Authenticode EV na self-hosted / cloud HSM w praktyce (sekrety + runner — human).
3. Apple notarize secrets na CI (human) + App Store Connect API key path w skrypcie.
4. Dodatkowe signed community packs (live publishers, nie sandbox) + allowlista hostów gdy potrzeba.
5. Dalsze i18n / UX polish.

## Human-only (nie blokuje compile w kodzie)

- Authenticode / EV + SmartScreen reputation
- Apple notarize secrets / Team ID
- `WINGET_GITHUB_TOKEN` + merge PR w `microsoft/winget-pkgs`
- `TAURI_SIGNING_PRIVATE_KEY` na signed Unix updater artifacts
- Live `VITE_TELEMETRY_ENDPOINT` + retencja po stronie collectora
- Live marketplace publisher private keys (offline keygen — nie commituj; sandbox demo ≠ live)
- Windows NSIS/MSI oraz macOS dmg wymagają hostów CI / maszyn natywnych (nie Linux-only agent)
