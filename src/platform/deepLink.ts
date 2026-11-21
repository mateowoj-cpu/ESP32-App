import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { readOpenFile, type OpenFilePayload } from './flash';

/** Extensions we may open via deep link / file association / argv. */
export const ALLOWED_OPEN_EXTENSIONS = [
  'esp32studio',
  'json',
  'ino',
  'bin',
  'elf',
] as const;

const TEXT_CONTENT_EXTENSIONS = new Set(['esp32studio', 'json', 'ino']);

function extensionOf(path: string): string {
  const base = path.split(/[/\\]/).pop() || path;
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

/** True when the filesystem path has an allowed open extension. */
export function isAllowedOpenPath(path: string): boolean {
  const ext = extensionOf(path);
  return (ALLOWED_OPEN_EXTENSIONS as readonly string[]).includes(ext);
}

/** True when we should read file text (projects / sketches), not firmware blobs. */
export function shouldReadOpenContent(path: string): boolean {
  return TEXT_CONTENT_EXTENSIONS.has(extensionOf(path));
}

/**
 * Decode a URI component at most once. `URLSearchParams.get` / `URL.pathname`
 * already return decoded strings — calling `decodeURIComponent` again breaks
 * legitimate `%` in filenames (e.g. `100%.esp32studio`) and can change spaces.
 */
export function decodeUriComponentOnce(value: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(value)) {
    return value;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function pathFromFileUrl(value: string): string | null {
  try {
    const url = new URL(value);
    // file:// pathnames stay percent-encoded in JS URL parsers — decode once.
    let pathname = decodeUriComponentOnce(url.pathname || '');
    // Windows: file:///C:/Users/...
    if (pathname.startsWith('/') && /^\/[A-Za-z]:/.test(pathname)) {
      pathname = pathname.slice(1);
    }
    return pathname || null;
  } catch {
    return null;
  }
}

/** Parse esp32studio:// / file:// URLs into filesystem paths when possible. */
export function resolveOpenTarget(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith('file:')) {
    return pathFromFileUrl(value);
  }

  if (value.startsWith('esp32studio://') || value.startsWith('esp32studio:')) {
    try {
      const normalized = value.replace(/^esp32studio:/i, 'https:');
      const url = new URL(normalized);
      // URLSearchParams.get already percent-decodes — do not decode again.
      const pathParam = url.searchParams.get('path') || url.searchParams.get('file');
      if (pathParam) return pathParam;

      // esp32studio://open/C:/path/file.esp32studio  or //import/...
      // url.pathname is already decoded by the URL parser.
      const host = url.hostname;
      let pathname = url.pathname || '';
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
    // Gate on allowed extensions before any content read / IPC.
    if (!isAllowedOpenPath(target)) continue;
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

/** Drain cold-start paths buffered in Rust and mark the UI ready for live emits. */
export async function takePendingOpenPaths(): Promise<string[]> {
  const paths = await invoke<string[]>('take_pending_open_paths');
  return Array.isArray(paths) ? paths : [];
}

/**
 * After an async listen resolves, either keep the subscription or tear it down
 * immediately when the React effect already unmounted (late registration).
 */
export function settleOpenPathsSubscription(
  unlisten: UnlistenFn,
  cancelled: boolean,
): UnlistenFn {
  if (cancelled) {
    unlisten();
    return () => undefined;
  }
  return unlisten;
}

/**
 * Register the live listener first, then drain the startup buffer.
 * Safe if the caller unmounts while `listen` / `invoke` is still in flight:
 * set `cancelled` and call the returned stop — late registration is cleaned up.
 */
export async function bindAppOpenPaths(
  onPaths: (paths: string[]) => void,
  options?: { isCancelled?: () => boolean },
): Promise<UnlistenFn> {
  let active = true;
  const deliver = (paths: string[]) => {
    if (!active) return;
    if (options?.isCancelled?.()) return;
    if (Array.isArray(paths) && paths.length) {
      onPaths(paths);
    }
  };

  const unlisten = await listenAppOpenPaths(deliver);
  if (options?.isCancelled?.()) {
    active = false;
    return settleOpenPathsSubscription(unlisten, true);
  }

  try {
    const pending = await takePendingOpenPaths();
    deliver(pending);
  } catch {
    // browser / command unavailable
  }

  return settleOpenPathsSubscription(() => {
    active = false;
    unlisten();
  }, false);
}

/**
 * Pure helper used by tests for the App.tsx effect split:
 * updater failures must not block open-path binding.
 */
export async function runOpenPathsSession(opts: {
  checkUpdate: () => Promise<unknown>;
  bindOpenPaths: () => Promise<UnlistenFn>;
}): Promise<{ updateError: string | null; unlisten: UnlistenFn }> {
  // Intentionally parallel / independent: updater must not gate the listener.
  const bindPromise = opts.bindOpenPaths();
  let updateError: string | null = null;
  try {
    await opts.checkUpdate();
  } catch (err) {
    updateError = err instanceof Error ? err.message : String(err);
  }
  const unlisten = await bindPromise;
  return { updateError, unlisten };
}
