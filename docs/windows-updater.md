# Auto-update (Tauri)

ESP32 Display Studio używa `tauri-plugin-updater`.

## Jak działa

1. Release CI buduje NSIS/MSI **oraz** artefakty updatera (`.sig` + `latest.json`).
2. Aplikacja sprawdza endpoint zależny od kanału (Ustawienia → Desktop):

   - **stable:** `releases/latest/download/latest.json`
   - **beta:** `releases/latest/download/latest-beta.json`

3. Po pobraniu aktualizacji restartuje się (`plugin-process` → `relaunch`).

W UI: przycisk **Update** w nagłówku (tylko shell Tauri) oraz banner, gdy jest nowa wersja.
Aktualna linia produktowa: **0.2.6** (Windows updater; nakładki Unix mają `createUpdaterArtifacts: false` — zob. [desktop-unix.md](./desktop-unix.md)).

## Klucze podpisu updatera

Publiczny klucz jest w `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`.

Sekrety GitHub Actions:

| Secret | Opis |
|--------|------|
| `TAURI_SIGNING_PRIVATE_KEY` | Zawartość prywatnego klucza (minisign / tauri signer) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Hasło klucza (jeśli ustawione) |

Bez prywatnego klucza `createUpdaterArtifacts` w CI **nie podpisze** paczki aktualizacji — instalator NSIS/MSI i tak powstanie, ale auto-update nie zadziała.

### Regeneracja kluczy

```bash
npx tauri signer generate -w ./src-tauri/.updater-key.local
```

1. Wstaw **publiczny** klucz do `tauri.conf.json`.
2. Zapisz prywatny jako secret `TAURI_SIGNING_PRIVATE_KEY`.
3. Nie commituj pliku prywatnego (jest w `.gitignore`).

## Wymagania po stronie release

- Tag `v*` (np. `v0.1.1`) albo ręczne `workflow_dispatch`
- Plik `latest.json` w assets releasu (generuje Tauri bundler / tauri-action)
- Endpoint w config wskazuje na `releases/latest/download/latest.json`

## Test ręczny

1. Zainstaluj starszą wersję Studio.
2. Opublikuj nowszy tag z podpisanymi artefaktami.
3. Uruchom Studio → **Update** → zainstaluj → aplikacja się zrestartuje.
