# winget + signed public release (Faza 8 → 9)

## Cel

Dystrybucja ESP32 Display Studio przez **winget** po podpisaniu instalatora Authenticode i opublikowaniu tagu `v0.2.x`.

## Checklista release `v0.2.2`

1. Sekrety CI: `TAURI_SIGNING_PRIVATE_KEY`, opcjonalnie `WINDOWS_CERTIFICATE*`
2. Tag `v0.2.2` → workflow `windows-release.yml`
3. Pobierz NSIS `.exe` z releasu, policz SHA256:

```powershell
Get-FileHash .\ESP32.Display.Studio_*_x64-setup.exe -Algorithm SHA256
```

4. Uzupełnij `packaging/winget/.../0.2.2/Studio.ESP32DisplayStudio.yaml`:
   - `InstallerUrl`
   - `InstallerSha256`
5. PR do [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs):

```text
manifests/s/Studio/ESP32DisplayStudio/0.2.2/
```

Lokalny test:

```powershell
winget install --manifest packaging\winget\ESP32DisplayStudio\manifests\s\Studio\ESP32DisplayStudio\0.2.2
```

## Szablon PR do winget-pkgs

Tytuł: `New package: Studio.ESP32DisplayStudio version 0.2.2`

Treść (skrót):

- Publisher: ESP32 Display Studio
- Package: visual OLED/LCD studio + COM + Build/Flash/OTA for ESP32
- Installer: NSIS user-scope from GitHub Releases `v0.2.2`
- SHA256: *(wklej z Get-FileHash)*

## Uwagi

- Nazwa pliku NSIS zależy od `productName` / wersji Tauri — dopasuj URL do faktycznego assetu.
- Bez Authenticode SmartScreen może blokować instalację; zob. [windows-signing.md](./windows-signing.md).
- Kanał updatera stable czyta `latest.json` z `releases/latest`.
- Starszy szablon `0.2.1` zostaje w drzewie jako referencja.
