export interface BoardFlashPreset {
  chip: string;
  offset: string;
  baud: number;
  boardProfile: string;
  updatedAt: string;
}

const KEY = 'esp32_board_presets_v1';

function readAll(): Record<string, BoardFlashPreset> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, BoardFlashPreset>;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, BoardFlashPreset>): void {
  localStorage.setItem(KEY, JSON.stringify(map));
}

type IdLike = number | string | null | undefined;

function normalizeId(id: IdLike): string {
  if (id == null || id === '') return '----';
  if (typeof id === 'number') return id.toString(16).padStart(4, '0');
  const raw = String(id).replace(/^0x/i, '');
  const n = Number.parseInt(raw, 16);
  if (Number.isFinite(n)) return n.toString(16).padStart(4, '0');
  return raw.toLowerCase().padStart(4, '0').slice(-4);
}

export function boardCacheKey(vid?: IdLike, pid?: IdLike, port?: string | null): string {
  return `${normalizeId(vid)}:${normalizeId(pid)}:${port || '*'}`;
}

export function loadBoardPreset(
  vid?: IdLike,
  pid?: IdLike,
  port?: string | null,
): BoardFlashPreset | null {
  const all = readAll();
  const exact = boardCacheKey(vid, pid, port);
  if (all[exact]) return all[exact];
  const loose = boardCacheKey(vid, pid, '*');
  return all[loose] || null;
}

export function saveBoardPreset(
  vid: IdLike,
  pid: IdLike,
  port: string | null | undefined,
  preset: Omit<BoardFlashPreset, 'updatedAt'>,
): void {
  const all = readAll();
  const entry: BoardFlashPreset = { ...preset, updatedAt: new Date().toISOString() };
  all[boardCacheKey(vid, pid, port)] = entry;
  all[boardCacheKey(vid, pid, '*')] = entry;
  writeAll(all);
}
