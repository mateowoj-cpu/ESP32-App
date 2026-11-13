# Marketplace plugin API (Faza 15)

Data-only community packs — **no arbitrary code**. Docs index: [README.md](./README.md).

## Safety model

| Allowed | Forbidden |
|---------|-----------|
| JSON widget / automation rule packs | `eval`, `Function`, dynamic `import`, WASM |
| Schema validation (known widget/trigger/action enums) | Keys: `script`, `code`, `eval`, `javascript`, `wasm`, `module`, `handler`, `shell`, … |
| Optional Ed25519 signatures over JSON | Executing pack fields as code |
| HTTPS fetch from host allowlist | Arbitrary remote hosts |

Implementation: `src/platform/marketplace.ts` · UI: `MarketplaceView` · CLI: `scripts/marketplace/sign-pack.mjs`.

## Manifest versions

### v1 (Faza 14)

```json
{
  "format": "esp32studio-marketplace",
  "kind": "widget_pack",
  "version": 1,
  "id": "my-pack",
  "title": "My pack",
  "widgets": [ /* UIWidget objects */ ]
}
```

`kind` may also be `rule_pack` with a `rules` array.

### v2 (Faza 15)

Same as v1, plus optional authenticity fields:

| Field | Meaning |
|-------|---------|
| `version` | `2` |
| `publisherId` | Id listed in `public/marketplace/publishers.json` |
| `signature` | Base64 Ed25519 signature over **canonical JSON without `signature`** |

Canonicalization: recursively sort object keys; omit `signature`.

## Catalog (v2)

`public/marketplace/catalog.json` may include per entry:

| Field | Meaning |
|-------|---------|
| `packId` | Bundled / `/marketplace/packs/<id>.json` |
| `packUrl` | Optional HTTPS URL (allowlisted host only) |
| `publisherId` | Expected publisher for signed packs |
| `requireSignature` | When `true`, install fails without a valid signature |

## Host allowlist

Remote fetches (`packUrl` / catalog) accept only:

- Relative `/marketplace/…`
- `https://raw.githubusercontent.com/mateowoj-cpu/ESP32-App/…`

No other hosts. HTTP is rejected.

## Signing (human)

```bash
# 1) Generate keypair (private key stays offline — never commit)
node scripts/marketplace/sign-pack.mjs --generate

# 2) Add publicKeyB64 to public/marketplace/publishers.json

# 3) Sign a pack
node scripts/marketplace/sign-pack.mjs \
  --pack public/marketplace/packs/my-pack.json \
  --publisher-id my-publisher \
  --private-key-file ./publisher.pkcs8.b64 \
  --out public/marketplace/packs/my-pack.json
```

Studio loads publishers from `/marketplace/publishers.json` at catalog refresh.

## Human leftovers

- Populate real publisher public keys after offline keygen
- Host community packs only under the allowlisted repo path (or extend allowlist deliberately)
- Do **not** invent signatures or private keys in git
