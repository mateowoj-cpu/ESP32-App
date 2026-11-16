#!/usr/bin/env npx tsx
/**
 * Faza 16 — validate public/board-profiles/community.json for community PRs.
 *
 * Usage:
 *   npx tsx scripts/board-profiles/validate-community.ts
 *   npx tsx scripts/board-profiles/validate-community.ts path/to/catalog.json
 *
 * Exit 0 when valid (warnings allowed). Exit 1 on schema / offset errors.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCommunityBoardCatalog } from '../../src/platform/boardCatalogValidate';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const target = process.argv[2] || join(root, 'public/board-profiles/community.json');
const abs = resolve(target);

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
  process.exit(1);
}

console.log(
  `OK — ${abs} (${result.profileCount} profiles, ${result.warnings.length} warning(s))`,
);
