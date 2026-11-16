# Setup dla contributorów

Jak uruchomić i testować ESP32 Display Studio lokalnie. Wersja linii: **0.2.10**.

## Wymagania

| Narzędzie | Kiedy |
|-----------|--------|
| Node.js **22 LTS** + npm 10+ | zawsze |
| Chromium (Chrome / Edge / Brave) | tryb web + Web Serial |
| Rust stable + toolchain C++ | `tauri:dev` / `tauri:build` |
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

Zamknięcie „zielonej” ścieżki compile przed PR / releasem. Wersja linii: **0.2.10**.

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

CI odpowiedniki:

| Workflow | Co kompiluje |
|----------|----------------|
| `smoke.yml` | frontend smoke + `cargo check` (każdy PR) |
| `desktop-unix-appimage-smoke.yml` | AppImage/deb (`workflow_dispatch`) |
| `desktop-unix-release.yml` | AppImage/deb/dmg na tag `v*` |
| `windows-release.yml` | NSIS/MSI na Windows runner / tag `v*` |

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

Sidecar PIO: `scripts/windows/Install-PlatformIoSidecar.ps1` lub `scripts/unix/install-platformio-sidecar.sh`.

## Skrypty npm

| Skrypt | Opis |
|--------|------|
| `npm run dev` | Vite :3000 |
| `npm run build` / `preview` | Build produkcyjny / podgląd |
| `npm run lint` | `tsc --noEmit` |
| `npm run clean` | Czyści `dist` (cross-platform) |
| `npm run tauri:dev` / `tauri:build` | Shell desktop |
| `npm run smoke` | Lint + testy platform + board-catalog validate + `build` |
| `npm run compile:cargo` | `cargo check` (src-tauri) |
| `npm run compile:full` | `scripts/full-compile.sh` (smoke + cargo; opcje `--release` / `--linux-bundle`) |
| `npm run test:serial` | Mock serial |
| `npm run test:i18n` | Locale keys PL/EN |
| `npm run test:ota` / `test:board-*` / `test:telemetry` / `test:marketplace` / `test:deeplink` | Testy platformy |
| `npm run validate:board-catalog` | Walidacja community board profiles |
| `npm run pc-agent:test` | Smoke agenta Pythona |

Przed PR: `npm run smoke` (minimum) albo `npm run compile:full` (smoke + cargo).

## Struktura repo (skrót)

```text
src/                 React UI, i18n, utils
src/platform/        Serial, flash, OTA, updater, diag, telemetry…
src-tauri/           Rust / Tauri 2, ikony, resources
docs/                Ta dokumentacja
packaging/winget/    Manifesty referencyjne (SHA placeholder do releasu)
scripts/             Windows / Unix / winget helpers
tools/pc-agent/      Agent monitora PC
.github/workflows/   smoke, windows-release, desktop-unix (+ appimage-smoke), winget-draft, penv
```

Architekturę warstw opisuje [architecture.md](./architecture.md).

## CI

| Workflow | Rola |
|----------|------|
| `smoke.yml` | `npm run smoke` na PR / push |
| `windows-release.yml` | NSIS/MSI + updater (tag `v*` / dispatch) |
| `windows-penv-artifact.yml` | Artifact penv PlatformIO |
| `desktop-unix-release.yml` | AppImage / deb / dmg |
| `winget-draft.yml` | SHA z assetu + draft manifest (publish = human) |

**Nie commituj** prywatnych kluczy, `.pfx`, prawdziwych SHA winget z niesprawdzonych binarek, ani tokenów. Zobacz [windows-signing.md](./windows-signing.md), [windows-winget.md](./windows-winget.md).

## Konwencje PR

1. Jedna zmiana / faza lub spójny temat (docs-only OK).  
2. Nie oznaczaj roadmapy jako „done” bez merge’a funkcji.  
3. Aktualizuj docs tematyczne gdy zmieniasz zachowanie użytkownika.  
4. i18n: nowe stringi UI w `src/i18n/locales.ts` (PL **i** EN).  
5. Testy: dodaj/aktualizuj `*.test.ts` przy logice w `src/platform/` / i18n.

Roadmapa: [roadmap-next.md](./roadmap-next.md) — po zamknięciu full-compile następna jest **Faza 18** (ops live / human secrets).

## Przydatne linki

- [user-guide.md](./user-guide.md)  
- [windows-desktop.md](./windows-desktop.md)  
- [desktop-unix.md](./desktop-unix.md)  
- [telemetry.md](./telemetry.md)  
- Indeks: [README.md](./README.md)
