/**
 * User-added marketplace options + GitHub addon URL helpers.
 * Data-only — never fetches or executes remote code from github.com.
 */

import type { CommunityBoardProfile } from './boardSync';
import type { MarketplaceCatalog, MarketplaceCatalogEntry, MarketplaceKind } from './marketplace';

const USER_OPTIONS_KEY = 'esp32_marketplace_user_options_v1';

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);

export function isAllowedGithubAddonUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'https:') return false;
    if (!GITHUB_HOSTS.has(url.hostname)) return false;
    // Expect /owner/repo (optional trailing slash / path)
    const parts = url.pathname.split('/').filter(Boolean);
    return parts.length >= 2 && /^[A-Za-z0-9_.-]+$/.test(parts[0]!) && /^[A-Za-z0-9_.-]+$/.test(parts[1]!);
  } catch {
    return false;
  }
}

export function normalizeGithubRepoUrl(urlString: string): string | null {
  if (!isAllowedGithubAddonUrl(urlString)) return null;
  const url = new URL(urlString);
  const [owner, repo] = url.pathname.split('/').filter(Boolean);
  if (!owner || !repo) return null;
  return `https://github.com/${owner}/${repo.replace(/\.git$/i, '')}`;
}

function isSafeTag(tag: unknown): tag is string {
  return typeof tag === 'string' && tag.length > 0 && tag.length <= 48;
}

function isBoardProfile(value: unknown): value is CommunityBoardProfile {
  if (!value || typeof value !== 'object') return false;
  const p = value as CommunityBoardProfile;
  return (
    typeof p.id === 'string' &&
    typeof p.label === 'string' &&
    typeof p.vid === 'string' &&
    typeof p.pid === 'string' &&
    typeof p.chip === 'string' &&
    typeof p.offset === 'string' &&
    typeof p.baud === 'number' &&
    Number.isFinite(p.baud) &&
    typeof p.boardProfile === 'string'
  );
}

export function isUserMarketplaceOption(value: unknown): value is MarketplaceCatalogEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as MarketplaceCatalogEntry;
  const kindOk =
    e.kind === 'widget_pack' ||
    e.kind === 'rule_pack' ||
    e.kind === 'board_pack' ||
    e.kind === 'github_addon';
  if (
    !kindOk ||
    typeof e.id !== 'string' ||
    typeof e.title !== 'string' ||
    typeof e.description !== 'string' ||
    typeof e.author !== 'string' ||
    !Array.isArray(e.tags) ||
    !e.tags.every(isSafeTag) ||
    typeof e.packId !== 'string'
  ) {
    return false;
  }
  if (e.kind === 'github_addon') {
    if (!e.repoUrl || !isAllowedGithubAddonUrl(e.repoUrl)) return false;
  }
  if (e.kind === 'board_pack' && e.profiles !== undefined) {
    if (!Array.isArray(e.profiles) || e.profiles.length === 0 || !e.profiles.every(isBoardProfile)) {
      return false;
    }
  }
  return true;
}

export function loadUserMarketplaceOptions(): MarketplaceCatalogEntry[] {
  try {
    const raw = localStorage.getItem(USER_OPTIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isUserMarketplaceOption).map(e => ({ ...e, userAdded: true }));
  } catch {
    return [];
  }
}

export function saveUserMarketplaceOptions(entries: MarketplaceCatalogEntry[]): void {
  const clean = entries.filter(isUserMarketplaceOption).map(e => ({
    ...e,
    userAdded: true,
  }));
  localStorage.setItem(USER_OPTIONS_KEY, JSON.stringify(clean));
}

export type AddUserOptionResult =
  | { ok: true; entry: MarketplaceCatalogEntry }
  | { ok: false; error: string };

export function addUserMarketplaceOption(
  partial: {
    kind: MarketplaceKind;
    title: string;
    titleEn?: string;
    description: string;
    descriptionEn?: string;
    author?: string;
    tags?: string[];
    repoUrl?: string;
    profiles?: CommunityBoardProfile[];
  },
): AddUserOptionResult {
  const title = partial.title.trim();
  const description = partial.description.trim();
  if (!title || title.length > 120) return { ok: false, error: 'Invalid title' };
  if (!description || description.length > 512) return { ok: false, error: 'Invalid description' };

  const stamp = Date.now().toString(36);
  const id = `user-${partial.kind}-${stamp}`;
  const tags = (partial.tags || []).map(t => t.trim()).filter(Boolean).slice(0, 12);

  if (partial.kind === 'github_addon') {
    const repoUrl = partial.repoUrl ? normalizeGithubRepoUrl(partial.repoUrl) : null;
    if (!repoUrl) return { ok: false, error: 'repoUrl must be https://github.com/owner/repo' };
    const entry: MarketplaceCatalogEntry = {
      id,
      kind: 'github_addon',
      title,
      titleEn: partial.titleEn?.trim() || title,
      description,
      descriptionEn: partial.descriptionEn?.trim() || description,
      author: (partial.author || 'local').trim().slice(0, 128) || 'local',
      tags: tags.length ? tags : ['github', 'addon'],
      packId: id,
      repoUrl,
      userAdded: true,
      requireSignature: false,
    };
    const next = [...loadUserMarketplaceOptions().filter(e => e.id !== id), entry];
    saveUserMarketplaceOptions(next);
    return { ok: true, entry };
  }

  if (partial.kind === 'board_pack') {
    const profiles = partial.profiles || [];
    if (!profiles.length || !profiles.every(isBoardProfile)) {
      return { ok: false, error: 'board_pack requires at least one valid profile' };
    }
    const entry: MarketplaceCatalogEntry = {
      id,
      kind: 'board_pack',
      title,
      titleEn: partial.titleEn?.trim() || title,
      description,
      descriptionEn: partial.descriptionEn?.trim() || description,
      author: (partial.author || 'local').trim().slice(0, 128) || 'local',
      tags: tags.length ? tags : ['board', 'usb'],
      packId: id,
      profiles,
      userAdded: true,
      requireSignature: false,
    };
    const next = [...loadUserMarketplaceOptions().filter(e => e.id !== id), entry];
    saveUserMarketplaceOptions(next);
    return { ok: true, entry };
  }

  return {
    ok: false,
    error: 'Use Import JSON for widget_pack / rule_pack; Add option supports github_addon and board_pack',
  };
}

export function removeUserMarketplaceOption(id: string): boolean {
  const prev = loadUserMarketplaceOptions();
  const next = prev.filter(e => e.id !== id);
  if (next.length === prev.length) return false;
  saveUserMarketplaceOptions(next);
  return true;
}

/** Merge remote/bundled catalog with local user options (user entries last, id-unique). */
export function mergeCatalogWithUserOptions(catalog: MarketplaceCatalog): MarketplaceCatalog {
  const user = loadUserMarketplaceOptions();
  if (user.length === 0) return catalog;
  const seen = new Set(catalog.entries.map(e => e.id));
  const extra = user.filter(e => !seen.has(e.id));
  return {
    ...catalog,
    entries: [...catalog.entries, ...extra],
  };
}
