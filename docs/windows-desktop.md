# Desktop polish — tray, autostart, i18n, kanały

Wprowadzone w **Fazie 6**; nadal aktualne w linii **0.2.8**.  
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
