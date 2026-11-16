# Telemetria diagnostyczna (opt-in)

Studio rozdziela **lokalną** diagnostykę flash/COM (log + ZIP) od opcjonalnej
telemetrii **sieciowej** (Faza 13; dopracowanie ops w Fazie 15). Telemetria jest
**domyślnie wyłączona**. Indeks docs: [README.md](./README.md) · lokalny ZIP:
[windows-diagnostics.md](./windows-diagnostics.md).

> **EN:** Opt-in network telemetry (off by default). Only coarse `v` / `os` / `event` / `ok` / `ts` when `VITE_TELEMETRY_ENDPOINT` is set at build time — never serial logs, paths, or PII.

## Co jest wysyłane (tylko po włączeniu)

Preferencja: **Ustawienia → Aplikacja desktopowa → Telemetria diagnostyczna (opt-in)**.

Gdy przełącznik jest włączony **oraz** build definiuje `VITE_TELEMETRY_ENDPOINT`
(URL HTTPS), Studio może wysłać małe ciało JSON metodą POST:

| Pole | Znaczenie |
|------|-----------|
| `v` | Wersja aplikacji (np. `0.2.10`) |
| `os` | Zgrubny system: `windows` / `macos` / `linux` / `other` |
| `event` | `app_open`, `build_result`, `flash_result`, `ota_result`, `diag_export`, `board_sync` |
| `ok` | Opcjonalny boolean dla zdarzeń wynikowych |
| `ts` | Znacznik czasu Unix (ms) |

## Czego nigdy nie wysyłamy

- Tekst monitora serial, logi boot, adresy MAC, numery seryjne chipa
- Ścieżki plików, JSON projektu, hasła Wi‑Fi, hasła OTA
- Identyfikatory osobowe, e-maile, nazwy maszyn, adresy IP
- Zawartość ZIP diagnostyki (ZIP zostaje lokalnie — [windows-diagnostics.md](./windows-diagnostics.md))

## Endpoint (`VITE_TELEMETRY_ENDPOINT`)

- Ustaw `VITE_TELEMETRY_ENDPOINT=https://…` w czasie **buildu** desktop/web, jeśli ten build ma móc raportować.
- Bez zmiennej środowiskowej włączenie przełącznika zapisuje tylko zgodę — **bez wywołań sieciowych**.
- **Nie** commituj sekretów ani prywatnych tokenów collectora do gita.
- Udokumentowane w `.env.example` (zakomentowane). CI może wstrzyknąć sekret jako env builda tylko gdy człowiek to skonfiguruje.

Przykład (lokalnie / CI — nigdy nie commituj prawdziwego URL z tokenem):

```bash
VITE_TELEMETRY_ENDPOINT=https://telemetry.example.com/v1/ingest
```

## Opt-out

| Warstwa | Zachowanie |
|---------|------------|
| Domyślnie | Preferencja wyłączona (brak klucza w `localStorage`) |
| Przełącznik UI | **Ustawienia → Desktop → Telemetria** → wyłączenie czyści zgodę (`esp32_telemetry` ≠ `1`) |
| Build bez endpointu | Nawet przy włączonym przełączniku klient nic nie robi |
| Odinstalowanie / czyszczenie danych witryny | Usuwa zgodę z `localStorage` |

Przy wyłączonej preferencji nie ma żadnego „phone-home” w tle.

## Retencja (ops collectora — człowiek)

Studio **nie** hostuje collectora. Kto uruchamia `VITE_TELEMETRY_ENDPOINT`, powinien opublikować retencję. Zalecany baseline:

| Polityka | Rekomendacja |
|----------|--------------|
| Retencja | ≤ 90 dni, potem usunięcie lub agregacja do anonimowych liczników |
| Dostęp | Tylko ops; bez adtech / odsprzedaży |
| Dane osobowe | Payload z założenia ich nie zawiera — logi wokół collectora i tak traktuj jako wrażliwe |
| Usuwanie | Runbook „usuń wszystkie zdarzenia przed datą X” |
| Prawo | Link do noty prywatności w release notes, jeśli wysyłasz live endpoint |

### Minimalna checklista collectora

1. Ingest tylko HTTPS, `POST` JSON zgodny z tabelą powyżej (ignoruj nieznane pola).
2. Rate-limit po zgrubnym IP; odrzucaj ciała >2 KiB.
3. Przechowuj tylko `v`, `os`, `event`, `ok`, `ts`.
4. Opisz retencję i opt-out na stronie prywatności; podlinkuj z release notes.
5. Rotuj tokeny ingest poza repo — nigdy nie wkładaj ich do tego gita.

### Przykładowe ciało żądania

```json
{ "v": "0.2.10", "os": "windows", "event": "flash_result", "ok": true, "ts": 1730000000000 }
```

## Implementacja

- Klucz preferencji: `localStorage` `esp32_telemetry` (`1` = włączone)
- Klient: `src/platform/telemetry.ts`
- UI: panel ustawień desktop
