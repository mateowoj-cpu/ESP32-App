/**
 * Faza 16 — community board catalog validation (PR / CI).
 *
 * Checks `public/board-profiles/community.json` shape plus conservative
 * flash-offset rules vs esptool chip family. No network; no secrets.
 */

export const ESPTOOL_CHIP_FAMILIES = [
  'esp32',
  'esp32s2',
  'esp32s3',
  'esp32c2',
  'esp32c3',
  'esp32c5',
  'esp32c6',
  'esp32h2',
  'esp32p4',
  'auto',
] as const;

export type EsptoolChipFamily = (typeof ESPTOOL_CHIP_FAMILIES)[number];

/** Classic Xtensa ESP32 (non-Sx / non-Cx) prefers bootloader-region or merged. */
const CLASSIC_ESP32_OFFSETS = new Set(['0x0', '0x1000']);

/**
 * Newer Espressif SoCs in this catalog ship merged images @ 0x0 by default.
 * 0x1000 is rejected unless the profile id is explicitly marked PLACEHOLDER.
 */
const MERGED_IMAGE_CHIPS = new Set<string>([
  'esp32s2',
  'esp32s3',
  'esp32c2',
  'esp32c3',
  'esp32c5',
  'esp32c6',
  'esp32h2',
  'esp32p4',
]);

const HEX4 = /^[0-9a-f]{4}$/i;
const OFFSET_HEX = /^0x[0-9a-f]+$/i;

export interface BoardCatalogProfileInput {
  id?: unknown;
  label?: unknown;
  vid?: unknown;
  pid?: unknown;
  chip?: unknown;
  offset?: unknown;
  baud?: unknown;
  boardProfile?: unknown;
}

export interface BoardCatalogInput {
  version?: unknown;
  updatedAt?: unknown;
  source?: unknown;
  sourcesNote?: unknown;
  sources?: unknown;
  profiles?: unknown;
}

export interface BoardCatalogIssue {
  level: 'error' | 'warning';
  path: string;
  message: string;
}

