/**
 * Opt-in diagnostic telemetry (Faza 13).
 *
 * Privacy rules:
 * - Default OFF (`localStorage` key unset / not `1`)
 * - Never send serial logs, paths, MAC, chip serial, project contents, or PII
 * - Payload is anonymous: app version, coarse OS, event name, optional ok flag
 * - No network call unless enabled AND `VITE_TELEMETRY_ENDPOINT` is set
 */

import { loadTelemetryEnabled } from '../i18n/locales';

export type TelemetryEventName =
  | 'app_open'
  | 'build_result'
  | 'flash_result'
  | 'ota_result'
  | 'diag_export'
  | 'board_sync';

export interface TelemetryEvent {
  name: TelemetryEventName;
  ok?: boolean;
}

export interface TelemetryPayload {
  v: string;
  os: string;
  event: TelemetryEventName;
  ok?: boolean;
  ts: number;
}

const APP_VERSION = '0.2.7';

function coarseOs(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac OS|Macintosh/i.test(ua)) return 'macos';
  if (/Linux/i.test(ua)) return 'linux';
  return 'other';
}

function endpoint(): string | null {
  try {
    const raw = (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_TELEMETRY_ENDPOINT;
    if (typeof raw === 'string' && raw.trim().startsWith('https://')) {
      return raw.trim();
    }
  } catch {
    // ignore
  }
  return null;
}

export function isTelemetryActive(): boolean {
  return loadTelemetryEnabled() && !!endpoint();
}

/** Build the outbound payload (also used by unit tests). */
export function buildTelemetryPayload(event: TelemetryEvent): TelemetryPayload {
  const payload: TelemetryPayload = {
    v: APP_VERSION,
    os: coarseOs(),
    event: event.name,
    ts: Date.now(),
  };
  if (typeof event.ok === 'boolean') {
    payload.ok = event.ok;
  }
  return payload;
}

/**
 * Fire-and-forget telemetry. No-op when preference is off or endpoint unset.
 * Failures are swallowed — telemetry must never break the UI.
 */
export async function trackTelemetry(event: TelemetryEvent): Promise<void> {
  if (!loadTelemetryEnabled()) return;
  const url = endpoint();
  if (!url) return;

  const body = JSON.stringify(buildTelemetryPayload(event));
  try {
    if (typeof fetch !== 'function') return;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      mode: 'cors',
      credentials: 'omit',
    });
  } catch {
    // swallow
  }
}
