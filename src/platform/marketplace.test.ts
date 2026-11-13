import { webcrypto } from 'node:crypto';
import {
  BUNDLED_MARKETPLACE_CATALOG,
  BUNDLED_MARKETPLACE_PACKS,
  clearTrustedPublishers,
  exportRulePack,
  exportWidgetPack,
  isAllowedMarketplaceUrl,
  isMarketplaceCatalog,
  parseMarketplacePack,
  parseMarketplacePackJson,
  registerTrustedPublisher,
  sandboxImportRules,
  sandboxImportWidgets,
  signMarketplacePack,
  verifyMarketplacePackSignature,
} from './marketplace';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(isMarketplaceCatalog(BUNDLED_MARKETPLACE_CATALOG), 'catalog shape');
assert(BUNDLED_MARKETPLACE_CATALOG.entries.length >= 2, 'has entries');

for (const pack of Object.values(BUNDLED_MARKETPLACE_PACKS)) {
  const parsed = parseMarketplacePack(pack);
  assert(parsed.ok, `bundled pack ${pack.id} parses`);
}

const badScript = parseMarketplacePack({
  format: 'esp32studio-marketplace',
  kind: 'widget_pack',
  version: 1,
  id: 'evil',
  title: 'Evil',
  widgets: [
    {
      id: 'w1',
      type: 'text',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      script: 'alert(1)',
    },
  ],
});
assert(!badScript.ok, 'rejects script key');
assert(badScript.ok === false && badScript.error.includes('Forbidden'), 'forbidden message');

const badEval = parseMarketplacePackJson(
  JSON.stringify({
    format: 'esp32studio-marketplace',
    kind: 'rule_pack',
    version: 1,
    id: 'evil2',
    title: 'Evil2',
    rules: [
      {
        id: 'r1',
        name: 'x',
        enabled: true,
        trigger: { type: 'pir_motion' },
        action: { type: 'set_brightness', brightness: 10, eval: '1+1' },
      },
    ],
  }),
);
assert(!badEval.ok, 'rejects eval key');

const unknownType = parseMarketplacePack({
  format: 'esp32studio-marketplace',
  kind: 'widget_pack',
  version: 1,
  id: 'bad-type',
  title: 'Bad',
  widgets: [{ id: 'w', type: 'malware_widget', x: 0, y: 0, width: 1, height: 1 }],
});
assert(!unknownType.ok, 'rejects unknown widget type');

const status = BUNDLED_MARKETPLACE_PACKS['status-strip'];
assert(status.kind === 'widget_pack', 'status strip kind');
const ids = new Set<string>(['m_clock']);
const imported = sandboxImportWidgets(status, ids);
assert(imported.length === 2, 'import widgets count');
assert(imported.every(w => w.id.startsWith('mkt_')), 'remapped ids');
assert(!imported.some(w => w.id === 'm_clock'), 'no collision with existing');

const night = BUNDLED_MARKETPLACE_PACKS['night-rules'];
assert(night.kind === 'rule_pack', 'night rules kind');
const ruleIds = new Set<string>();
const rules = sandboxImportRules(night, ruleIds);
assert(rules.length === 2, 'import rules count');
assert(rules.every(r => typeof r.enabled === 'boolean'), 'rules enabled boolean');

const exportedW = exportWidgetPack(imported, {
  id: 'export-test',
  title: 'Export test',
  author: 'test',
});
assert(parseMarketplacePack(exportedW).ok, 'round-trip widget export');

const exportedR = exportRulePack(rules, {
  id: 'export-rules',
  title: 'Export rules',
});
assert(parseMarketplacePack(exportedR).ok, 'round-trip rule export');

assert(
  isAllowedMarketplaceUrl(
    'https://raw.githubusercontent.com/mateowoj-cpu/ESP32-App/main/public/marketplace/packs/pc-mini.json',
  ),
  'allowlist github raw',
);
assert(
  !isAllowedMarketplaceUrl('https://evil.example/pack.json'),
  'deny unknown host',
);
assert(
  !isAllowedMarketplaceUrl('http://raw.githubusercontent.com/mateowoj-cpu/ESP32-App/main/x.json'),
  'deny http',
);
assert(isAllowedMarketplaceUrl('/marketplace/packs/pc-mini.json'), 'allow relative marketplace');

// Manifest v2 + Ed25519 signature (ephemeral test key — never a committed secret)
clearTrustedPublishers();
const kp = (await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, [
  'sign',
  'verify',
])) as CryptoKeyPair;
const spki = new Uint8Array(await webcrypto.subtle.exportKey('spki', kp.publicKey));
const pkcs8 = Buffer.from(await webcrypto.subtle.exportKey('pkcs8', kp.privateKey)).toString(
  'base64',
);
const rawPub = spki.subarray(spki.length - 32);
registerTrustedPublisher({
  id: 'test-publisher',
  name: 'Test Publisher',
  publicKeyB64: Buffer.from(rawPub).toString('base64'),
});

const v2base = exportWidgetPack(imported, {
  id: 'signed-demo',
  title: 'Signed demo',
  author: 'test',
  version: 2,
  publisherId: 'test-publisher',
});
const signed = await signMarketplacePack(v2base, pkcs8, 'test-publisher');
assert(signed.version === 2, 'signed pack version 2');
assert(!!signed.signature, 'has signature');
const parsedSigned = parseMarketplacePack(signed);
assert(parsedSigned.ok, 'signed pack parses');
const verified = await verifyMarketplacePackSignature(signed);
assert(verified.ok, 'signature verifies');

const tampered = {
  ...signed,
  title: 'Tampered',
};
const badVerify = await verifyMarketplacePackSignature(tampered);
assert(!badVerify.ok, 'tampered pack fails verify');

const unknownPub = await verifyMarketplacePackSignature({
  ...signed,
  publisherId: 'not-registered',
});
assert(!unknownPub.ok, 'unknown publisher rejected');

clearTrustedPublishers();

console.log('marketplace.test.ts: OK');
