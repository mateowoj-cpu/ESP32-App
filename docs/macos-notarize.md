# macOS codesign + notarize (opcjonalnie, Faza 14)

Windows pozostaje główną ścieżką Authenticode / winget.  
Pakiet `.dmg` z [desktop-unix-release.yml](../.github/workflows/desktop-unix-release.yml) buduje się **bez** notarize — ten dokument to checklista człowieka, gdy chcesz dystrybuować macOS poza „Right-click → Open”.

**Nie commituj** Apple ID, app-specific passwords, `.p12`, ani Team ID jako sekretów w gicie.

## Wymagania Apple

- Apple Developer Program (płatne konto)
- Certyfikat **Developer ID Application** (do dystrybucji poza Mac App Store)
- Opcjonalnie: **Developer ID Installer** jeśli bundlujesz `.pkg`
- App-specific password lub API key App Store Connect do `notarytool`
- Maszyna / runner **macOS** z Xcode CLT

## Lokalny flow (Tauri 2)

1. Zainstaluj certyfikat Developer ID w Keychain.
2. Ustaw zmienne (przykład — wartości tylko lokalnie / w CI secrets):

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
# opcjonalnie notarize:
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"
```

3. Zbuduj z nakładką Unix:

```bash
npm run tauri:build -- --config src-tauri/tauri.macos.json
```

Tauri 2 użyje identity z env, gdy jest ustawione. Bez identity powstaje niepodpisany `.dmg` (OK do smoke).

4. Notarize (gdy podpisano):

```bash
xcrun notarytool submit path/to/ESP32*.dmg \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
xcrun stapler staple path/to/ESP32*.dmg
```

5. Smoke na czystym Macu: otwórz `.dmg`, przeciągnij app, uruchom bez Gatekeeper quarantine warning.

## CI hooks (opcjonalne sekrety)

Workflow `desktop-unix-release.yml` job `macos-dmg` **nie wymaga** tych sekretów. Gdy są ustawione u właściciela, można dodać kroki (ręcznie / follow-up):

| Secret / env | Opis |
|--------------|------|
| `APPLE_CERTIFICATE` | Base64 `.p12` Developer ID |
| `APPLE_CERTIFICATE_PASSWORD` | Hasło `.p12` |
| `APPLE_SIGNING_IDENTITY` | Pełna nazwa identity |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | notarytool |
| lub `APP_STORE_CONNECT_API_KEY` + issuer | preferowane przez Apple dla CI |

Bez sekretów: artefakt `.dmg` jak dziś (unsigned smoke).  
**Nie** włączaj notarize na PR — tylko tag `v*` / `workflow_dispatch` release.

## Updater multi-platform

Notarize ≠ podpis updatera Tauri. Multi-platform `latest.json` (gdy signed) opisuje [desktop-unix.md](./desktop-unix.md) oraz skrypt `scripts/unix/build-multiplatform-latest-json.sh`.

## Powiązane

- [desktop-unix.md](./desktop-unix.md)
- [windows-signing.md](./windows-signing.md) (analog Windows)
- [windows-updater.md](./windows-updater.md)
