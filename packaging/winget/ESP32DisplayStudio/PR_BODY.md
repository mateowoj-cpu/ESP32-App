# winget-pkgs PR body template (Faza 15)

Use after a **signed** GitHub Release `v0.2.8` (or earlier signed `v0.2.7`) is published. Do **not** invent
credentials or SHA256 — fill hashes from a real NSIS asset (GitHub Release download or
`scripts/winget/prepare-draft-manifest.sh` / workflow `winget-draft.yml`).

---

## Package

New package: Studio.ESP32DisplayStudio version 0.2.8

Publisher: ESP32 Display Studio  
Homepage: https://github.com/mateowoj-cpu/ESP32-App  
License: Proprietary

## Installer

- Architecture: x64
- InstallerType: nullsoft (NSIS)
- Scope: user
- Version: 0.2.8
- Installer URL: https://github.com/mateowoj-cpu/ESP32-App/releases/download/v0.2.8/ESP32.Display.Studio_0.2.8_x64-setup.exe
- SHA256: <paste from Get-FileHash / CI winget-draft artifact — never invent>

## Checklist

- [ ] Manifest YAML validated with `winget validate`
- [ ] Local install: `winget install --manifest manifests/s/Studio/ESP32DisplayStudio/0.2.8`
- [ ] Authenticode signature present on the NSIS installer (SmartScreen may still warn until reputation builds)
- [ ] No secrets in the PR

## Repo template

`packaging/winget/ESP32DisplayStudio/manifests/s/Studio/ESP32DisplayStudio/0.2.8/`.
Older templates `0.2.1`–`0.2.7` remain as reference until the first live winget-pkgs PR lands.
CI can emit a filled draft under `packaging/winget/ESP32DisplayStudio/out/<version>/` (artifact only).

## Human steps (live merge)

1. Confirm signed release assets on GitHub (`v0.2.8` or first signed `v0.2.7`)
2. Tag → `windows-release.yml` produces NSIS `.exe` (optionally download `platformio-penv-windows` artifact from `windows-penv-artifact.yml` and stage before build)
3. Run `winget-draft.yml` **or** `Get-FileHash .\ESP32.Display.Studio_*_x64-setup.exe -Algorithm SHA256`
4. Replace `REPLACE_WITH_SHA256_OF_NSIS_INSTALLER` with the real digest
5. Open PR against [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) (or approve CI draft)
6. After merge: `winget install Studio.ESP32DisplayStudio` and monitor SmartScreen ([docs/windows-smartscreen.md](../../../docs/windows-smartscreen.md))
