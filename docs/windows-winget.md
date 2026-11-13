# winget + signed public release (Faza 8)

## Cel

Dystrybucja ESP32 Display Studio przez **winget** po podpisaniu instalatora Authenticode i opublikowaniu tagu `v0.2.x`.

## Checklista release `v0.2.1`

1. Sekrety CI: `TAURI_SIGNING_PRIVATE_KEY`, opcjonalnie `WINDOWS_CERTIFICATE*`
2. Tag `v0.2.1` → workflow `windows-release.yml`
3. Pobierz NSIS `.exe` z releasu, policz SHA256:

```powershell
Get-FileHash .\ESP32.Display.Studio_*_x64-setup.exe -Algorithm SHA256
```

4. Uzupełnij `packaging/winget/.../Studio.ESP32DisplayStudio.yaml`:
   - `InstallerUrl`
   - `InstallerSha256`
5. PR do [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) (lub lokalny test):

```powershell
winget install --manifest packaging\winget\ESP32DisplayStudio\manifests\s\Studio\ESP32DisplayStudio\0.2.1
```

## Uwagi

- Nazwa pliku NSIS zależy od `productName` / wersji Tauri — dopasuj URL do faktycznego assetu.
- Bez Authenticode SmartScreen może blokować instalację; zob. [windows-signing.md](./windows-signing.md).
- Kanał updatera stable czyta `latest.json` z `releases/latest`.
