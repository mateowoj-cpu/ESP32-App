# Community board catalog (Faza 16)

Katalog flash presets dla popularnych VID:PID żyje w
[`public/board-profiles/community.json`](../public/board-profiles/community.json).
Aplikacja ładuje go przez `boardSync` (remote `main` → fallback bundlowany).

## Pola profilu

| Pole | Wymagane | Opis |
|------|----------|------|
| `id` | tak | Unikalny slug (kebab-case) |
| `label` | tak | Nazwa widoczna dla człowieka |
| `vid` / `pid` | tak | 4 hex cyfry, lowercase preferowane (`10c4`, `ea60`) |
| `chip` | tak | Identyfikator **esptool** (`esp32`, `esp32s3`, `esp32c3`, …) |
| `offset` | tak | Hex offset flash (`0x0` merged, `0x1000` klasyczny ESP32) |
| `baud` | tak | Baud flash (≥ 9600) |
| `boardProfile` | tak | Musi równać się `chip` (lub `auto`) — mapowanie PIO w Studio |

## Reguły offset ↔ chip (walidator)

- **esp32** (klasyczny): `0x0` **lub** `0x1000`
- **esp32s2 / s3 / c2 / c3 / c5 / c6 / h2 / p4**: domyślnie **`0x0`** (merged image)
- Wpisy `PLACEHOLDER` w `id` mogą ostrzegać zamiast failować przy nietypowym offsecie

Źródła VID/PID i ostrożność offsetów: pole `sources` / `sourcesNote` w JSON.

## Walidacja lokalna / CI

```bash
npm run test:board-catalog
# lub bezpośrednio:
npx tsx scripts/board-profiles/validate-community.ts
```

Smoke (`npm run smoke`) oraz job PR `.github/workflows/smoke.yml` uruchamiają ten test.

## Community PR flow

1. Fork repo → branch od `main`.
2. Dodaj lub popraw profil w `public/board-profiles/community.json`.
3. Zsynchronizuj lustro w `src/platform/boardSync.ts` (`BUNDLED_COMMUNITY_CATALOG`) — bundlowany fallback musi mieć te same profile.
4. Uruchom `npm run test:board-catalog` oraz `npm run test:board-sync`.
5. W PR opisz: skąd wziąłeś VID/PID (link do docs / datasheet), jak zweryfikowałeś offset (merged vs bootloader), oraz że **nie** commitujesz sekretów.
6. Reviewer: sprawdza walidator CI + czy `sources` / nota nie wprowadzają w błąd.

### Checklist autora PR

- [ ] `id` unikalne, bez kolizji
- [ ] `chip` ∈ allowlista esptool
- [ ] `boardProfile` === `chip`
- [ ] Offset zgodny z regułami powyżej (albo jasno oznaczony PLACEHOLDER)
- [ ] Bundled catalog w `boardSync.ts` zaktualizowany
- [ ] `npm run test:board-catalog` zielony

## Powiązane

- [windows-diagnostics.md](./windows-diagnostics.md) — sync w UI
- [windows-flash.md](./windows-flash.md) — offset w Flash Helper
- [architecture.md](./architecture.md) — `boardCache` / `boardSync`
