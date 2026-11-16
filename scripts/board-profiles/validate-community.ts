#!/usr/bin/env npx tsx
/**
 * Validate public/board-profiles/community.json for community PRs, plus
 * bundled ↔ disk profile parity (BUNDLED_COMMUNITY_CATALOG in boardSync.ts).
 *
 * Usage:
 *   npx tsx scripts/board-profiles/validate-community.ts
 *   npx tsx scripts/board-profiles/validate-community.ts path/to/catalog.json
 *
 * Exit 0 when valid (warnings allowed). Exit 1 on schema / offset / parity errors.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compareCatalogProfileParity,
  validateCommunityBoardCatalog,
} from '../../src/platform/boardCatalogValidate';
import { BUNDLED_COMMUNITY_CATALOG } from '../../src/platform/boardSync';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const target = process.argv[2] || join(root, 'public/board-profiles/community.json');
const abs = resolve(target);
const checkParity = !process.argv[2];

let raw: string;
try {
  raw = readFileSync(abs, 'utf8');
} catch (err) {
  console.error(`Cannot read ${abs}:`, err instanceof Error ? err.message : err);
  process.exit(1);
}

let json: unknown;
try {
  json = JSON.parse(raw) as unknown;
} catch (err) {
  console.error(`Invalid JSON in ${abs}:`, err instanceof Error ? err.message : err);
  process.exit(1);
}

const result = validateCommunityBoardCatalog(json);

for (const w of result.warnings) {
  console.warn(`WARN  ${w.path || '(root)'}: ${w.message}`);
}
for (const e of result.errors) {
  console.error(`ERROR ${e.path || '(root)'}: ${e.message}`);
}

if (!result.ok) {
  console.error(
    `\nBoard catalog validation FAILED (${result.errors.length} error(s), ${result.profileCount} profile(s)).`,
  );
  console.error('See docs/board-catalog.md — offset must match esptool chip family.');
  process.exit(1);
}

if (checkParity) {
  const parity = compareCatalogProfileParity(json, BUNDLED_COMMUNITY_CATALOG);
  for (const e of parity.errors) {
    console.error(`PARITY ${e.path || '(root)'}: ${e.message}`);
  }
  if (!parity.ok) {
    console.error(
      `\nBundled ↔ disk parity FAILED (${parity.errors.length} error(s)).`,
    );
    console.error(
      'Mirror profiles into src/platform/boardSync.ts (BUNDLED_COMMUNITY_CATALOG).',
    );
    process.exit(1);
  }
  console.log(
    `OK — ${abs} (${result.profileCount} profiles, ${result.warnings.length} warning(s), bundled parity OK)`,
  );
} else {
  console.log(
    `OK — ${abs} (${result.profileCount} profiles, ${result.warnings.length} warning(s); skipped bundled parity for custom path)`,
  );
}
