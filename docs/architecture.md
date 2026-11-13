# Architektura — ESP32 Display Studio

Przegląd warstw aplikacji w stanie **0.2.8** (po Fazach 0–15). Szczegóły wdrożeniowe: dokumenty tematyczne w tym katalogu.

## Stack

| Warstwa | Technologia |
|---------|-------------|
| UI | React + Vite + Tailwind 4 + TypeScript |
| i18n | `src/i18n` — PL/EN (`LocaleContext`, `locales.ts`) |
| Desktop shell | Tauri 2 (`src-tauri/`) — Windows NSIS/MSI; Linux AppImage/deb; macOS dmg |
| Serial | Abstrakcja `src/platform/serial.ts` → web / native / mock |
| Firmware | Generator C++ (Arduino / PlatformIO) + Build/Flash/OTA w shellu |

## Diagram (logiczny)

```text
┌─────────────────────────────────────────────────────────┐
│  React UI (src/components/*)                            │
│  Simulator · Visual Editor · USB · Flash · Integrations │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Platform adapters (src/platform/)                      │
│  serial · flash · firmwareBuild · ota · pcAgent         │
│  updater · diagnostics · boardCache/Sync · telemetry    │
│  deepLink · desktop (tray/autostart prefs)              │
└───────────┬──────────────────────────────┬──────────────┘
            │ web                          │ Tauri
            ▼                              ▼
   navigator.serial              Rust cmds + plugins
   (Chromium)                    serialport, mdns-sd,
                                 sidecar PIO, esptool,
                                 updater, deep-link, …
```

## UI — główne widoki

| Komponent | Rola |
|-----------|------|
| `HardwareSimulator` | Symulacja OLED/LCD, sensorów, GPIO |
| `VisualEditor` | Edytor widgetów / ekranów |
| `AutomationStudio` | Reguły i cyber-zwierzak |
| `UsbDetectorView` | Wykrywanie płytki, monitor, preset |
| `FlashHelperPanel` | Build → Flash → OTA |
| `CodeView` | Generator `.ino` / `platformio.ini` |
| `IntegrationsView` | Pogoda, agent PC, API |
| `DesktopSettingsPanel` | Tray, autostart, update channel, diag, telemetria |
| `SettingsView` / `Esp32PinoutMap` | Konfiguracja systemu, mapa pinów |

UI **nie** woła `navigator.serial` ani komend Rust bezpośrednio — tylko przez `src/platform/`.

## Serial

| Adapter | Kiedy | Porty |
|---------|-------|--------|
| `webSerial` | Przeglądarka Chromium | Web Serial picker |
| `nativeSerial` | Shell Tauri | `COMx`, `/dev/tty*`, `/dev/cu.*` |
| `mockSerial` | Testy / bez sprzętu | Presety |

W Tauri `main.tsx` rejestruje adapter native przed renderem. Komendy Rust: `list_serial_ports`, `open_serial_port`, `write_serial_port`, `close_serial_port`; eventy `serial-data`, `serial-disconnected`.

## Firmware pipeline (desktop)

1. **Generate** — szkic + `platformio.ini` z konfiguracji Studio  
2. **Build** — `pio` / `arduino-cli` (PATH lub [sidecar](./windows-sidecar-pio.md))  
3. **Flash** — `esptool write_flash` na COM  
4. **OTA** — `espota` lub HTTP `/update` + [mDNS](./windows-ota.md)

Cache profilu płytki (`boardCache`) i sync community (`boardSync` ← `public/board-profiles/community.json`) przyspieszają kolejne flashowanie.

Marketplace społeczności (`marketplace.ts` ← `public/marketplace/`) importuje wyłącznie JSON widgetów / reguł z walidacją schematu (v1/v2), opcjonalnym podpisem Ed25519 i allowlistą hostów — bez `eval` / arbitrary code ([marketplace-plugin-api.md](./marketplace-plugin-api.md)).

## Preferencje lokalne

Przechowywane w `localStorage` (bez konta użytkownika), m.in.:

- `esp32_locale` — PL/EN  
- kanał updatera (stable / beta)  
- close-to-tray / autostart (UI + pluginy Tauri)  
- diagnostyka flash/COM, telemetria opt-in  
- ostatnie hosty OTA, cache VID:PID  

## Paczkowanie i release

| Cel | Workflow / config |
|-----|-------------------|
| Windows NSIS/MSI + updater | `.github/workflows/windows-release.yml`, `tauri.conf.json` |
| penv PlatformIO (opcjonalnie) | `windows-penv-artifact.yml` + `Stage-PlatformIoPenv.ps1` |
| Linux / macOS | `desktop-unix-release.yml` + `tauri.linux.json` / `tauri.macos.json` (+ `*.signed.json` gdy sekret) |
| Draft winget | `winget-draft.yml` + `scripts/winget/prepare-draft-manifest.sh` |
| Smoke | `smoke.yml` → `npm run smoke` |

Updater Windows czyta `latest.json` / `latest-beta.json` z GitHub Releases. Nakładki Unix domyślnie mają `createUpdaterArtifacts: false`; signed overlays włączają artefakty gdy `TAURI_SIGNING_PRIVATE_KEY` — zob. [desktop-unix.md](./desktop-unix.md).

## Granice odpowiedzialności

- **Agent / CI** mogą budować unsigned / draft artefakty.  
- **Człowiek** podpisuje Authenticode, merge’uje winget-pkgs, ustawia sekrety (`WINDOWS_CERTIFICATE*`, `TAURI_SIGNING_PRIVATE_KEY`, `WINGET_GITHUB_TOKEN`, opcjonalnie `VITE_TELEMETRY_ENDPOINT`).

Zobacz też: [developer-setup.md](./developer-setup.md), [user-guide.md](./user-guide.md).
