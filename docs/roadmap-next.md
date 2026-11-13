# Kolejny krok po Fazie 12

## Stan po Fazie 12

- **SmartScreen reputation** — checklista człowieka w [windows-smartscreen.md](./windows-smartscreen.md) (+ signing); bez fałszywych certów / hashów w repo
- **Eksport diagnostyki ZIP** — `export_diagnostics_zip` (manifest + `studio.log`) z Ustawienia → Desktop; lokalnie, bez telemetrii
- **Board profiles online sync** — katalog community (`public/board-profiles/community.json`) + sync UI / fallback bundlowany
- **Linux/macOS parity** — sidecar script Unix, hinty toolchainu, autostart agenta `.desktop`, docs [desktop-unix.md](./desktop-unix.md)
- Linia wersji **0.2.5**

## Faza 13 (rekomendowana)

1. **CI desktop non-Windows** — smoke `tauri build` Linux (AppImage/deb) i/lub macOS `.dmg` (bez store submit)
2. **Opt-in telemetria diagnostyczna** — agregacja tylko za zgodą (dziś: lokalny log + ZIP)
3. **Automatyczny draft PR winget-pkgs** — po signed tagu, SHA z assetu (bez sekretów winget w repo)
4. **Głębsze i18n** — modal przypisań pinout + katalog płytek USB

## Faza 14+ (backlog)

- Community marketplace widgetów / reguł automatyzacji
- EV code signing + monitoring reputacji SmartScreen (kontynuacja checklisty Fazy 12)
- Rozszerzenie community board catalog (więcej VID:PID / offsetów)
