# Marketplace — API wtyczek (Faza 15)

Paczki społecznościowe zawierają **wyłącznie dane** — **bez dowolnego kodu**. Indeks docs: [README.md](./README.md).

> **EN:** Data-only community packs (JSON widgets/rules). Schema + optional Ed25519; no `eval` / WASM. Allowlisted HTTPS hosts only.

## Model bezpieczeństwa

| Dozwolone | Zabronione |
|-----------|------------|
| Paczki JSON widgetów / reguł automatyzacji | `eval`, `Function`, dynamiczny `import`, WASM |
| Walidacja schematu (znane enumy widget/trigger/action) | Klucze: `script`, `code`, `eval`, `javascript`, `wasm`, `module`, `handler`, `shell`, … |
| Opcjonalne podpisy Ed25519 nad JSON | Wykonywanie pól paczki jako kodu |
| Pobieranie HTTPS z allowlisty hostów | Dowolne zdalne hosty |

Implementacja: `src/platform/marketplace.ts` · UI: `MarketplaceView` · CLI: `scripts/marketplace/sign-pack.mjs`.

## Wersje manifestu

### v1 (Faza 14)

```json
{
  "format": "esp32studio-marketplace",
  "kind": "widget_pack",
  "version": 1,
  "id": "my-pack",
  "title": "My pack",
  "widgets": [ /* obiekty UIWidget */ ]
}
```

`kind` może też być `rule_pack` z tablicą `rules`.

### v2 (Faza 15)

Jak v1, plus opcjonalne pola autentyczności:

| Pole | Znaczenie |
|------|-----------|
| `version` | `2` |
| `publisherId` | Id z listy `public/marketplace/publishers.json` |
| `signature` | Podpis Ed25519 (Base64) nad **kanonicznym JSON bez `signature`** |

Kanonikalizacja: rekurencyjne sortowanie kluczy obiektów; pomiń `signature`.

## Katalog (v2)

`public/marketplace/catalog.json` może zawierać na wpis:

| Pole | Znaczenie |
|------|-----------|
| `packId` | Paczka lokalna / `/marketplace/packs/<id>.json` |
| `packUrl` | Opcjonalny URL HTTPS (tylko host z allowlisty) |
| `publisherId` | Oczekiwany publisher dla paczek podpisanych |
| `requireSignature` | Gdy `true`, instalacja bez poprawnego podpisu kończy się błędem |

## Allowlista hostów

Zdalne pobierania (`packUrl` / katalog) akceptują wyłącznie:

- Względne `/marketplace/…`
- `https://raw.githubusercontent.com/mateowoj-cpu/ESP32-App/…`

Inne hosty są odrzucane. HTTP jest zabronione.

## Podpisywanie (człowiek)

```bash
# 1) Wygeneruj parę kluczy (klucz prywatny zostaje offline — nigdy nie commituj)
node scripts/marketplace/sign-pack.mjs --generate

# 2) Dodaj publicKeyB64 do public/marketplace/publishers.json

# 3) Podpisz paczkę
node scripts/marketplace/sign-pack.mjs \
  --pack public/marketplace/packs/my-pack.json \
  --publisher-id my-publisher \
  --private-key-file ./publisher.pkcs8.b64 \
  --out public/marketplace/packs/my-pack.json
```

Studio ładuje publisherów z `/marketplace/publishers.json` przy odświeżeniu katalogu.

## Co zostaje po stronie człowieka

- Uzupełnij **live** klucze publiczne publisherów po offline keygen (sandbox `studio-sandbox` jest tylko demo)
- Hostuj paczki społecznościowe wyłącznie pod allowlistowaną ścieżką repo (albo świadomie rozszerz allowlistę)
- **Nie** wymyślaj podpisów ani nie commituj żywych kluczy prywatnych

Zobacz [marketplace-publishers.md](./marketplace-publishers.md).

## Publisherzy (Faza 17)

Onboarding + demo sandbox: [marketplace-publishers.md](./marketplace-publishers.md).
