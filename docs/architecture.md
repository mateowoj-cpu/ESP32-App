# Architektura — ESP32 Display Studio

Przegląd warstw, modułów platformowych, komend IPC Tauri i przepływów danych w linii **0.2.10** (Fazy 0–17 + full-build-closure). Indeks: [README.md](./README.md).

## Stack

| Warstwa | Technologia |
|---------|-------------|
| UI | React 19 + Vite 8 + Tailwind 4 + TypeScript |
| i18n | `src/i18n` — PL/EN (`LocaleContext`, `locales.ts`) |
| Platform adapters | `src/platform/*` — jedyna ścieżka UI → host |
| Desktop shell | Tauri 2 (`src-tauri/`) — Windows NSIS/MSI; Linux AppImage/deb; macOS dmg |
| Native I/O | `serialport`, `mdns-sd`, child processes (`esptool`, `pio`, `espota`, `curl`) |
| Firmware | Generator C++ (Arduino / PlatformIO) + Build/Flash/OTA w shellu |

## Diagram (logiczny)

```text
┌─────────────────────────────────────────────────────────┐
│  React UI (src/components/*)                            │
│  Simulator · Visual Editor · USB · Flash · Marketplace  │
│  Integrations · DesktopSettings · CodeView · Pinout     │
└──────────────────────────┬──────────────────────────────┘
                           │ import z src/platform/*
┌──────────────────────────▼──────────────────────────────┐
│  Platform adapters (src/platform/)                      │
│  serial · nativeSerial · flash · firmwareBuild · ota    │
│  pcAgent · updater · diagnostics · desktop · telemetry  │
│  marketplace · boardCache · boardSync · boardCatalog…   │
│  deepLink · windowsDrivers · otaHost / otaRecent        │
└───────────┬──────────────────────────────┬──────────────┘
            │ web                          │ Tauri (invoke / listen)
            ▼                              ▼
   navigator.serial              Rust cmds + plugins
   (Chromium)                    serialport, mdns-sd,
                                 sidecar PIO, esptool,
                                 updater, deep-link, …
```

## Bootstrap

`src/main.tsx`:

1. Ustawia `document.documentElement.lang` z `loadLocale()`.
2. Jeśli `isTauri()` → dynamiczny `import('./platform/nativeSerial')` + `setSerialAdapter(...)`.
3. Renderuje `<LocaleProvider><App /></LocaleProvider>`.
4. Opcjonalnie `trackTelemetry({ name: 'app_open' })` (no-op bez consent + endpoint).

Dzięki dynamicznemu importowi build przeglądarkowy **nie** bundluje eagerly `@tauri-apps/api`. Publiczny re-export `src/platform/index.ts` eksportuje tylko serial API (bez native).

## UI — główne widoki

| Komponent | Rola |
|-----------|------|
| `HardwareSimulator` | Symulacja OLED/LCD, sensorów, GPIO |
| `VisualEditor` | Edytor widgetów / ekranów |
| `AutomationStudio` | Reguły i cyber-zwierzak |
| `UsbDetectorView` | Wykrywanie płytki, monitor, preset |
| `FlashHelperPanel` | Build → Flash → OTA |
| `CodeView` | Generator `.ino` / `platformio.ini` |
| `MarketplaceView` | Katalog / import paczek JSON |
| `IntegrationsView` | Pogoda, agent PC, API |
| `DesktopSettingsPanel` | Tray, autostart, update channel, diag, telemetria |
| `SettingsView` / `Esp32PinoutMap` / `GpioPinInspector` | Konfiguracja systemu, mapa pinów |

UI **nie** woła `navigator.serial` ani komend Rust bezpośrednio — tylko przez `src/platform/`.

## Moduły `src/platform/`

| Moduł | Host | Odpowiedzialność |
|-------|------|------------------|
| `serial.ts` | web / mock | Kontrakt `SerialAdapter`, Web Serial, mock, resolver |
| `nativeSerial.ts` | Tauri | `invoke` serial + listen `serial-data` / `serial-disconnected` |
| `flash.ts` | Tauri | `esptool` info / write_flash, dialog `.bin`, `flash-log` |
| `firmwareBuild.ts` | Tauri | toolchain info + build szkicu, `build-log` |
| `tools.ts` | Tauri | detect free ESP32 tools, path overrides, Arduino IDE / Wokwi launch |
| `ota.ts` + `otaHost.ts` + `otaRecent.ts` | Tauri + localStorage | espota/HTTP, mDNS discover, recent hosts |
| `desktop.ts` | Tauri | close-to-tray, autostart, show window |
| `updater.ts` | Tauri | kanał stable/beta → `check_update_channel` / install |
| `diagnostics.ts` | Tauri | log lokalny, folder, ZIP export |
| `telemetry.ts` | web/desktop | opt-in POST (wymaga `VITE_TELEMETRY_ENDPOINT`) |
| `pcAgent.ts` | Tauri | start/stop / info agenta |
| `deepLink.ts` | Tauri | listen `app-open-paths` (URL / pliki) |
| `marketplace.ts` | web/desktop | katalog + walidacja JSON v1/v2 + Ed25519 |
| `boardCache.ts` / `boardSync.ts` / `boardCatalogValidate.ts` | web/desktop | cache flash, sync community, walidacja PR |
| `windowsDrivers.ts` | web/desktop | hinty VID/PID sterowników |

