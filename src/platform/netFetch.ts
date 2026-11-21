/**
 * Fetch text for weather / integration URLs.
 *
 * Desktop CSP keeps `connect-src` HTTPS-tight in the WebView. Custom weather
 * endpoints like `http://homeassistant.local:8123/...` go through a constrained
 * native GET (`fetch_url_text`) instead of WebView `fetch`.
 */

import { invoke, isTauri } from '@tauri-apps/api/core';

/** True when the URL should use the native bridge (plain HTTP on Tauri). */
export function shouldUseNativeHttpFetch(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * GET URL body as text. On Tauri, plain `http:` uses native curl with limits;
 * `https:` and the browser path use WebView/browser `fetch`.
 */
export async function fetchTextUrl(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('Empty URL');
  }

  if (isTauri() && shouldUseNativeHttpFetch(trimmed)) {
    return invoke<string>('fetch_url_text', { url: trimmed });
  }

  const res = await fetch(trimmed);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
}
