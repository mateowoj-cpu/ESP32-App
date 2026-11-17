# Marketplace — board packs i GitHub add-ons

> **EN:** Marketplace catalog kinds now include `board_pack` (VID:PID flash profiles) and `github_addon` (curated GitHub links opened in the browser — never fetched or executed). Users can add local options via the **Add option** form.

Indeks: [README.md](./README.md) · schemat paczek: [marketplace-plugin-api.md](./marketplace-plugin-api.md).

## Rodzaje katalogu

| `kind` | Zachowanie |
|--------|------------|
| `widget_pack` / `rule_pack` | Instalacja JSON w sandboxie (bez `eval`) |
| `board_pack` | Profile flash VID:PID → walidacja community board-catalog + cache `boardSync` |
| `github_addon` | Tylko link `https://github.com/owner/repo` (otwórz w przeglądarce) |

## UX

- Filtry: All / Widgets / Rules / **Boards** / **GitHub**
- Formularz **Dodaj opcję** — lokalne GitHub add-ony i profile board (`localStorage`)
- Import JSON nadal obsługuje widget / rule / board packs
- i18n PL / EN dla nowych stringów

## Bezpieczeństwo

- Model bez zmian: brak `eval` / WASM / zdalnego kodu
- GitHub add-ony: wyłącznie allowlisted `https://github.com/…`
- Board packs: te same reguły offset ↔ chip co [board-catalog.md](./board-catalog.md)

## Bundled (przykłady)

- Widget pack `oled-pet-dash`
- Board pack `usb-bridges` (CH340 / CP210x / CH9102 / S3)
- Curated GitHub add-ony w `public/marketplace/catalog.json` (u8g2, LVGL, TFT_eSPI, FastLED, …)

Implementacja: `MarketplaceView`, `src/platform/marketplace.ts`, `src/platform/marketplaceOptions.ts`.
