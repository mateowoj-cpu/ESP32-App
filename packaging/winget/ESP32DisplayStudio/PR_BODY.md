# winget-pkgs PR body template (Faza 14)

Use after a **signed** GitHub Release `v0.2.7` (or earlier signed `v0.2.6`) is published. Do **not** invent
InstallerSha256 or credentials — fill them from the real release asset (or run
`scripts/winget/prepare-draft-manifest.sh` / workflow `winget-draft.yml`).

## Suggested PR title (first publish)

```text
New package: Studio.ESP32DisplayStudio version 0.2.7
```

(For updates: `Update Studio.ESP32DisplayStudio to 0.2.x`)

## Suggested PR body

```markdown
## Description
Adds / updates **Studio.ESP32DisplayStudio** (ESP32 Display Studio).

- Publisher: ESP32 Display Studio
- Package: visual OLED/LCD studio + native serial + Build/Flash/OTA for ESP32
- Installer: NSIS user-scope from GitHub Releases
- Version: 0.2.7
- Installer URL: https://github.com/mateowoj-cpu/ESP32-App/releases/download/v0.2.7/ESP32.Display.Studio_0.2.7_x64-setup.exe
- SHA256: <paste from Get-FileHash / CI winget-draft artifact — never invent>

## Validation
- [ ] Manifest YAML validated with `winget validate`
- [ ] Local install: `winget install --manifest manifests/s/Studio/ESP32DisplayStudio/0.2.7`
- [ ] Installer is Authenticode-signed (SmartScreen)

## Notes
Local manifest copy lives in this repo under
`packaging/winget/ESP32DisplayStudio/manifests/s/Studio/ESP32DisplayStudio/0.2.7/`.
Older templates `0.2.1`–`0.2.6` remain as reference until the first live winget-pkgs PR lands.
CI can emit a filled draft under `packaging/winget/ESP32DisplayStudio/out/<version>/` (artifact only).
```

## Human checklist (no secrets in git)

1. CI secrets present: `TAURI_SIGNING_PRIVATE_KEY`, optional `WINDOWS_CERTIFICATE*`, optional `WINGET_GITHUB_TOKEN` (draft PR only)
2. Tag `v0.2.7` → `windows-release.yml` produces NSIS `.exe` (optionally download `platformio-penv-windows` artifact from `windows-penv-artifact.yml` and stage before build)
3. Run `winget-draft.yml` **or** `Get-FileHash .\ESP32.Display.Studio_*_x64-setup.exe -Algorithm SHA256`
4. Replace `REPLACE_WITH_SHA256_OF_NSIS_INSTALLER` in the YAML for the published version (CI script does this into `out/`)
5. Open PR against [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) (or approve CI draft)
6. Path in upstream: `manifests/s/Studio/ESP32DisplayStudio/<version>/`
7. After install: follow [docs/windows-smartscreen.md](../../../docs/windows-smartscreen.md) reputation checklist
