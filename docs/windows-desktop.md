# Desktop polish — tray, autostart, i18n, kanały

Wprowadzone w **Fazie 6**; nadal aktualne w linii **0.2.13**.  
Ustawienia: **Ustawienia → Desktop**. Indeks: [README.md](./README.md).

## Tray

W shellu Tauri ikona w zasobniku systemowym:

- **Pokaż Studio**
- **Start / Stop agenta PC**
- **Wyjdź**

Opcja **Zamykaj do zasobnika** (Ustawienia → Desktop): zamknięcie okna ukrywa aplikację zamiast kończyć proces.

## Autostart

| Opcja | Mechanizm |
|-------|-----------|
| Uruchamiaj Studio z Windows | `tauri-plugin-autostart` (HKCU Run / LaunchAgent) |
| Autostart agenta PC | skrót `.bat` w folderze Startup użytkownika |

Wymaga zainstalowanego / zbudowanego `esp32-pc-agent.exe` (albo `.py` w PATH przy dewie).

## Język UI

PL / EN — chrome nawigacji, update banner, panel Desktop. Preferencja w `localStorage` (`esp32_locale`).

## Brak migających okien CMD (0.2.13+)

Na Windows przełączenie na **Wykryj ESP32 (USB)** lub **Ustawienia** uruchamia w tle detekcję toolchainu (`where`, `py -m esptool`, PlatformIO, …). Te procesy mają podsystem konsoli — bez flagi Windows pokazywałby krótkie okna CMD.

Od **0.2.13** shell stosuje `CREATE_NO_WINDOW` (`src-tauri/src/process_util.rs` → `hide_console`) dla:

- probe’ów `where` / wersji narzędzi (USB Flash Helper + Desktop Settings),
- build / flash / OTA / `taskkill` / agent PC,
- wrappera `cmd /C start` przy otwieraniu URL (przeglądarka nadal się otwiera, bez mignięcia konsoli).

Świadomie widoczne zostają tylko prawdziwe GUI (Explorer, Arduino IDE, przeglądarka). Logi build/flash nadal płyną do UI przez eventy `build-log` / `flash-log` / `ota-log` — nie przez okno terminala.

Szczegóły: [esp32-tooling-integrations.md](./esp32-tooling-integrations.md), [windows-build-flash.md](./windows-build-flash.md), [architecture.md](./architecture.md).

## Kanały aktualizacji

| Kanał | Endpoint |
|-------|----------|
| Stable | `releases/latest/download/latest.json` |
| Beta | `releases/latest/download/latest-beta.json` (+ fallback `beta-channel`) |

Przełącznik w **Ustawienia → Desktop**. CI tagów `v*-beta*` powinien publikować `latest-beta.json`.

## Release (checklista)

1. Ustaw sekrety: `TAURI_SIGNING_PRIVATE_KEY`, opcjonalnie Authenticode
2. Tag `v*` (np. `v0.2.6`) → workflow `windows-release.yml`
3. Zweryfikuj `latest.json` (+ `latest-beta.json` dla tagów beta) oraz podpis updatera
4. Smoke: Update ze starszej instalacji linii 0.2.x → nowy tag
5. Opcjonalnie: draft winget — [windows-winget.md](./windows-winget.md)

Metadane MSI muszą pozostać ASCII / WiX `en-US` — zob. [windows-installer.md](./windows-installer.md) (LGHT0311 / codepage 1252). Po merge fixów MSI uruchom **nowy** `workflow_dispatch` na aktualnym SHA (re-run starego runu nie pobiera nowego conf).
