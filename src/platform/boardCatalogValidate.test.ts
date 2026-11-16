import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const {
  validateCommunityBoardCatalog,
  compareCatalogProfileParity,
  normalizeOffset,
  recommendedOffsetsForChip,
  isKnownEsptoolChip,
  ESPTOOL_CHIP_FAMILIES,
  validateCatalogForApply,
} = await import('./boardCatalogValidate');
const {
  BUNDLED_COMMUNITY_CATALOG,
  acceptCommunityCatalog,
} = await import('./boardSync');

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(normalizeOffset('0x001000') === '0x1000', 'normalize offset');
assert(normalizeOffset('0x0') === '0x0', 'normalize zero');
assert(isKnownEsptoolChip('esp32s3'), 'known s3');
assert(!isKnownEsptoolChip('atmega328'), 'reject avr');
assert(recommendedOffsetsForChip('esp32')?.has('0x1000'), 'classic allows 0x1000');
assert(recommendedOffsetsForChip('esp32s3')?.has('0x0'), 's3 prefers 0x0');
assert(!recommendedOffsetsForChip('esp32s3')?.has('0x1000'), 's3 rejects 0x1000');

// Every non-auto esptool family must expose a recommended offset set.
for (const chip of ESPTOOL_CHIP_FAMILIES) {
  if (chip === 'auto') continue;
  const rec = recommendedOffsetsForChip(chip);
  assert(rec && rec.size > 0, `recommended offsets for ${chip}`);
  if (chip === 'esp32') {
    assert(rec!.has('0x0') && rec!.has('0x1000'), 'classic set');
  } else {
    assert(rec!.has('0x0') && !rec!.has('0x1000'), `${chip} merged @ 0x0 only`);
  }
}

const bundled = validateCommunityBoardCatalog(BUNDLED_COMMUNITY_CATALOG);
assert(bundled.ok, `bundled catalog invalid: ${JSON.stringify(bundled.errors)}`);
assert(bundled.profileCount >= 10, 'bundled profile count');

const here = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(here, '../../public/board-profiles/community.json');
const disk = JSON.parse(readFileSync(jsonPath, 'utf8')) as unknown;
const diskResult = validateCommunityBoardCatalog(disk);
assert(diskResult.ok, `community.json invalid: ${JSON.stringify(diskResult.errors)}`);

const parity = compareCatalogProfileParity(disk, BUNDLED_COMMUNITY_CATALOG);
assert(parity.ok, `bundled/disk parity: ${JSON.stringify(parity.errors)}`);

const badOffset = {
  version: 1,
  updatedAt: '2026-11-16T00:00:00.000Z',
  profiles: [
    {
      id: 'bad-s3-offset',
      label: 'Bad S3',
      vid: '303a',
      pid: '1001',
      chip: 'esp32s3',
      offset: '0x1000',
      baud: 921600,
      boardProfile: 'esp32s3',
    },
  ],
};
const bad = validateCommunityBoardCatalog(badOffset);
assert(!bad.ok, 'should reject s3 @ 0x1000');
assert(
  bad.errors.some(e => e.path.includes('offset')),
  'offset error present',
);

const mismatch = {
  version: 1,
  profiles: [
    {
      id: 'mismatch',
      label: 'Mismatch',
      vid: '10c4',
      pid: 'ea60',
      chip: 'esp32',
      offset: '0x1000',
      baud: 921600,
      boardProfile: 'esp32s3',
    },
  ],
};
const mm = validateCommunityBoardCatalog(mismatch);
assert(!mm.ok, 'boardProfile must match chip');

const placeholderOdd = {
  version: 1,
  updatedAt: '2026-11-16T00:00:00.000Z',
  profiles: [
    {
      id: 'placeholder-odd-offset',
      label: 'PLACEHOLDER odd',
      vid: '0000',
      pid: '0000',
      chip: 'esp32s3',
      offset: '0x1000',
      baud: 921600,
      boardProfile: 'esp32s3',
    },
  ],
};
const ph = validateCommunityBoardCatalog(placeholderOdd);
assert(ph.ok, 'PLACEHOLDER may warn instead of fail');
assert(
  ph.warnings.some(w => w.path.includes('offset')),
  'PLACEHOLDER offset warning',
);

const applyOk = validateCatalogForApply(BUNDLED_COMMUNITY_CATALOG);
assert(applyOk.ok, 'apply validation accepts bundled');
const applyBad = acceptCommunityCatalog(badOffset);
assert(!applyBad.accepted, 'reject bad remote catalog');
assert(
  applyBad.catalog === BUNDLED_COMMUNITY_CATALOG,
  'fall back to bundled on bad offsets',
);
const applyGood = acceptCommunityCatalog(disk);
assert(applyGood.accepted, 'accept valid disk catalog');

const driftedBundled = {
  ...BUNDLED_COMMUNITY_CATALOG,
  profiles: BUNDLED_COMMUNITY_CATALOG.profiles.map((p, i) =>
    i === 0 ? { ...p, offset: '0x1000' } : p,
  ),
};
const drift = compareCatalogProfileParity(disk, driftedBundled);
assert(!drift.ok, 'parity must catch offset drift');

console.log('boardCatalogValidate.test.ts: OK');
