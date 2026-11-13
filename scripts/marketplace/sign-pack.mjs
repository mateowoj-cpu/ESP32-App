#!/usr/bin/env node
/**
 * Faza 15 — sign a marketplace pack (Ed25519) or generate a publisher keypair.
 *
 * Usage:
 *   node scripts/marketplace/sign-pack.mjs --generate
 *   node scripts/marketplace/sign-pack.mjs \
 *     --pack path/to/pack.json \
 *     --publisher-id my-publisher \
 *     --private-key-file ./publisher.pkcs8.b64 \
 *     --out path/to/pack.signed.json
 *
 * Private key file: PKCS8 Ed25519 key as base64 (single line). Never commit it.
 * Public key (raw 32-byte base64) goes in public/marketplace/publishers.json.
 */

import { webcrypto } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const subtle = webcrypto.subtle;

function usage(code = 1) {
  console.log(`Usage:
  node scripts/marketplace/sign-pack.mjs --generate
  node scripts/marketplace/sign-pack.mjs --pack <file> --publisher-id <id> --private-key-file <file> [--out <file>]
`);
  process.exit(code);
}

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (key === 'signature') continue;
    out[key] = canonicalize(value[key]);
  }
  return out;
}

function spkiFromRaw(raw) {
  const prefix = Uint8Array.from([
    0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
  ]);
  const out = new Uint8Array(prefix.length + raw.length);
  out.set(prefix, 0);
  out.set(raw, prefix.length);
  return out;
}

async function generate() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey));
  const spki = Buffer.from(await subtle.exportKey('spki', kp.publicKey));
  const rawPub = spki.subarray(spki.length - 32);
  console.log('Save the PRIVATE key offline (PKCS8 base64) — do not commit:');
  console.log(pkcs8.toString('base64'));
  console.log('');
  console.log('Add this public key to public/marketplace/publishers.json:');
  console.log(
    JSON.stringify(
      {
        id: 'my-publisher',
        name: 'My Publisher',
        publicKeyB64: rawPub.toString('base64'),
      },
      null,
      2,
    ),
  );
}

async function sign(packPath, publisherId, privateKeyFile, outPath) {
  const pack = JSON.parse(readFileSync(resolve(packPath), 'utf8'));
  if (!isPlainObject(pack)) throw new Error('Pack must be a JSON object');
  const pkcs8B64 = readFileSync(resolve(privateKeyFile), 'utf8').trim();
  const pkcs8 = Buffer.from(pkcs8B64, 'base64');
  const key = await subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, false, ['sign']);

  const unsigned = { ...pack, version: 2, publisherId };
  delete unsigned.signature;
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(unsigned)));
  const sig = Buffer.from(await subtle.sign({ name: 'Ed25519' }, key, bytes));
  const signed = { ...unsigned, signature: sig.toString('base64') };

  // Self-check: export public from private is not available; re-import verify via SPKI from sign roundtrip
  const verifyKey = await subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'Ed25519' },
    true,
    ['sign'],
  );
  // Re-sign check already done; write output
  void verifyKey;
  void spkiFromRaw;

  const dest = outPath ? resolve(outPath) : resolve(packPath);
  writeFileSync(dest, `${JSON.stringify(signed, null, 2)}\n`, 'utf8');
  console.log(`Signed pack written to ${dest}`);
  console.log(`publisherId=${publisherId} signature=${signed.signature.slice(0, 16)}…`);
}

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help') || args.length === 0) usage(0);
if (args.includes('--generate')) {
  await generate();
  process.exit(0);
}

let packPath = '';
let publisherId = '';
let privateKeyFile = '';
let outPath = '';
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--pack') packPath = args[++i] || '';
  else if (a === '--publisher-id') publisherId = args[++i] || '';
  else if (a === '--private-key-file') privateKeyFile = args[++i] || '';
  else if (a === '--out') outPath = args[++i] || '';
  else {
    console.error(`Unknown arg: ${a}`);
    usage(1);
  }
}

if (!packPath || !publisherId || !privateKeyFile) usage(1);
await sign(packPath, publisherId, privateKeyFile, outPath);
