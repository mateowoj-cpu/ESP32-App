# Setup dla contributorów

Jak uruchomić, testować i kompilować ESP32 Display Studio lokalnie. Linia: **0.2.10**. Indeks: [README.md](./README.md) · architektura: [architecture.md](./architecture.md).

## Wymagania

| Narzędzie | Kiedy |
|-----------|--------|
| Node.js **22 LTS** + npm 10+ | zawsze |
| Chromium (Chrome / Edge / Brave) | tryb web + Web Serial |
| Rust stable + toolchain C++ | `tauri:dev` / `tauri:build` (MSRV: `rust-version = "1.90"` w `Cargo.toml`) |
| WebView2 | Windows desktop |
| Python 3 + pip | sidecar PIO, esptool, agent PC |
| `esptool` / PlatformIO / arduino-cli | Build/Flash (PATH lub sidecar) |

Prerequisites Tauri 2: [v2.tauri.app/start/prerequisites](https://v2.tauri.app/start/prerequisites/).

`tsconfig.json` includes tylko `src/`, `scripts/**/*.ts` i `vite.config.ts` — **wyklucza** `src-tauri/target` / `gen`, żeby `npm run lint` nie pękał po lokalnym `tauri build` (codegen assets).

## Szybki start (web)

```bash
git clone https://github.com/mateowoj-cpu/ESP32-App.git
cd ESP32-App
npm ci   # lub: npm install
npm run dev
```

→ [http://localhost:3000](http://localhost:3000)

Opcjonalnie skopiuj `.env.example` → `.env` (`GEMINI_API_KEY` obecnie opcjonalny / nieużywany w UI).

## Pełna kompilacja (checklist)

Zamknięcie „zielonej” ścieżki compile przed PR / releasem.

### 1) Web + testy (wszystkie OS)

```bash
npm ci
npm run lint
npm run build
npm run smoke          # lint + unit tests + validate:board-catalog + vite build
npm run compile:cargo  # cargo check w src-tauri
# albo jednym skryptem:
npm run compile:full
```

`npm run smoke` uruchamia (kolejność z `package.json`):

`lint` → `test:serial` → `test:deeplink` → `test:i18n` → `test:pio-board` → `test:board-cache` → `test:board-sync` → `test:board-catalog` → `test:ota` → `test:telemetry` → `test:marketplace` → `validate:board-catalog` → `build`.

### 2) Rust release binary (opcjonalnie, wolniej)

```bash
npm run compile:full -- --release
# równoważne: (cd src-tauri && cargo build --release)
```

### 3) Paczki desktop — zależnie od hosta

| Cel | Host / CI | Komenda |
|-----|-----------|---------|
| Linux AppImage + deb | Linux + deps Tauri 2 | `npm run compile:full -- --linux-bundle` **lub** `npm run tauri:build -- --config src-tauri/tauri.linux.json` |
| macOS dmg | macOS | `npm run tauri:build -- --config src-tauri/tauri.macos.json` |
| Windows NSIS / MSI | **Windows** + MSVC | `npm run tauri:build` |
| Windows + Authenticode | Windows + lokalny JSON | `npm run tauri:build:signed` (sekrety **nie** w git) |

**W tej Linux VM / agent cloud:** web smoke + `cargo check` / `cargo build --release` + Linux AppImage/deb **działają**.  
**Nie uruchomisz tu:** Windows NSIS/MSI (wymaga `x86_64-pc-windows-msvc` + WiX/NSIS na Windows), macOS dmg/notarize (Apple toolchain), ani podpisów Authenticode / Apple / updater bez sekretów człowieka.

CI odpowiedniki — tabela w sekcji [CI](#ci).

## Desktop Tauri

```bash
npm install
npm run tauri:dev
```

Windows (MSVC):

```powershell
npm run tauri:build
# opcjonalnie Authenticode (lokalny JSON — nie commitować sekretów):
# Copy-Item src-tauri\tauri.windows-signing.example.json src-tauri\tauri.windows-signing.local.json
npm run tauri:build:signed
```

Linux / macOS:

```bash
npm run tauri:build -- --config src-tauri/tauri.linux.json
npm run tauri:build -- --config src-tauri/tauri.macos.json
```

Sidecar PIO:

```powershell
powershell -File .\scripts\windows\Install-PlatformIoSidecar.ps1
```

```bash
bash scripts/unix/install-platformio-sidecar.sh
```

Po instalacji ustaw / wyeksportuj `ESP32_STUDIO_PIO` i `ESP32_STUDIO_ESPOTA` (skrypt wypisuje wartości).

## Skrypty npm

Źródło prawdy: root `package.json`.

| Skrypt | Opis |
|--------|------|
| `npm run dev` | Vite :3000 (`--host 0.0.0.0`) |
| `npm run build` / `preview` | Build produkcyjny / podgląd |
| `npm run lint` | `tsc --noEmit` |
| `npm run clean` | Czyści `dist` (cross-platform `rimraf`) |
| `npm run tauri` / `tauri:dev` / `tauri:build` | CLI / shell desktop |
| `npm run tauri:build:windows` | Target `x86_64-pc-windows-msvc` |
| `npm run tauri:build:signed` | Build + nakładka `tauri.windows-signing.local.json` |
| `npm run smoke` | Pełny frontend gate przed PR |
| `npm run compile:cargo` | `cargo check` (`src-tauri`) |
| `npm run compile:full` | `scripts/full-compile.sh` (smoke + cargo; `--release` / `--linux-bundle`) |
| `npm run test:serial` | Mock serial |
| `npm run test:deeplink` | Deep link unit |
| `npm run test:i18n` | Locale keys PL/EN |
| `npm run test:pio-board` | Mapowanie board → PIO |
| `npm run test:board-cache` / `test:board-sync` / `test:board-catalog` | Flash cache / sync / walidacja |
| `npm run test:ota` / `test:telemetry` / `test:marketplace` | OTA hosty, telemetria, marketplace sandbox |
| `npm run validate:board-catalog` | `scripts/board-profiles/validate-community.ts` |
| `npm run pc-agent:test` | Smoke agenta Pythona (`--once`) |

Przed PR: `npm run smoke` (minimum) albo `npm run compile:full` (smoke + cargo).

## Zmienne środowiskowe

### Vite / `.env` (build-time)

| Zmienna | Wymagana? | Opis |
|---------|-----------|------|
| `GEMINI_API_KEY` | nie | Legacy AI Studio — UI obecnie nie używa |
| `APP_URL` | nie | URL hostingu / self-ref |
| `VITE_TELEMETRY_ENDPOINT` | nie | HTTPS collector; bez niej consent telemetrii = no-op sieciowy |

`vite.config.ts` przepuszcza prefiksy `VITE_` i `TAURI_`.

### Runtime desktop / sidecar

| Zmienna | Opis |
|---------|------|
| `ESP32_STUDIO_PIO` | Absolutna ścieżka do CLI PlatformIO |
| `ESP32_STUDIO_ESPOTA` | Absolutna ścieżka do `espota.py` |
| `ESP32_STUDIO_DATA_DIR` | Root danych sidecar (Unix installer) |

### Sekrety (GitHub Secrets / lokalny sejf — **nie w git**)

| Sekret | Do czego |
|--------|----------|
| `WINDOWS_CERTIFICATE` (+ password / thumbprint) | Authenticode NSIS/MSI |
| `TAURI_SIGNING_PRIVATE_KEY` (+ password) | Podpis updater artifacts |
| `WINGET_GITHUB_TOKEN` | Draft PR winget (publish = human) |
| Apple notarize keys | [macos-notarize.md](./macos-notarize.md) |

Szablony komentarzy: root `.env.example`.

## Struktura repo (skrót)

```text
src/                 React UI, i18n, utils, types
src/platform/        Serial, flash, OTA, updater, diag, telemetry, marketplace…
src-tauri/           Rust / Tauri 2 (lib.rs IPC), ikony, resources, overlay JSON
docs/                Ta dokumentacja
public/              board-profiles/, marketplace/, assety statyczne
packaging/winget/    Manifesty referencyjne (SHA placeholder do releasu)
packaging/updater/   Przykłady multi-platform latest.json
scripts/             Windows / Unix / winget / board-profiles / full-compile.sh
tools/pc-agent/      Agent monitora PC (Python)
.github/workflows/   smoke, windows-release, desktop-unix*, winget-draft, penv
```

## CI

| Workflow | Trigger | Co robi |
|----------|---------|---------|
| `smoke.yml` | PR / push `main` | Job frontend = suite jak `smoke` + pc-agent; job `rust-smoke` = `cargo check` |
| `windows-release.yml` | tag `v*` / dispatch | NSIS/MSI + updater (Windows runner) |
| `windows-penv-artifact.yml` | dispatch | Artifact penv PlatformIO |
| `desktop-unix-release.yml` | tag `v*` | AppImage / deb / dmg |
| `desktop-unix-appimage-smoke.yml` | `workflow_dispatch` | Szybki smoke paczek Linux |
| `winget-draft.yml` | dispatch / po releasie | SHA z assetu + draft manifest (**publish = human**) |

**Nie commituj** prywatnych kluczy, `.pfx`, prawdziwych SHA winget z niesprawdzonych binarek, ani tokenów. Zobacz [windows-signing.md](./windows-signing.md), [windows-winget.md](./windows-winget.md).

## Konwencje PR

1. Jedna zmiana / faza lub spójny temat (docs-only OK).  
2. Nie oznaczaj roadmapy jako „done” bez merge’a funkcji.  
3. Aktualizuj docs tematyczne gdy zmieniasz zachowanie użytkownika lub IPC.  
4. i18n: nowe stringi UI w `src/i18n/locales.ts` (PL **i** EN).  
5. Testy: dodaj/aktualizuj `*.test.ts` przy logice w `src/platform/` / i18n.  
6. Nowe komendy Rust → wpisz w [architecture.md](./architecture.md) (tabela IPC) i ewentualnie user-guide jeśli widać w UI.

Roadmapa: [roadmap-next.md](./roadmap-next.md) — po zamknięciu full-compile następna jest **Faza 18** (ops live / human secrets).

## Przydatne linki

- [user-guide.md](./user-guide.md)  
- [architecture.md](./architecture.md)  
- [windows-desktop.md](./windows-desktop.md)  
- [desktop-unix.md](./desktop-unix.md)  
- [telemetry.md](./telemetry.md)  
- [board-catalog.md](./board-catalog.md)  
- Indeks: [README.md](./README.md)
