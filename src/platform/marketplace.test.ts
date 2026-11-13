import {
  BUNDLED_MARKETPLACE_CATALOG,
  BUNDLED_MARKETPLACE_PACKS,
  exportRulePack,
  exportWidgetPack,
  isMarketplaceCatalog,
  parseMarketplacePack,
  parseMarketplacePackJson,
  sandboxImportRules,
  sandboxImportWidgets,
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

console.log('marketplace.test.ts: OK');
