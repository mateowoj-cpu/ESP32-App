# Instalator Windows (NSIS + MSI)

ESP32 Display Studio buduje dwa cele Windows przez Tauri 2:

| Target | Plik | Uwagi |
|--------|------|--------|
| **NSIS** | `.exe` | Interaktywny instalator, wybór języka PL/EN, tryb *current user* |
| **MSI** | `.msi` | WiX **en-US** only, stały `upgradeCode` (aktualizacje in-place) |

## Języki: aplikacja vs instalatory

- **Aplikacja** (UI) — i18n PL/EN w `src/i18n/` (niezależne od instalatora).
- **NSIS** — `Polish` + `English` z selektorem; własne stringi Tauri dla PL w `src-tauri/windows/nsis-languages/Polish.nsh` (`customLanguageFiles.Polish`, ścieżka względem `src-tauri/`).
- **MSI (WiX)** — tylko `en-US`. WiX 3 `light.exe` używa codepage **1252** dla metadanych produktu; polskie znaki (ą, ć, ę, ł, ń, ó, ś, ź, ż) powodują **LGHT0311**. Dlatego:
  - `bundle.windows.wix.language` = mapa `{ "en-US": {} }` (bez `pl-PL`) w `tauri.conf.json`,
  - język MSI konfiguruje `src-tauri/tauri.windows.conf.json`,
  - `copyright` / `shortDescription` / `longDescription` / opisy skojarzeń plików — ASCII (EN), bez diakrytyków i bez znaku `©` (używaj `(C)`),
  - preflight CI: `node scripts/windows/assert-msi-ascii-config.mjs`.

Przywrócenie MSI `pl-PL` wymagałoby osobnego `.wxl` z `Codepage=1250` (`WixLanguageConfig.localePath`) — poza obecnym zakresem release.

### Klucze Tauri 2 (zweryfikowane względem schema / bundler 2.12.x)

| Cel | Klucz JSON | Uwagi |
|-----|------------|--------|
| Języki MSI | `bundle.windows.wix.language` | string, tablica **lub** mapa `{ "en-US": { "localePath"?: "..." } }` |
| Języki NSIS | `bundle.windows.nsis.languages` | np. `["Polish","English"]` (nazwy NSIS, nie `pl-PL`) |
| Tłumaczenia custom NSIS | `bundle.windows.nsis.customLanguageFiles.Polish` | ścieżka `.nsh` względem katalogu `tauri.conf.json` |

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

Workflow `desktop-release.yml` buduje NSIS, MSI i agenta przed dołączeniem plików do wspólnego draftu. Domyślny runner `windows-2022` wykonuje kontrolę WiX en-US i ASCII. Tryby podpisywania i ponawianie wydania opisuje [konfiguracja CI](./desktop-unix.md).

Po udanym buildzie log musi zawierać tylko:

```
Running light to produce ..._x64_en-US.msi
```

i **nie** `..._pl-PL.msi` / `LGHT0311` / ostrzeżenia `Custom tauri messages for Polish`.

## Instalacja u użytkownika końcowego

1. Pobierz podpisany instalator z Releases.
2. Uruchom NSIS `.exe` (zalecane) lub MSI.
3. Jeśli SmartScreen ostrzega — sprawdź wydawcę / użyj oficjalnego linku.
4. Uruchom aplikację → **Wykryj ESP32 (USB)**.
5. Gdy brak COMx → [windows-drivers.md](./windows-drivers.md).

## Powiązane

- [Sterowniki USB](./windows-drivers.md)
- [Podpis Authenticode](./windows-signing.md)
