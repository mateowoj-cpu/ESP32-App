# Kolejny krok po Fazie 11

## Stan po Fazie 11

- **i18n treści** — cyber-pet timeline/presety/generator, Integrations (miasta, agent PC, powiadomienia, warunki pogodowe), pinout chrome + role GPIO przez słownik PL/EN
- **winget-pkgs ścieżka live** — szablon `0.2.4` + zaktualizowane `PR_BODY.md` / `windows-winget.md` (SHA256 / Authenticode / PR do microsoft/winget-pkgs tylko u człowieka)
- **CI artifact penv** — workflow `windows-penv-artifact.yml` (`Stage-PlatformIoPenv.ps1` → artifact, nie git)
- **mDNS UX** — filtr/preferencja `mdnsName` projektu, rank IPv4, ostatnie hosty OTA (localStorage)
- **Hardening OTA** — timeout UI, cancel in-flight (`cancel_ota_firmware`), mapowanie `errorCode` → i18n
- Linia wersji **0.2.4**

## Faza 12 (rekomendowana)

1. **Store / SmartScreen reputation** — po pierwszym signed winget: monitoring reputacji, ewentualny EV cert
2. **Eksport diagnostyki ZIP** — opt-in lokalny log → spakowany bundle (flash/OTA/COM) do supportu
3. **Board profiles online sync** — community presets / biblioteka płytek poza lokalnym cache
4. **Linux/macOS desktop parity** — serial + OTA poza Windows-first (toolchain discovery, sidecar)

## Faza 13+ (backlog)

- Telemetria diagnostyczna opt-in (już jest lokalny log) → agregacja tylko za zgodą
- Automatyczny draft PR do winget-pkgs z CI po signed tagu (nadal bez sekretów winget w repo; SHA z assetu)
- Rozszerzenie i18n głębokich paneli pinout (modal przypisań) i katalogu płytek USB
- Community marketplace widgetów / reguł automatyzacji
