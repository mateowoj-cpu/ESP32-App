# winget + signed public release (Faza 8 → 12)

## Cel

Dystrybucja ESP32 Display Studio przez **winget** po podpisaniu instalatora Authenticode i opublikowaniu tagu `v0.2.x`.

## Checklista live winget-pkgs (Faza 12)

1. Sekrety CI (tylko w GitHub Actions / lokalnym sejfie — **nie w git**): `TAURI_SIGNING_PRIVATE_KEY`, opcjonalnie `WINDOWS_CERTIFICATE*`
2. Tag `v0.2.5` (lub wcześniejszy signed `v0.2.4`) → workflow `windows-release.yml`
3. Opcjonalnie: workflow `windows-penv-artifact.yml` → artifact penv → `Stage-PlatformIoPenv.ps1` przed bundlem
4. Pobierz NSIS `.exe` z releasu, policz SHA256:

```powershell
Get-FileHash .\ESP32.Display.Studio_*_x64-setup.exe -Algorithm SHA256
```

5. Uzupełnij `packaging/winget/.../0.2.5/Studio.ESP32DisplayStudio.yaml`:
   - `InstallerUrl`
   - `InstallerSha256` (zamień `REPLACE_WITH_SHA256_OF_NSIS_INSTALLER` — **nie wymyślaj hasha**)
6. Skopiuj treść z [`packaging/winget/ESP32DisplayStudio/PR_BODY.md`](../packaging/winget/ESP32DisplayStudio/PR_BODY.md)
7. PR do [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs):

```text
manifests/s/Studio/ESP32DisplayStudio/0.2.5/
```

Lokalny test:

```powershell
winget install --manifest packaging\winget\ESP32DisplayStudio\manifests\s\Studio\ESP32DisplayStudio\0.2.5
```

8. Po instalacji: monitoring SmartScreen — [windows-smartscreen.md](./windows-smartscreen.md).

## Uwagi

- Nazwa pliku NSIS zależy od `productName` / wersji Tauri — dopasuj URL do faktycznego assetu.
- Bez Authenticode SmartScreen może blokować instalację; zob. [windows-signing.md](./windows-signing.md).
- Kanał updatera stable czyta `latest.json` z `releases/latest`.
- Szablony `0.2.1` / `0.2.2` / `0.2.4` zostają w drzewie jako referencja.
- **Human-only:** rzeczywisty PR do `microsoft/winget-pkgs` i prawdziwy SHA256 instalatora — poza agentem.
