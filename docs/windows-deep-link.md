# Deep link i asocjacje plików (Windows)

## Protokół `esp32studio://`

Po instalacji Studio rejestruje schemat URL:

| URL | Zachowanie |
|-----|------------|
| `esp32studio://open?path=C:\proj\demo.esp32studio` | Import projektu |
| `esp32studio://import?path=...` | j.w. |
| `esp32studio://C:/proj/demo.esp32studio` | Import (ścieżka w hoście URL) |
| `esp32studio://flash?path=C:\fw.bin` | Otwórz Studio z plikiem firmware |

Single-instance: drugie uruchomienie przekazuje ścieżki do już otwartego okna.

## Asocjacje plików

| Rozszerzenie | Rola |
|--------------|------|
| `.esp32studio` | Projekt Studio (JSON) — podwójne kliknięcie importuje |
| `.ino` | Szkic Arduino — otwiera Studio z powiadomieniem (nie nadpisuje pliku) |

Eksport z UI zapisuje teraz `*.esp32studio` (wcześniej czysty `.json` nadal można importować).

## Format projektu

```json
{
  "format": "esp32studio",
  "version": 1,
  "displayConfig": {},
  "systemConfig": {},
  "apiConfig": {},
  "screens": [],
  "automations": [],
  "exportedAt": "2026-..."
}
```
