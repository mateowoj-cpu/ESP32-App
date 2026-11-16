# Marketplace sandbox publisher (Faza 17)

Demo trust material for **fixture** signed packs under `public/marketplace/packs/*-signed.json`.

| Item | Policy |
|------|--------|
| Public key | Committed in `public/marketplace/publishers.json` (`studio-sandbox`, `"sandbox": true`) |
| Private key | **Not committed.** Generated once for fixtures; regenerate + re-sign if rotated |
| Live publishers | Offline `sign-pack.mjs --generate` — private keys stay off-repo |

## Regenerate a sandbox signature (maintainer)

```bash
# 1) New disposable keypair (save private offline; update publishers.json publicKeyB64)
node scripts/marketplace/sign-pack.mjs --generate

# 2) Sign a pack (example)
node scripts/marketplace/sign-pack.mjs \
  --pack public/marketplace/packs/status-strip.json \
  --publisher-id studio-sandbox \
  --private-key-file /path/to/offline.pkcs8.b64 \
  --out public/marketplace/packs/status-strip-signed.json
```

Mirror the signed pack into `BUNDLED_MARKETPLACE_PACKS` in `src/platform/marketplace.ts` and keep catalog/`publishers.json` in sync.

## Live onboarding

See [docs/marketplace-publishers.md](../../../docs/marketplace-publishers.md).