Testy: `*.test.ts` + `npm run smoke` / pojedyncze `npm run test:*`.

## Serial

| Adapter | Kiedy | Porty |
|---------|-------|--------|
| `webSerial` | Przeglądarka Chromium | Web Serial picker |
| `nativeSerial` | Shell Tauri | `COMx`, `/dev/tty*`, `/dev/cu.*` |
| `mockSerial` | Testy / bez sprzętu | Presety (np. ESP32-S3) |

Domyślny baud: **115200**. Native open pomija chooser gdy podano `portId`.

### Komendy i eventy serial (Rust)

| IPC / event | Kierunek | Opis |
|-------------|----------|------|
| `list_serial_ports` | JS → Rust | Lista portów + VID/PID gdy dostępne |
| `open_serial_port` | JS → Rust | Otwórz path, start reader thread |
| `write_serial_port` | JS → Rust | Zapis UTF-8 / bytes na otwarty port |
| `close_serial_port` | JS → Rust | Zamknięcie + stop reader |
| `serial-data` | Rust → JS | `{ path, chunk }` |
| `serial-disconnected` | Rust → JS | `{ path, reason }` |

Implementacja: `src-tauri/src/serial.rs` (`SerialManager` w `manage(...)`).

## IPC Tauri — pełna lista komend

Zarejestrowane w `src-tauri/src/lib.rs` (`generate_handler!`):

| Grupa | Komendy |
|-------|---------|
| **Serial** | `list_serial_ports`, `open_serial_port`, `write_serial_port`, `close_serial_port` |
| **PC agent** | `get_pc_agent_info`, `start_pc_agent`, `stop_pc_agent` |
| **Flash** | `get_esptool_info`, `flash_write_firmware`, `read_open_file` |
| **Build** | `get_firmware_toolchain_info`, `build_firmware_from_sketch` |
| **External tools** | `get_external_tools_status`, `get_tool_path_overrides`, `set_tool_path_overrides`, `open_path_in_os`, `open_external_url`, `export_and_open_arduino_ide`, `open_wokwi_simulator` |
| **OTA** | `get_ota_tool_info`, `flash_ota_firmware`, `cancel_ota_firmware`, `discover_ota_hosts` |
| **Desktop** | `get_desktop_status`, `set_app_autostart`, `set_pc_agent_autostart`, `set_close_to_tray`, `show_main_window` |
| **Updater** | `check_update_channel`, `download_and_install_channel` |
| **Diagnostics** | `set_diagnostics_enabled`, `append_diagnostics_log`, `get_diagnostics_log_path`, `open_diagnostics_folder`, `export_diagnostics_zip` |

### Eventy (Rust → frontend)

| Event | Źródło | Payload (skrót) |
|-------|--------|-----------------|
| `serial-data` / `serial-disconnected` | `serial.rs` | chunk / reason |
| `flash-log` | `flash.rs` | linia stdout/stderr esptool |
| `build-log` | `firmware_build.rs` | linia pio / arduino-cli |
| `ota-log` | `ota.rs` | linia espota / curl |
| `app-open-paths` | `lib.rs` + deep-link + single-instance | ścieżki / URL `esp32studio://` |

### Pluginy Tauri 2

| Plugin | Użycie |
|--------|--------|
| `tauri-plugin-updater` | Auto-update (pubkey w `tauri.conf.json`) |
| `tauri-plugin-process` | Restart po update |
| `tauri-plugin-dialog` | Open/save plików |
| `tauri-plugin-deep-link` | schemat `esp32studio` |
| `tauri-plugin-autostart` | LaunchAgent / autostart |
| `tauri-plugin-single-instance` | Fokus okna + forward argv |
| `tauri-plugin-log` | tylko debug builds |

## Przepływy danych

### Serial monitor

```text
UI (UsbDetectorView)
  → getSerialAdapter().requestPort({ portId?, baudRate? })
  → web: navigator.serial  |  native: invoke open_serial_port
  → onData ← serial-data event / ReadableStream
  → write/close przez adapter
```

### Build → Flash (USB)

```text
1. Generate  — szkic + platformio.ini z konfiguracji Studio
2. Build     — invoke build_firmware_from_sketch
               resolve: ESP32_STUDIO_PIO → sidecar → PATH (pio / arduino-cli)
               stream: build-log
3. Flash     — invoke flash_write_firmware { port, baud, chip, firmwarePath, flashOffset? }
               resolve: esptool / esptool.py / python -m esptool
               default offset 0x1000 (nadpisywany z board cache / profilu)
               stream: flash-log
4. Board     — boardCache zapisuje ostatni udany profil (VID:PID → chip/offset)
```

### OTA Wi‑Fi

