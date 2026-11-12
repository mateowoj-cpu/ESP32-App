# Instalator Windows (NSIS + MSI)

ESP32 Display Studio buduje dwa cele Windows przez Tauri 2:

| Target | Plik | Uwagi |
|--------|------|--------|
| **NSIS** | `.exe` | Interaktywny instalator, wybór języka PL/EN, tryb *current user* |
| **MSI** | `.msi` | WiX, stały `upgradeCode` (aktualizacje in-place) |

## Wymagania builda

Na maszynie **Windows**:

1. Node.js 22 LTS
2. Rust (stable) + target `x86_64-pc-windows-msvc`
3. Visual Studio Build Tools (C++)
4. WebView2 Runtime (zwykle preinstalowany na Win10/11)

```powershell
npm install
npm run tauri:build
```

Artefakty:

```
src-tauri/target/release/bundle/nsis/
src-tauri/target/release/bundle/msi/
```

## Co robi instalator

- Instaluje aplikację (domyślnie dla bieżącego użytkownika — NSIS `currentUser`)
- Dociąga **WebView2 bootstrapper**, jeśli Runtime brakuje (`downloadBootstrapper`, silent)
- Tworzy skrót w menu Start w folderze `ESP32 Display Studio`
- Kopiuje `DRIVERS.txt` i `SIGNING.txt` jako zasoby aplikacji
- NSIS: po instalacji pokazuje przypomnienie o sterownikach COM (hook `installer-hooks.nsh`)

## Upgrade code (MSI)

`bundle.windows.wix.upgradeCode` jest **stały**:

```
a7c3e9f1-5b2d-4e8a-9c1f-6d4b8a2e0f35
```

Nie zmieniaj go między wersjami — Windows traktowałby aplikację jako inną.

`allowDowngrades: false` — nie da się „zejść” na starszą wersję bez odinstalowania.

## CI

Workflow: `.github/workflows/windows-release.yml`

- Trigger: tag `v*` lub ręczne `workflow_dispatch`
- Runner: `windows-latest`
- Opcjonalny podpis Authenticode (sekrety — zob. [windows-signing.md](./windows-signing.md))
- Upload artefaktów jako GitHub Actions artifacts / Release (przy tagu)

## Instalacja u użytkownika końcowego

1. Pobierz podpisany instalator z Releases.
2. Uruchom NSIS `.exe` (zalecane) lub MSI.
3. Jeśli SmartScreen ostrzega — sprawdź wydawcę / użyj oficjalnego linku.
4. Uruchom aplikację → **Wykryj ESP32 (USB)**.
5. Gdy brak COMx → [windows-drivers.md](./windows-drivers.md).

## Powiązane

- [Sterowniki USB](./windows-drivers.md)
- [Podpis Authenticode](./windows-signing.md)