export interface BoardCatalogValidationResult {
  ok: boolean;
  errors: BoardCatalogIssue[];
  warnings: BoardCatalogIssue[];
  profileCount: number;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function normalizeOffset(offset: string): string {
  const trimmed = offset.trim().toLowerCase();
  if (!OFFSET_HEX.test(trimmed)) return trimmed;
  // Canonicalize 0x0000 → 0x0, 0x001000 → 0x1000
  const n = Number.parseInt(trimmed, 16);
  if (!Number.isFinite(n) || n < 0) return trimmed;
  return `0x${n.toString(16)}`;
}

export function isKnownEsptoolChip(chip: string): chip is EsptoolChipFamily {
  return (ESPTOOL_CHIP_FAMILIES as readonly string[]).includes(chip);
}

/**
 * Recommended flash offsets for catalog rows (conservative Studio defaults).
 * Returns null when the chip is unknown (caller should already flag that).
 */
export function recommendedOffsetsForChip(chip: string): Set<string> | null {
  if (!isKnownEsptoolChip(chip) || chip === 'auto') {
    return CLASSIC_ESP32_OFFSETS;
  }
  if (chip === 'esp32') return CLASSIC_ESP32_OFFSETS;
  if (MERGED_IMAGE_CHIPS.has(chip)) return new Set(['0x0']);
  return CLASSIC_ESP32_OFFSETS;
}

function validateProfile(
  profile: BoardCatalogProfileInput,
  index: number,
  seenIds: Set<string>,
): BoardCatalogIssue[] {
  const issues: BoardCatalogIssue[] = [];
  const base = `profiles[${index}]`;

  if (!isPlainObject(profile)) {
    issues.push({ level: 'error', path: base, message: 'Profile must be an object' });
    return issues;
  }

  const id = profile.id;
  if (typeof id !== 'string' || !id.trim()) {
    issues.push({ level: 'error', path: `${base}.id`, message: 'id must be a non-empty string' });
  } else if (seenIds.has(id)) {
    issues.push({ level: 'error', path: `${base}.id`, message: `Duplicate id "${id}"` });
  } else {
    seenIds.add(id);
  }

  if (typeof profile.label !== 'string' || !profile.label.trim()) {
    issues.push({
      level: 'error',
      path: `${base}.label`,
      message: 'label must be a non-empty string',
    });
  }

  if (typeof profile.vid !== 'string' || !HEX4.test(profile.vid)) {
    issues.push({
      level: 'error',
      path: `${base}.vid`,
      message: 'vid must be 4 hex digits (e.g. "10c4")',
    });
  }

  if (typeof profile.pid !== 'string' || !HEX4.test(profile.pid)) {
    issues.push({
      level: 'error',
      path: `${base}.pid`,
      message: 'pid must be 4 hex digits (e.g. "ea60")',
    });
  }

  const chip = typeof profile.chip === 'string' ? profile.chip.trim().toLowerCase() : '';
  if (!chip) {
    issues.push({ level: 'error', path: `${base}.chip`, message: 'chip is required' });
  } else if (!isKnownEsptoolChip(chip)) {
    issues.push({
      level: 'error',
      path: `${base}.chip`,
      message: `Unknown esptool chip "${chip}" (allowed: ${ESPTOOL_CHIP_FAMILIES.join(', ')})`,
    });
  }

  const boardProfile =
    typeof profile.boardProfile === 'string' ? profile.boardProfile.trim().toLowerCase() : '';
  if (!boardProfile) {
    issues.push({
      level: 'error',
      path: `${base}.boardProfile`,
      message: 'boardProfile is required',
    });
  } else if (chip && boardProfile !== chip && boardProfile !== 'auto') {
    // Studio maps boardProfile → PIO env; keep aligned with esptool chip id.
    issues.push({
      level: 'error',
      path: `${base}.boardProfile`,
      message: `boardProfile "${boardProfile}" must match chip "${chip}" (or "auto")`,
    });
  }

  if (typeof profile.offset !== 'string' || !OFFSET_HEX.test(profile.offset.trim())) {
    issues.push({
      level: 'error',
      path: `${base}.offset`,
      message: 'offset must be hex string like "0x0" or "0x1000"',
    });
  } else if (chip && isKnownEsptoolChip(chip)) {
    const normalized = normalizeOffset(profile.offset);
    const recommended = recommendedOffsetsForChip(chip);
    const isPlaceholder =
      typeof id === 'string' && id.toLowerCase().includes('placeholder');
    if (recommended && !recommended.has(normalized)) {
      if (isPlaceholder) {
        issues.push({
          level: 'warning',
          path: `${base}.offset`,
          message: `PLACEHOLDER offset ${normalized} outside recommended set for ${chip}: ${[...recommended].join(', ')}`,
        });
      } else {
        issues.push({
          level: 'error',
          path: `${base}.offset`,
          message: `offset ${normalized} not recommended for chip ${chip} (expected ${[...recommended].join(' | ')})`,
        });
      }
    }
  }

  if (typeof profile.baud !== 'number' || !Number.isFinite(profile.baud) || profile.baud < 9600) {
    issues.push({
      level: 'error',
      path: `${base}.baud`,
      message: 'baud must be a number ≥ 9600',
    });
  } else if (profile.baud > 3000000) {
    issues.push({
      level: 'warning',
      path: `${base}.baud`,
      message: `baud ${profile.baud} is unusually high`,
    });
  }

  return issues;
}

/**
 * Validate a community board catalog document.
 */
export function validateCommunityBoardCatalog(
  value: unknown,
): BoardCatalogValidationResult {
  const errors: BoardCatalogIssue[] = [];
  const warnings: BoardCatalogIssue[] = [];

  if (!isPlainObject(value)) {
    return {
      ok: false,
      errors: [{ level: 'error', path: '', message: 'Catalog root must be an object' }],
      warnings: [],
      profileCount: 0,
    };
  }

  const catalog = value as BoardCatalogInput;

  if (typeof catalog.version !== 'number' || !Number.isFinite(catalog.version)) {
    errors.push({ level: 'error', path: 'version', message: 'version must be a number' });
  }

  if (typeof catalog.updatedAt !== 'string' || !catalog.updatedAt.trim()) {
    warnings.push({
      level: 'warning',
      path: 'updatedAt',
      message: 'updatedAt should be an ISO-8601 string',
    });
  }

  if (!Array.isArray(catalog.profiles)) {
    errors.push({ level: 'error', path: 'profiles', message: 'profiles must be an array' });
    return { ok: false, errors, warnings, profileCount: 0 };
  }

  if (catalog.profiles.length === 0) {
    errors.push({ level: 'error', path: 'profiles', message: 'profiles must not be empty' });
  }

  const seenIds = new Set<string>();
  for (let i = 0; i < catalog.profiles.length; i += 1) {
    const profileIssues = validateProfile(
      catalog.profiles[i] as BoardCatalogProfileInput,
      i,
      seenIds,
    );
    for (const issue of profileIssues) {
      if (issue.level === 'error') errors.push(issue);
      else warnings.push(issue);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    profileCount: catalog.profiles.length,
  };
}
