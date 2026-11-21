# macOS codesign + notarize (Faza 14–16)

Windows pozostaje główną ścieżką Authenticode / winget.  
Pakiet `.dmg` z [desktop-release.yml](../.github/workflows/desktop-release.yml) buduje się **bez** notarize, dopóki nie ustawisz sekretów Apple.

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
chmod +x scripts/unix/macos-notarize-dmg.sh
./scripts/unix/macos-notarize-dmg.sh
# lub ręcznie:
xcrun notarytool submit path/to/ESP32*.dmg \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
xcrun stapler staple path/to/ESP32*.dmg
```

5. Smoke na czystym Macu: otwórz `.dmg`, przeciągnij app, uruchom bez Gatekeeper quarantine warning.

## Podpisywanie w CI

Macierz [Desktop Release](./desktop-unix.md) buduje DMG Apple Silicon i Intel. Preview stosuje podpis ad-hoc. Dla draftu ustaw `DESKTOP_SYSTEM_SIGNED=true` i sekrety `APPLE_CERTIFICATE` (Base64 P12), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` (hasło aplikacji) i `APPLE_TEAM_ID`. Tauri podpisuje i notaryzuje aplikację, a workflow kontroluje podpis i ticket. Na czystym Macu sprawdź także otwieranie pobranego DMG i uruchomienie z Applications.

## Updater multi-platform

Notarize ≠ podpis updatera Tauri. Multi-platform `latest.json` (gdy signed) opisuje [desktop-unix.md](./desktop-unix.md) oraz skrypt `scripts/unix/build-multiplatform-latest-json.sh`.

## Powiązane

- [desktop-unix.md](./desktop-unix.md)
- [windows-signing.md](./windows-signing.md) (analog Windows)
- [windows-updater.md](./windows-updater.md)
