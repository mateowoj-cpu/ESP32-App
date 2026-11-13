# winget + signed public release (Faza 8 → 15)

## Cel

Dystrybucja ESP32 Display Studio przez **winget** po podpisaniu instalatora Authenticode i opublikowaniu tagu `v0.2.x`.

## Automatyczny draft (Faza 13+)

Po opublikowaniu releasu (lub ręcznie `workflow_dispatch`):

1. Workflow [`.github/workflows/winget-draft.yml`](../.github/workflows/winget-draft.yml) pobiera NSIS z GitHub Release
2. `scripts/winget/prepare-draft-manifest.sh` liczy **prawdziwy** SHA256 i wypełnia YAML + `DRAFT_PR_BODY.md`
3. Artefakt CI `winget-draft-<version>` — do ręcznego PR
4. Opcjonalnie (sekret człowieka `WINGET_GITHUB_TOKEN` + fork `winget-pkgs`): draft PR do `microsoft/winget-pkgs`

**Nigdy** nie commituj tokenów ani wymyślonych SHA.

Lokalnie (gdy masz plik `.exe`):

```bash
./scripts/winget/prepare-draft-manifest.sh \
  --version 0.2.8 \
  --installer ./ESP32.Display.Studio_0.2.8_x64-setup.exe
```

## Live winget-pkgs (Faza 15 — human)

Merge do [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) jest **wyłącznie ludzki**. Agent przygotowuje szablon + CI draft SHA; nie otwiera live merge bez sekretów właściciela.

### Checklista po pierwszym signed release

1. Sekrety CI (tylko w GitHub Actions / lokalnym sejfie — **nie w git**): `TAURI_SIGNING_PRIVATE_KEY`, opcjonalnie `WINDOWS_CERTIFICATE*`, opcjonalnie `WINGET_GITHUB_TOKEN`
2. Tag signed `v0.2.7` lub nowszy (`v0.2.8`) → workflow `windows-release.yml`
3. Opcjonalnie: workflow `windows-penv-artifact.yml` → artifact penv → `Stage-PlatformIoPenv.ps1` przed bundlem
4. Uruchom `winget-draft.yml` (lub poczekaj na `release: published`) — sprawdź artefakt SHA (**nie wymyślaj**)
5. Szablon referencyjny w repo: `packaging/winget/.../0.2.8/Studio.ESP32DisplayStudio.yaml` (placeholder SHA do czasu releasu)
6. PR do [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs):

```text
manifests/s/Studio/ESP32DisplayStudio/0.2.8/
```

Lokalny test:

```powershell
winget install --manifest packaging\winget\ESP32DisplayStudio\manifests\s\Studio\ESP32DisplayStudio\0.2.8
```

7. Po instalacji: monitoring SmartScreen — [windows-smartscreen.md](./windows-smartscreen.md).
8. Po merge w `winget-pkgs`: `winget search ESP32DisplayStudio` / `winget install Studio.ESP32DisplayStudio`.

### Co agent może / nie może

| Może | Nie może |
|------|----------|
| Szablon YAML z `REPLACE_WITH_SHA256_…` | Wymyślić SHA256 |
| Workflow draft + skrypt z prawdziwego `.exe` | Merge PR w `microsoft/winget-pkgs` |
| Checklista / `PR_BODY.md` | Commit `WINGET_GITHUB_TOKEN` |

## Uwagi

- Nazwa pliku NSIS zależy od `productName` / wersji Tauri — dopasuj URL do faktycznego assetu.
- Bez Authenticode SmartScreen może blokować instalację; zob. [windows-signing.md](./windows-signing.md).
- Kanał updatera stable czyta `latest.json` z `releases/latest`.
- Szablony `0.2.1`–`0.2.7` zostają w drzewie jako referencja.
- **Human-only:** merge PR w `microsoft/winget-pkgs`, prawdziwy Authenticode, `WINGET_GITHUB_TOKEN`.
