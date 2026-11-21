# Free ESP32 tooling integrations

> **PL:** Studio wykrywa opcjonalne darmowe narzędzia hosta (PlatformIO, Arduino CLI/IDE, esptool, ESP-IDF, Wokwi) oraz host IDE (Arduino IDE, VS Code + PlatformIO, Sloeber, B4R), pozwala nadpisać ścieżki w Ustawieniach desktop, zaproponować bezpieczną instalację (oficjalny URL / allowlista winget) i otworzyć Arduino IDE / Wokwi — bez wymogu instalacji wszystkich narzędzi.

Short EN summary: Studio detects optional free host tools (PlatformIO, Arduino CLI/IDE, esptool, ESP-IDF, Wokwi) and host IDEs (Arduino IDE, VS Code + PlatformIO, Sloeber, B4R), lets you override paths in Desktop Settings, offers safe install guidance (official URL / allowlisted winget), and can launch Arduino IDE / Wokwi without requiring every tool.

Linia: **0.2.13**. Indeks: [README.md](./README.md).

## Resolve order

For PlatformIO and esptool (single shared resolver used by **Settings**, **Build**, and **Flash**):

1. Path override from Desktop Settings (`tool-paths.json` in app local data)
2. Env (`ESP32_STUDIO_PIO` / `ESP32_STUDIO_ESPTOOL`)
3. Sidecar (bundled / local-data penv under `sidecar/platformio/`)
4. PATH (`which` / `where`) via shared `process_util::which` — including `python -m esptool`

Each hit returns a `source` of `override` | `env` | `sidecar` | `path`. `--version` / `version` probes use an 8s timeout. Arduino CLI stays override → PATH (no sidecar).

## Windows: no flashing CMD (0.2.13+)

Opening **USB** (Flash Helper refresh) or **Settings → Desktop tools** runs many short probes. On Windows those used to flash CMD windows. All background probes and build/flash/OTA children now call `hide_console` (`CREATE_NO_WINDOW`) in `src-tauri/src/process_util.rs`. GUI launches (Explorer, Arduino IDE, browser) still open normally.

## UI surfaces

| Surface | What shipped |
|---------|----------------|
| Desktop Settings | Path overrides + detection status + homepage links + **host IDE install panel** |
| Flash Helper | Preferred build tool (`auto` / PlatformIO / arduino-cli), Open Arduino IDE, Open Wokwi, Open project folder |
| Code Generator | Open in Arduino IDE, Simulate in Wokwi |

## Tools

| Tool | Free? | Integration |
|------|-------|-------------|
| PlatformIO CLI | Yes (Apache/MIT ecosystem) | Detect + build (existing) + path override |
| Arduino CLI | Yes | Detect + build fallback + path override |
| Arduino IDE | Yes | Detect + export sketch + launch / reveal + winget `ArduinoSA.IDE.stable` / official download |
| VS Code + PlatformIO | Yes | Detect Code + `platformio.platformio-ide` extension; winget VS Code; Marketplace / `code --install-extension` |
| Sloeber | Yes (EPL) | Detect Eclipse/Sloeber paths; **official download only** (no winget) |
| B4R | Free tier (B4X) | Detect B4R.exe paths; **official b4x.com download only** (no winget) |
| esptool | Yes (GPLv2 / Apache dual) | Detect + flash (existing) + path override |
| ESP-IDF (`idf.py`) | Yes (Apache 2.0) | Detect-only (Studio builds Arduino framework) |
| Wokwi web | Free tier | Open ESP32 template in browser |
| Wokwi CLI | Free/open CLI | Detect + path override (optional) |

## Safe install policy

- **Allowlisted winget only:** `ArduinoSA.IDE.stable`, `Microsoft.VisualStudioCode` (see `src-tauri/src/host_ides.rs` + `src/platform/hostIdes.ts`).
- Winget runs in a **visible** console (`start winget …`) so the user sees prompts / UAC — never a silent background installer.
- Sloeber / B4R: open vendor HTTPS pages only — no third-party mirrors, no auto-EXE.
- PlatformIO IDE: official VS Marketplace or `code --install-extension platformio.platformio-ide`.

## IPC

See [architecture.md](./architecture.md) — External tools + host IDE install commands under Flash permissions (`start_winget_install`, `open_host_ide_download`, `install_platformio_vscode_extension`).
