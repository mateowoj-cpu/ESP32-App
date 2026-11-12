# Podpis Authenticode (Windows) — ESP32 Display Studio

Cel: podpisane instalatory **NSIS** (`.exe`) i **MSI**, żeby SmartScreen nie blokował pierwszego uruchomienia.

## Wymagania

- Certyfikat **Code Signing** (OV lub EV; EV szybciej buduje reputację SmartScreen)
- Plik `.pfx` (lub certyfikat w magazynie Windows / Azure Key Vault)
- Windows z **signtool.exe** (Windows SDK / VS Build Tools) — standardowa ścieżka Tauri

## Konfiguracja w projekcie

Bazowa konfiguracja (algorytm + timestamp) jest już w `src-tauri/tauri.conf.json`:

- `bundle.windows.digestAlgorithm`: `sha256`
- `bundle.windows.timestampUrl`: `http://timestamp.digicert.com`

Thumbprint ustawiasz lokalnie przez plik nakładki (nie commituj prawdziwego thumbprintu):

```powershell
Copy-Item src-tauri\tauri.windows-signing.example.json src-tauri\tauri.windows-signing.local.json
# Wstaw SHA1 thumbprint certyfikatu
npm run tauri:build -- --config src-tauri/tauri.windows-signing.local.json
```

`tauri.windows-signing.local.json` jest w `.gitignore`.

## Lokalny podpis (magazyn certyfikatów)

1. Zaimportuj `.pfx` do magazynu **Current User → Personal**.
2. Odczytaj thumbprint:

```powershell
Get-ChildItem Cert:\CurrentUser\My | Format-List Subject, Thumbprint
```

3. Użyj nakładki z tym thumbprintem i zbuduj:

```powershell
npm run tauri:build -- --config src-tauri/tauri.windows-signing.local.json
```

Tauri wywoła `signtool` dla binariów i instalatorów.

## Sekrety GitHub Actions

Workflow `.github/workflows/windows-release.yml` oczekuje (opcjonalnie):

| Secret | Opis |
|--------|------|
| `WINDOWS_CERTIFICATE` | Zawartość `.pfx` zakodowana w Base64 |
| `WINDOWS_CERTIFICATE_PASSWORD` | Hasło do `.pfx` |
| `WINDOWS_CERTIFICATE_THUMBPRINT` | SHA1 thumbprint (bez spacji) |

Bez tych sekretów job **buduje niepodpisany** instalator (przydatne do smoke). Z sekretami importuje certyfikat i podpisuje.

### Jak przygotować Base64 z .pfx

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes(".\code-sign.pfx")) | Set-Clipboard
```

Wklej wynik jako secret `WINDOWS_CERTIFICATE`.

## Weryfikacja podpisu

```powershell
Get-AuthenticodeSignature ".\src-tauri\target\release\bundle\nsis\*.exe"
signtool verify /pa /v "ścieżka\do\instalatora.exe"
```

Status powinien być `Valid`.

## SmartScreen

Nawet po podpisie OV pierwsze pobrania mogą mieć ostrzeżenie, dopóki certyfikat nie zbierze reputacji. EV zwykle skraca ten okres. Publikuj instalatory z oficjalnej strony / GitHub Releases.

## Powiązane

- [Sterowniki USB](./windows-drivers.md)
- [Instalator Windows](./windows-installer.md)
