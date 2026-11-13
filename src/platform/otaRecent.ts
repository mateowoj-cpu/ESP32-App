import type { DiscoveredOtaHost } from './ota';

const KEY = 'esp32_ota_recent_hosts';
const MAX = 8;

export interface RecentOtaHost {
  host: string;
  port: number;
  hostname?: string;
  method?: 'espota' | 'http';
  savedAt: number;
}

export function loadRecentOtaHosts(): RecentOtaHost[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentOtaHost[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(h => h && typeof h.host === 'string' && typeof h.port === 'number')
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function rememberOtaHost(entry: Omit<RecentOtaHost, 'savedAt'>): RecentOtaHost[] {
  const next: RecentOtaHost = { ...entry, savedAt: Date.now() };
  const prev = loadRecentOtaHosts().filter(
    h => !(h.host === next.host && h.port === next.port),
  );
  const list = [next, ...prev].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // ignore quota
  }
  return list;
}

/** Prefer project mDNS name matches, then IPv4-looking hosts. */
export function rankOtaHosts(
  hosts: DiscoveredOtaHost[],
  preferredMdnsName?: string,
): DiscoveredOtaHost[] {
  const needle = (preferredMdnsName || '').trim().toLowerCase().replace(/\.local$/i, '');
  return [...hosts].sort((a, b) => {
    const score = (h: DiscoveredOtaHost) => {
      let s = 0;
      if (needle) {
        const hostLower = `${h.hostname} ${h.fullname} ${h.host}`.toLowerCase();
        if (hostLower.includes(needle)) s += 100;
      }
      if (h.addresses.some(addr => /^\d+\.\d+\.\d+\.\d+$/.test(addr))) s += 10;
      if (/^\d+\.\d+\.\d+\.\d+$/.test(h.host)) s += 5;
      return s;
    };
    return score(b) - score(a);
  });
}

export function matchesPreferredMdns(host: DiscoveredOtaHost, preferredMdnsName?: string): boolean {
  const needle = (preferredMdnsName || '').trim().toLowerCase().replace(/\.local$/i, '');
  if (!needle) return false;
  return `${host.hostname} ${host.fullname} ${host.host}`.toLowerCase().includes(needle);
}
