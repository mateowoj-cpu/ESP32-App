# Dokumentacja — ESP32 Display Studio

Indeks dokumentów w `docs/`. Wersja aplikacji: **0.2.10** (Faza 17 + full-build-closure + board-catalog community validation). Następna: [Faza 18 ops / human](./roadmap-next.md).

Język: głównie **PL** (jak README główne). Dokumenty telemetrii i marketplace mają treść **PL** z krótkim streszczeniem **EN** na górze.

## Start tutaj

| Dokument | Dla kogo | Opis |
|----------|----------|------|
| [user-guide.md](./user-guide.md) | Użytkownik | Przeglądarka vs desktop, USB, Build/Flash/OTA, ustawienia |
| [developer-setup.md](./developer-setup.md) | Contributor | Node/Rust, skrypty npm, `compile:full`, CI, env, konwencje PR |
| [architecture.md](./architecture.md) | Contributor | Warstwy UI / platform / Tauri, **IPC commands**, eventy, przepływy serial/flash/OTA |
| [roadmap-next.md](./roadmap-next.md) | Wszystkich | Stan po board-catalog community validation + plan 18+ (ops / human) |

## Screenshoty UI

Oficjalne zrzuty (locale **PL**, web Vite, ~1440×900) — także w [README głównym](../README.md#screenshots):

| Widok | Plik |
|-------|------|
| Symulator | [media/simulator.png](./media/simulator.png) |
| Edytor UI | [media/editor.png](./media/editor.png) |
| USB / flash | [media/usb-flash.png](./media/usb-flash.png) |
| Automatyzacje | [media/automations.png](./media/automations.png) |
| Marketplace | [media/marketplace.png](./media/marketplace.png) |
| Ustawienia | [media/settings.png](./media/settings.png) |

## Platforma i dane

| Dokument | Temat |
|----------|--------|
| [board-catalog.md](./board-catalog.md) | Community board PR flow + walidacja offset ↔ esptool + bundled parity |
| [marketplace-plugin-api.md](./marketplace-plugin-api.md) | Manifest v2, podpisy Ed25519, allowlista hostów, sandbox |
| [marketplace-publishers.md](./marketplace-publishers.md) | Onboarding publisherów + sandbox demo (≠ live keys) |
| [telemetry.md](./telemetry.md) | Opt-in telemetria, retencja, opt-out, collector ops |
| [windows-diagnostics.md](./windows-diagnostics.md) | Log lokalny + eksport ZIP + board sync |

## Desktop Windows

| Dokument | Temat |
|----------|--------|
| [windows-desktop.md](./windows-desktop.md) | Tray, autostart, i18n PL/EN, kanały update |
| [windows-installer.md](./windows-installer.md) | NSIS / MSI, WebView2 |
| [windows-drivers.md](./windows-drivers.md) | CH340 / CP210x / Espressif USB |
| [windows-signing.md](./windows-signing.md) | Authenticode OV/EV (sekrety człowieka) |
| [windows-smartscreen.md](./windows-smartscreen.md) | Checklist SmartScreen + EV |
| [windows-updater.md](./windows-updater.md) | Auto-update Tauri (stable / beta) |
| [windows-winget.md](./windows-winget.md) | Szablony + draft CI (publish = human) |
| [windows-deep-link.md](./windows-deep-link.md) | `esp32studio://`, `.esp32studio` |
| [windows-pc-agent.md](./windows-pc-agent.md) | Agent CPU/RAM/dysk |

## Build / Flash / OTA

| Dokument | Temat |
|----------|--------|
| [esp32-tooling-integrations.md](./esp32-tooling-integrations.md) | Free tools: PlatformIO, Arduino CLI/IDE, esptool, ESP-IDF detect, Wokwi |
| [windows-build-flash.md](./windows-build-flash.md) | Build-from-Studio (PIO / arduino-cli) |
| [windows-flash.md](./windows-flash.md) | Flash helper (`esptool`) |
| [windows-sidecar-pio.md](./windows-sidecar-pio.md) | Offline PlatformIO + espota |
| [windows-ota.md](./windows-ota.md) | OTA Wi‑Fi + mDNS (`mdns-sd`) |

## Linux / macOS

| Dokument | Temat |
|----------|--------|
| [desktop-unix.md](./desktop-unix.md) | Serial/flash/OTA na Unix + CI AppImage/deb/dmg + signed updater overlays |
| [macos-notarize.md](./macos-notarize.md) | Opcjonalny codesign / notarize (sekrety człowieka) |

## Co nie jest „gotowe na sklep”

Te elementy są w repo jako **szablony / checklisty** — nie oznaczają live dystrybucji:

- Live merge do `microsoft/winget-pkgs` (draft CI OK; review człowieka)
- Authenticode EV / reputacja SmartScreen (sekrety + podpis poza agentem)
- Notaryzacja macOS / submit do store (docs + opcjonalne CI hooks; sekrety Apple u właściciela)
- Live collector telemetrii + publisher private keys marketplace
- (zrobione) Oficjalne screenshoty UI — [`docs/media/`](./media/) (`simulator`, `editor`, `usb-flash`, `automations`, `marketplace`, `settings`)

**Nie** dokumentuj wymyślonych URL releasów, SHA256 instalatorów ani wartości sekretów.

Powrót do [README głównego](../README.md).
