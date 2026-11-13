# SmartScreen / reputacja podpisów

Checklist człowieka (od Fazy 12; EV / pełna reputacja = backlog Fazy 14).  
Cel: po pierwszym **Authenticode-signed** instalatorze (NSIS/MSI) i ścieżce winget — monitorować SmartScreen.  
**Bez fałszywych certyfikatów, hashów ani sekretów w repo.** Indeks: [README.md](./README.md).

## Co robi Studio w repo

- Konfiguracja podpisu + timestamp: [windows-signing.md](./windows-signing.md)
- Szablon winget + checklista PR: [windows-winget.md](./windows-winget.md), `packaging/winget/…`
- CI release podpisuje **tylko** gdy sekrety `WINDOWS_CERTIFICATE*` są ustawione u właściciela

## Checklista człowieka (po signed release)

1. **Release** — opublikuj signed NSIS z tagu `vX.Y.Z` (GitHub Releases).
2. **Weryfikacja podpisu** na czystej Windows 10/11:
   ```powershell
   Get-AuthenticodeSignature ".\ESP32.Display.Studio_*_x64-setup.exe"
   signtool verify /pa /v ".\ESP32.Display.Studio_*_x64-setup.exe"
   ```
3. **Pierwsze pobranie** — zainstaluj z Releases / oficjalnej strony; zanotuj czy SmartScreen pokazuje „Windows protected your PC”.
4. **winget** — uzupełnij `InstallerSha256` z **rzeczywistego** assetu (nie wymyślaj) i otwórz PR do `microsoft/winget-pkgs` wg [windows-winget.md](./windows-winget.md).
5. **Monitoring reputacji** (tygodniowo przez ~2–4 tygodnie po dystrybucji):
   - [ ] SmartScreen nadal ostrzega przy świeżej instalacji?
   - [ ] Ostrzeżenie znika po „More info → Run anyway” + kilku instalacjach?
   - [ ] winget install przechodzi bez dodatkowego promptu SmartScreen?
6. **EV vs OV** — jeśli OV długo nie zbiera reputacji: rozważ zakup **EV Code Signing** (token/HSM); thumbprint tylko w lokalnej nakładce / GitHub Secrets, nigdy w gicie.

## Czego nie robić w PR / CI

- Nie commituj `.pfx`, haseł, thumbprintów produkcyjnych
- Nie wstawiaj placeholderów SHA256 jako „prawdziwych”
- Nie generuj self-signed „produkcyjnych” certów pod SmartScreen

## Powiązane

- [windows-signing.md](./windows-signing.md)
- [windows-winget.md](./windows-winget.md)
- [windows-installer.md](./windows-installer.md)
