# Desktop polish (Faza 6) — tray, autostart, i18n, kanały

Wersja aplikacji: **0.2.0**

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

## Release `v0.2.0` (checklista)

1. Ustaw sekrety: `TAURI_SIGNING_PRIVATE_KEY`, opcjonalnie Authenticode
2. Tag `v0.2.0` → workflow `windows-release.yml`
3. Zweryfikuj `latest.json` + podpis updatera
4. Smoke: Update z 0.1.x → 0.2.0