```text
1. Wymaganie: pierwszy flash USB ze szkicu z ArduinoOTA / HTTP /update + Wi‑Fi
2. discover_ota_hosts(timeoutMs) — mdns-sd: _arduino._tcp, _http._tcp (UDP 5353)
3. flash_ota_firmware { host, port, password, firmwarePath, method: espota|http, timeoutMs }
   → espota.py (ESP32_STUDIO_ESPOTA / sidecar / Arduino tools) lub curl multipart
4. cancel_ota_firmware — kill child procesu
5. otaRecent — localStorage udanych hostów
```

Szczegóły UX: [windows-ota.md](./windows-ota.md), [windows-flash.md](./windows-flash.md), [windows-build-flash.md](./windows-build-flash.md).

### Marketplace / board catalog

- Marketplace: `public/marketplace/` + `marketplace.ts` — walidacja schematu, allowlista hostów, opcjonalny podpis Ed25519; **bez** wykonywania kodu ([marketplace-plugin-api.md](./marketplace-plugin-api.md)).
- Board catalog: `public/board-profiles/community.json` → `boardSync` / `boardCatalogValidate` (offset ↔ esptool chip family, bundled parity, reject złego remote) — [board-catalog.md](./board-catalog.md).

### Deep link / pliki

- Schemat: `esp32studio://…` (plugin deep-link).
- Association: `.esp32studio`, podgląd `.ino`.
- Single-instance przekazuje argv → `app-open-paths` → `deepLink.ts` / `read_open_file`.

## Preferencje lokalne (`localStorage`)

Bez konta użytkownika:

| Klucz | Znaczenie |
|-------|-----------|
| `esp32_locale` | `pl` / `en` |
| `esp32_update_channel` | `stable` / `beta` |
| `esp32_close_to_tray` | `1` / `0` |
| `esp32_diagnostics` | lokalny log flash/COM |
| `esp32_telemetry` | consent sieciowy (`1` = on) |
| `esp32_ui_font_scale` | skala UI |
| (inne) | cache VID:PID, ostatnie hosty OTA, marketplace prefs — w modułach platform |

## Konfiguracja i env

### Build-time (Vite / `.env`)

| Zmienna | Rola |
|---------|------|
| `GEMINI_API_KEY` | Legacy / opcjonalny — obecnie nieużywany w UI |
| `APP_URL` | URL hostingu appletu (AI Studio / self-ref) |
| `VITE_TELEMETRY_ENDPOINT` | HTTPS ingest; bez niej toggle telemetrii nic nie wysyła |
| `TAURI_*` | Prefiks dozwolony w `vite.config.ts` (`envPrefix`) |

### Runtime (proces desktop / sidecar)

| Zmienna | Rola |
|---------|------|
| `ESP32_STUDIO_PIO` | Override ścieżki PlatformIO CLI |
| `ESP32_STUDIO_ESPOTA` | Override `espota.py` |
| `ESP32_STUDIO_DATA_DIR` | Katalog danych sidecar (Unix) |

### Sekrety CI / lokalne (nigdy w git)

`WINDOWS_CERTIFICATE*`, `TAURI_SIGNING_PRIVATE_KEY`[+`_PASSWORD`], `WINGET_GITHUB_TOKEN`, opcjonalnie live `VITE_TELEMETRY_ENDPOINT`, sekrety Apple notarize — zob. `.env.example` (komentarze) i docs signing / winget / macos-notarize.

## Paczkowanie i release

| Cel | Workflow / config |
|-----|-------------------|
| Windows NSIS/MSI + updater | `.github/workflows/windows-release.yml`, `tauri.conf.json` |
| penv PlatformIO (opcjonalnie) | `windows-penv-artifact.yml` + `Stage-PlatformIoPenv.ps1` |
| Linux / macOS | `desktop-unix-release.yml` + `tauri.linux.json` / `tauri.macos.json` (+ `*.signed.json` gdy sekret) |
| AppImage smoke (dispatch) | `desktop-unix-appimage-smoke.yml` |
| Draft winget | `winget-draft.yml` + `scripts/winget/prepare-draft-manifest.sh` |
| Smoke PR | `smoke.yml` → frontend suite + `cargo check` |

Updater: `createUpdaterArtifacts` w `tauri.conf.json` domyślnie **`false`** (NSIS/MSI bez `.sig`). Windows CI włącza `tauri.windows.updater-signed.json` tylko przy poprawnym `TAURI_SIGNING_PRIVATE_KEY` (minisign `untrusted comment:`). Unix: unsigned overlays + signed overlays gdy sekret — [desktop-unix.md](./desktop-unix.md), [windows-updater.md](./windows-updater.md).

## Granice odpowiedzialności

- **Agent / CI** mogą budować unsigned / draft artefakty i zielone `smoke` / `compile:full`.
- **Człowiek** podpisuje Authenticode, merge’uje winget-pkgs, ustawia sekrety Apple / updater / telemetry collector, publikuje live marketplace publishers.

Zobacz też: [developer-setup.md](./developer-setup.md), [user-guide.md](./user-guide.md), [roadmap-next.md](./roadmap-next.md).
