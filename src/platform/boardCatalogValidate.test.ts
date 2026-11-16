import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const {
  validateCommunityBoardCatalog,
  normalizeOffset,
  recommendedOffsetsForChip,
  isKnownEsptoolChip,
} = await import('./boardCatalogValidate');
const { BUNDLED_COMMUNITY_CATALOG } = await import('./boardSync');

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

const bundled = validateCommunityBoardCatalog(BUNDLED_COMMUNITY_CATALOG);
assert(bundled.ok, `bundled catalog invalid: ${JSON.stringify(bundled.errors)}`);
assert(bundled.profileCount >= 10, 'bundled profile count');

const here = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(here, '../../public/board-profiles/community.json');
const disk = JSON.parse(readFileSync(jsonPath, 'utf8')) as unknown;
const diskResult = validateCommunityBoardCatalog(disk);
assert(diskResult.ok, `community.json invalid: ${JSON.stringify(diskResult.errors)}`);

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

console.log('boardCatalogValidate.test.ts: OK');
