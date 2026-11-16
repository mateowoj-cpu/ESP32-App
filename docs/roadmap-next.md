# Kolejny krok po Fazie 17

Indeks docs: [README.md](./README.md). **Nie oznaczaj Faz 18+ jako ukończonych** bez merge’a funkcji.

## Stan po Fazie 17

- **Marketplace publisher bootstrap** — `studio-sandbox` public key + signed fixture `status-strip-signed`, [marketplace-publishers.md](./marketplace-publishers.md), bundled publishers fallback
- Faza 16 (w bazie stack): board catalog validation, identify i18n, EV HSM hooks, macOS notarize CI
- Linia wersji **0.2.10** (stack na 0.2.9 / Faza 16)

## Priorytety dalej (kolejność)

1. **Faza 18 — Ops live path** — winget-pkgs merge checklist execution + telemetry collector hosting runbook (human secrets / infra; repo tylko checklisty i ewentualne CI draft polish).
2. Authenticode EV na self-hosted / cloud HSM w praktyce (sekrety + runner — human).
3. Apple notarize secrets na CI (human) + App Store Connect API key path w skrypcie.
4. Dodatkowe signed community packs (live publishers, nie sandbox) + allowlista hostów gdy potrzeba.
5. Dalsze i18n / UX polish.

## Human-only (nie blokuje Fazy 17 w kodzie)

- Authenticode / EV + SmartScreen reputation
- Apple notarize secrets / Team ID
- `WINGET_GITHUB_TOKEN` + merge PR w `microsoft/winget-pkgs`
- `TAURI_SIGNING_PRIVATE_KEY` na signed Unix updater artifacts
- Live `VITE_TELEMETRY_ENDPOINT` + retencja po stronie collectora
- Live marketplace publisher private keys (offline keygen — nie commituj; sandbox demo ≠ live)
