# SmartScreen / reputacja podpisów

Checklist człowieka (Faza 12 → **Faza 14 EV**).  
Cel: po pierwszym **Authenticode-signed** instalatorze (NSIS/MSI) i ścieżce winget — monitorować SmartScreen oraz (opcjonalnie) przejść na **EV Code Signing**.  
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
6. **OV vs EV** — jeśli OV długo nie zbiera reputacji: kup **EV Code Signing** (token/HSM). Zob. sekcja EV poniżej.

## EV Code Signing — checklista (Faza 14)

EV (Extended Validation) zwykle skraca okres ostrzeżeń SmartScreen względem OV, bo tożsamość wydawcy jest silniej zweryfikowana. **Certyfikat, PIN tokena i thumbprint zostają po stronie człowieka** — agent / CI nie inventuje sekretów.

### Zakup i sprzęt

- [ ] Wybierz CA wspierający EV Code Signing na tokenie USB / HSM (np. DigiCert, Sectigo, GlobalSign — lista nie jest endorsmentem).
- [ ] Zamów EV **Code Signing** (nie tylko OV SSL / document signing).
- [ ] Odebranie tokena / provisioning HSM wg instrukcji CA; ustaw silny PIN; zrób backup recovery **offline**.
- [ ] Na maszynie build (lub runnerze self-hosted z tokenem): zainstaluj sterownik tokena + Windows SDK `signtool`.

### Lokalny / CI podpis EV

- [ ] Odczytaj thumbprint z magazynu po podłączeniu tokena:
  ```powershell
  Get-ChildItem Cert:\CurrentUser\My | Format-List Subject, Thumbprint, EnhancedKeyUsageList
  ```
- [ ] Skopiuj `src-tauri/tauri.windows-signing.example.json` → `tauri.windows-signing.local.json` i wstaw **tylko** thumbprint (plik lokalny jest w `.gitignore`).
- [ ] Dla GitHub Actions: sekrety `WINDOWS_CERTIFICATE*` tylko jeśli CA/workflow pozwala na eksport / cloud HSM. **Token USB w chmurze GitHub-hosted nie jest dostępny** — preferuj self-hosted runner z podłączonym tokenem albo Azure Key Vault / cloud HSM.
- [ ] Po buildzie: `signtool verify /pa /v` na NSIS **i** MSI; Subject powinien wskazywać EV (nazwa organizacji zgodna z CA).

### Reputacja po EV

- [ ] Opublikuj **jeden** oficjalny kanał dystrybucji (GitHub Releases + opcjonalnie winget) — unikaj mirrorów bez podpisu.
- [ ] Przez pierwsze 1–2 tygodnie: test na czystej VM Win10 + Win11 (Home/Pro).
- [ ] Zapisz w prywatnym trackerze: data releasu, czy SmartScreen pokazał warning, liczba znanych instalacji (przybliżenie).
- [ ] Nie resetuj reputacji przez częstą zmianę Subject / nowego certu bez potrzeby.

### Czego EV nie załatwia

- Nie zastępuje poprawnego timestampu (`timestampUrl` w `tauri.conf.json`).
- Nie usuwa ostrzeżeń przy **niepodpisanym** updater artifact — potrzebny też klucz Tauri updater (`TAURI_SIGNING_PRIVATE_KEY`).
- Nie jest wymagany do draft winget; live `winget-pkgs` i tak wymaga ludzkiego SHA z prawdziwego assetu.

## Czego nie robić w PR / CI

- Nie commituj `.pfx`, haseł, thumbprintów produkcyjnych, PIN-ów tokena
- Nie wstawiaj placeholderów SHA256 jako „prawdziwych”
- Nie generuj self-signed „produkcyjnych” certów pod SmartScreen
- Nie udawaj EV w docs / release notes bez faktycznego certyfikatu

## Powiązane

- [windows-signing.md](./windows-signing.md)
- [windows-winget.md](./windows-winget.md)
- [windows-installer.md](./windows-installer.md)
- [windows-updater.md](./windows-updater.md)
