# Podpis Authenticode (Windows) — ESP32 Display Studio

Cel: podpisane instalatory **NSIS** (`.exe`) i **MSI**, żeby SmartScreen nie blokował pierwszego uruchomienia.

## Wymagania

- Certyfikat **Code Signing** (OV lub **EV**; EV szybciej buduje reputację SmartScreen — zob. [windows-smartscreen.md](./windows-smartscreen.md))
- Plik `.pfx` (OV) **albo** certyfikat na tokenie USB / HSM (typowe dla EV)
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

## Lokalny podpis (magazyn certyfikatów / OV .pfx)

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

## EV na tokenie / HSM (Faza 14)

1. Podłącz token USB (lub skonfiguruj HSM) i odblokuj PIN **tylko** na maszynie build.
2. Upewnij się, że certyfikat pojawia się w `Cert:\CurrentUser\My` z EKU *Code Signing*.
3. Thumbprint → `tauri.windows-signing.local.json` (nigdy do gita).
4. GitHub-hosted runners **nie** widzą lokalnego tokena USB:
   - self-hosted Windows runner z podłączonym tokenem, **albo**
   - cloud HSM / Key Vault wspierany przez CA + sekrety CI zgodne z polityką CA.
5. Po buildzie zweryfikuj Subject (nazwa organizacji EV) i timestamp.

Pełna checklista reputacji / SmartScreen: [windows-smartscreen.md](./windows-smartscreen.md).

## Sekrety GitHub Actions

Workflow `.github/workflows/windows-release.yml` oczekuje (opcjonalnie):

| Secret | Opis |
|--------|------|
| `WINDOWS_CERTIFICATE` | Zawartość `.pfx` zakodowana w Base64 (głównie OV; EV często nie eksportuje się do `.pfx`) |
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

Pełna checklista monitoringu reputacji (po signed winget / Releases): [windows-smartscreen.md](./windows-smartscreen.md).

## Powiązane

- [SmartScreen / reputacja / EV](./windows-smartscreen.md)
- [Sterowniki USB](./windows-drivers.md)
- [Instalator Windows](./windows-installer.md)
