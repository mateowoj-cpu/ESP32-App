# winget-pkgs PR body template (Faza 10)

Use after a **signed** GitHub Release `v0.2.2` (or later) is published. Do **not** invent
InstallerSha256 or credentials — fill them from the real release asset.

## Suggested PR title

```text
New package: Studio.ESP32DisplayStudio version 0.2.2
```

(For updates: `Update Studio.ESP32DisplayStudio to 0.2.x`)

## Suggested PR body

```markdown
## Description
Adds / updates **Studio.ESP32DisplayStudio** (ESP32 Display Studio).

- Publisher: ESP32 Display Studio
- Package: visual OLED/LCD studio + native COM + Build/Flash/OTA for ESP32
- Installer: NSIS user-scope from GitHub Releases
- Version: 0.2.2
- Installer URL: https://github.com/mateowoj-cpu/ESP32-App/releases/download/v0.2.2/ESP32.Display.Studio_0.2.2_x64-setup.exe
- SHA256: <paste from Get-FileHash>

## Validation
- [ ] Manifest YAML validated with `winget validate`
- [ ] Local install: `winget install --manifest manifests/s/Studio/ESP32DisplayStudio/0.2.2`
- [ ] Installer is Authenticode-signed (SmartScreen)

## Notes
Local manifest copy lives in this repo under
`packaging/winget/ESP32DisplayStudio/manifests/s/Studio/ESP32DisplayStudio/0.2.2/`.
```

## Human checklist (no secrets in git)

1. CI secrets present: `TAURI_SIGNING_PRIVATE_KEY`, optional `WINDOWS_CERTIFICATE*`
2. Tag `v0.2.2` → `windows-release.yml` produces NSIS `.exe`
3. `Get-FileHash .\ESP32.Display.Studio_*_x64-setup.exe -Algorithm SHA256`
4. Replace `REPLACE_WITH_SHA256_OF_NSIS_INSTALLER` in the YAML
5. Open PR against [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs)
6. Path in upstream: `manifests/s/Studio/ESP32DisplayStudio/0.2.2/`
