# Marketplace publishers (Faza 17)

Data-only packs remain **sandbox / no eval**. Signatures authenticate JSON; they never authorize code execution.

## Trust model

| Layer | Role |
|-------|------|
| `public/marketplace/publishers.json` | Ed25519 **public** keys (`id`, `name`, `publicKeyB64`, optional `sandbox`) |
| Pack `publisherId` + `signature` | Manifest v2 authenticity |
| Catalog `requireSignature: true` | Install fails unless signature verifies |

Private keys: **offline only**. Never commit live PKCS8 material.

## Sandbox demo (`studio-sandbox`)

- Public key is committed and marked `"sandbox": true`.
- Fixture pack: `public/marketplace/packs/status-strip-signed.json` (mirrored in `BUNDLED_MARKETPLACE_PACKS`).
- Private key for that demo was generated once for fixtures and is **not** in git.
- Regenerate: [scripts/marketplace/sandbox/README.md](../scripts/marketplace/sandbox/README.md).

Sandbox trust is for CI / docs / UI demos — replace with your own live publishers before production distribution.

## Live publisher onboarding (human)

1. Offline: `node scripts/marketplace/sign-pack.mjs --generate`
2. Store PKCS8 private key in a password manager / HSM — **not** the repo.
3. Open a PR adding only the **public** key to `publishers.json` (`sandbox` omitted or `false`).
4. Sign community packs with `--publisher-id <your-id>` and place JSON under `public/marketplace/packs/` (allowlisted host path).
5. Add catalog entry with `publisherId` and `requireSignature: true` when the pack must be signed.
6. Mirror bundled catalog/packs/publishers in `src/platform/marketplace.ts` when shipping offline fallback.
7. Reviewer: verify signature with Studio / unit tests; reject any private key files.

## Checklist (PR)

- [ ] No `.pkcs8`, `.pem`, or private key files in the diff
- [ ] `publicKeyB64` is 32 raw Ed25519 bytes (base64)
- [ ] Signed packs parse via `parseMarketplacePack` and verify after registering the publisher
- [ ] Marketplace still data-only (no `script` / `eval` / WASM fields)
- [ ] `npm run test:marketplace` green

## Powiązane

- [marketplace-plugin-api.md](./marketplace-plugin-api.md)
- [roadmap-next.md](./roadmap-next.md)
