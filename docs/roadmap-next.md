# Kolejny krok po Fazie 8

## Stan po Fazie 8

- Rozszerzone i18n PL/EN (chrome + USB/Flash/Code/Integracje/Ustawienia)
- Manifest winget (szablon) + docs signed release
- Opt-in diagnostyka flash/COM → lokalny `studio.log`
- Cache presetów flash per VID:PID
- Wersja linii **0.2.1**

## Faza 9 (rekomendowana)

1. **Sidecar / offline PlatformIO Core** w instalatorze (bez PATH użytkownika)
2. **OTA firmware** przez Wi‑Fi z Studio (`espota` / HTTP update)
3. Dokończenie tłumaczeń głębokich paneli (symulator, edytor, automatyzacje)
4. Publikacja winget w `winget-pkgs` po pierwszym podpisanym `v0.2.1`
