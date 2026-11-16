# Marketplace — publisherzy (Faza 17)

Paczki danych pozostają w **sandboxie / bez eval**. Podpisy uwierzytelniają JSON; nigdy nie uprawniają do wykonywania kodu.

> **EN:** Publishers file holds Ed25519 **public** keys only. Sandbox `studio-sandbox` is demo/CI — replace before production. Never commit live private keys.

## Model zaufania

| Warstwa | Rola |
|---------|------|
| `public/marketplace/publishers.json` | Klucze **publiczne** Ed25519 (`id`, `name`, `publicKeyB64`, opcjonalnie `sandbox`) |
| `publisherId` + `signature` w paczce | Autentyczność manifestu v2 |
| `requireSignature: true` w katalogu | Instalacja kończy się błędem bez weryfikacji podpisu |

Klucze prywatne: **tylko offline**. Nigdy nie commituj żywego materiału PKCS8.

## Demo sandbox (`studio-sandbox`)

- Klucz publiczny jest w repo i oznaczony `"sandbox": true`.
- Paczka fixture: `public/marketplace/packs/status-strip-signed.json` (lustrzanie w `BUNDLED_MARKETPLACE_PACKS`).
- Klucz prywatny tego demo wygenerowano raz pod fixture i **nie** jest w gicie.
- Regeneracja: [scripts/marketplace/sandbox/README.md](../scripts/marketplace/sandbox/README.md).

Zaufanie sandbox służy CI / docs / demo UI — przed dystrybucją produkcyjną zastąp własnymi publisherami live.

## Onboarding publishera live (człowiek)

1. Offline: `node scripts/marketplace/sign-pack.mjs --generate`
2. Zapisz klucz prywatny PKCS8 w menedżerze haseł / HSM — **nie** w repo.
3. Otwórz PR dodający wyłącznie klucz **publiczny** do `publishers.json` (`sandbox` pominięte lub `false`).
4. Podpisz paczki społecznościowe z `--publisher-id <twoje-id>` i umieść JSON w `public/marketplace/packs/` (ścieżka z allowlisty).
5. Dodaj wpis katalogu z `publisherId` i `requireSignature: true`, gdy paczka musi być podpisana.
6. Zsynchronizuj bundled katalog/paczki/publisherów w `src/platform/marketplace.ts` przy offline fallback.
7. Recenzent: zweryfikuj podpis w Studio / testach jednostkowych; odrzuć pliki z kluczem prywatnym.

## Checklista (PR)

- [ ] Brak plików `.pkcs8`, `.pem` ani kluczy prywatnych w difie
- [ ] `publicKeyB64` to 32 surowe bajty Ed25519 (base64)
- [ ] Podpisane paczki przechodzą `parseMarketplacePack` i weryfikację po rejestracji publishera
- [ ] Marketplace nadal tylko dane (bez pól `script` / `eval` / WASM)
- [ ] `npm run test:marketplace` zielony

## Powiązane

- [marketplace-plugin-api.md](./marketplace-plugin-api.md)
- [roadmap-next.md](./roadmap-next.md)
