# winget + signed public release (Faza 8 → 10)

## Cel

Dystrybucja ESP32 Display Studio przez **winget** po podpisaniu instalatora Authenticode i opublikowaniu tagu `v0.2.x`.

## Checklista release `v0.2.2` (pierwszy PR do winget-pkgs)

1. Sekrety CI (tylko w GitHub Actions / lokalnym sejfie — **nie w git**): `TAURI_SIGNING_PRIVATE_KEY`, opcjonalnie `WINDOWS_CERTIFICATE*`
2. Tag `v0.2.2` → workflow `windows-release.yml`
3. Pobierz NSIS `.exe` z releasu, policz SHA256:

```powershell
Get-FileHash .\ESP32.Display.Studio_*_x64-setup.exe -Algorithm SHA256
```

4. Uzupełnij `packaging/winget/.../0.2.2/Studio.ESP32DisplayStudio.yaml`:
   - `InstallerUrl`
   - `InstallerSha256` (zamień `REPLACE_WITH_SHA256_OF_NSIS_INSTALLER`)
5. Skopiuj treść z [`packaging/winget/ESP32DisplayStudio/PR_BODY.md`](../packaging/winget/ESP32DisplayStudio/PR_BODY.md)
6. PR do [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs):

```text
manifests/s/Studio/ESP32DisplayStudio/0.2.2/
```

Lokalny test:

```powershell
winget install --manifest packaging\winget\ESP32DisplayStudio\manifests\s\Studio\ESP32DisplayStudio\0.2.2
```

## Uwagi

- Nazwa pliku NSIS zależy od `productName` / wersji Tauri — dopasuj URL do faktycznego assetu.
- Bez Authenticode SmartScreen może blokować instalację; zob. [windows-signing.md](./windows-signing.md).
- Kanał updatera stable czyta `latest.json` z `releases/latest`.
- Starszy szablon `0.2.1` zostaje w drzewie jako referencja.
- Linia aplikacji może być `0.2.3+` zanim winget-pkgs przyjmie pierwszy PR `0.2.2` — trzymaj SHA zgodny z tagiem, który publikujesz.