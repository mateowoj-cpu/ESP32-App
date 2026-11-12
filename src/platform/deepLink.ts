import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { readOpenFile, type OpenFilePayload } from './flash';

/** Parse esp32studio:// URLs into filesystem paths when possible. */
export function resolveOpenTarget(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith('esp32studio://') || value.startsWith('esp32studio:')) {
    try {
      const normalized = value.replace(/^esp32studio:/i, 'https:');
      const url = new URL(normalized);
      const pathParam = url.searchParams.get('path') || url.searchParams.get('file');
      if (pathParam) return decodeURIComponent(pathParam);

      // esp32studio://open/C:/path/file.esp32studio  or //import/...
      const host = url.hostname;
      let pathname = decodeURIComponent(url.pathname || '');
      if (host && host !== 'open' && host !== 'import' && host !== 'flash') {
        // Windows-style: esp32studio://C:/Users/...
        pathname = `/${host}${pathname}`;
      }
      if (pathname.startsWith('/') && /^\/[A-Za-z]:/.test(pathname)) {
        pathname = pathname.slice(1);
      }
      if (pathname.startsWith('//')) {
        pathname = pathname.slice(1);
      }
      // strip /open/ or /import/ prefix
      pathname = pathname.replace(/^\/?(open|import|flash)\//i, '');
      return pathname || null;
    } catch {
      return null;
    }
  }

  return value;
}

export async function loadOpenTargets(rawPaths: string[]): Promise<OpenFilePayload[]> {
  const out: OpenFilePayload[] = [];
  for (const raw of rawPaths) {
    const target = resolveOpenTarget(raw);
    if (!target) continue;
    if (target.startsWith('esp32studio')) continue;
    try {
      out.push(await readOpenFile(target));
    } catch {
      // ignore unreadable paths
    }
  }
  return out;
}

export async function listenAppOpenPaths(
  onPaths: (paths: string[]) => void,
): Promise<UnlistenFn> {
  return listen<string[]>('app-open-paths', event => {
    const payload = event.payload;
    if (Array.isArray(payload) && payload.length) {
      onPaths(payload);
    }
  });
}
