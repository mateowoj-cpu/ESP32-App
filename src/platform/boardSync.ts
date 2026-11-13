import {
  boardCacheKey,
  saveBoardPreset,
  type BoardFlashPreset,
} from './boardCache';

export interface CommunityBoardProfile {
  id: string;
  label: string;
  vid: string;
  pid: string;
  chip: string;
  offset: string;
  baud: number;
  boardProfile: string;
}

export interface CommunityBoardCatalog {
  version: number;
  updatedAt: string;
  source?: string;
  profiles: CommunityBoardProfile[];
}

/** Bundled fallback when network is unavailable (mirrors public/board-profiles/community.json). */
export const BUNDLED_COMMUNITY_CATALOG: CommunityBoardCatalog = {
  version: 1,
  updatedAt: '2026-11-13T00:00:00.000Z',
  source: 'esp32-display-studio/community-bundled',
  profiles: [
    {
      id: 'espressif-s3-devkitc',
      label: 'ESP32-S3-DevKitC-1',
      vid: '303a',
      pid: '1001',
      chip: 'esp32s3',
      offset: '0x0',
      baud: 921600,
      boardProfile: 'esp32s3',
    },
    {
      id: 'espressif-c3-devkitm',
      label: 'ESP32-C3-DevKitM-1',
      vid: '303a',
      pid: '1001',
      chip: 'esp32c3',
      offset: '0x0',
      baud: 460800,
      boardProfile: 'esp32c3',
    },
    {
      id: 'cp210x-generic-esp32',
      label: 'Generic ESP32 (CP210x)',
      vid: '10c4',
      pid: 'ea60',
      chip: 'esp32',
      offset: '0x1000',
      baud: 921600,
      boardProfile: 'esp32',
    },
    {
      id: 'ch340-generic-esp32',
      label: 'Generic ESP32 (CH340)',
      vid: '1a86',
      pid: '7523',
      chip: 'esp32',
      offset: '0x1000',
      baud: 921600,
      boardProfile: 'esp32',
    },
    {
      id: 'ftdi-generic-esp32',
      label: 'Generic ESP32 (FTDI)',
      vid: '0403',
      pid: '6001',
      chip: 'esp32',
      offset: '0x1000',
      baud: 921600,
      boardProfile: 'esp32',
    },
  ],
};

const DEFAULT_REMOTE_URL =
  'https://raw.githubusercontent.com/mateowoj-cpu/ESP32-App/main/public/board-profiles/community.json';

const LAST_SYNC_KEY = 'esp32_board_sync_meta_v1';

export interface BoardSyncMeta {
  syncedAt: string;
  source: string;
  count: number;
  remote: boolean;
}

export function loadBoardSyncMeta(): BoardSyncMeta | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BoardSyncMeta;
  } catch {
    return null;
  }
}

function saveBoardSyncMeta(meta: BoardSyncMeta): void {
  localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(meta));
}

export function isCommunityCatalog(value: unknown): value is CommunityBoardCatalog {
  if (!value || typeof value !== 'object') return false;
  const c = value as CommunityBoardCatalog;
  return (
    typeof c.version === 'number' &&
    Array.isArray(c.profiles) &&
    c.profiles.every(
      p =>
        p &&
        typeof p.vid === 'string' &&
        typeof p.pid === 'string' &&
        typeof p.chip === 'string' &&
        typeof p.offset === 'string' &&
        typeof p.baud === 'number' &&
        typeof p.boardProfile === 'string',
    )
  );
}

export async function fetchCommunityCatalog(
  url: string = DEFAULT_REMOTE_URL,
  timeoutMs = 8000,
): Promise<{ catalog: CommunityBoardCatalog; remote: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: unknown = await res.json();
    if (!isCommunityCatalog(json)) throw new Error('Invalid community catalog shape');
    return { catalog: json, remote: true };
  } catch {
    return { catalog: BUNDLED_COMMUNITY_CATALOG, remote: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Apply catalog profiles into local VID:PID cache (loose `*` port key). */
export function applyCommunityCatalog(catalog: CommunityBoardCatalog): number {
  let applied = 0;
  for (const p of catalog.profiles) {
    const preset: Omit<BoardFlashPreset, 'updatedAt'> = {
      chip: p.chip,
      offset: p.offset,
      baud: p.baud,
      boardProfile: p.boardProfile,
    };
    saveBoardPreset(p.vid, p.pid, '*', preset);
    applied += 1;
  }
  return applied;
}

export async function syncCommunityBoardProfiles(opts?: {
  url?: string;
  forceBundled?: boolean;
}): Promise<BoardSyncMeta> {
  const { catalog, remote } = opts?.forceBundled
    ? { catalog: BUNDLED_COMMUNITY_CATALOG, remote: false }
    : await fetchCommunityCatalog(opts?.url);
  const count = applyCommunityCatalog(catalog);
  const meta: BoardSyncMeta = {
    syncedAt: new Date().toISOString(),
    source: catalog.source || (remote ? 'remote' : 'bundled'),
    count,
    remote,
  };
  saveBoardSyncMeta(meta);
  return meta;
}

export function communityCacheKey(vid: string, pid: string): string {
  return boardCacheKey(vid, pid, '*');
}
