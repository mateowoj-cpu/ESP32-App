import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type OtaMethod = 'espota' | 'http';

export interface OtaToolInfo {
  available: boolean;
  command?: string[] | null;
  source: string;
  hint: string;
}

export interface OtaResult {
  ok: boolean;
  exitCode?: number | null;
  method: string;
  message: string;
  errorCode?: string | null;
}

export interface DiscoveredOtaHost {
  host: string;
  hostname: string;
  addresses: string[];
  port: number;
  service: string;
  fullname: string;
}

export async function getOtaToolInfo(): Promise<OtaToolInfo> {
  return invoke<OtaToolInfo>('get_ota_tool_info');
}

export async function flashOtaFirmware(opts: {
  host: string;
  port?: number;
  password?: string;
  firmwarePath: string;
  method?: OtaMethod;
  /** Soft wall-clock timeout for espota/curl (default 180s). */
  timeoutMs?: number;
}): Promise<OtaResult> {
  return invoke<OtaResult>('flash_ota_firmware', {
    host: opts.host,
    port: opts.port ?? 3232,
    password: opts.password ?? '',
    firmwarePath: opts.firmwarePath,
    method: opts.method ?? 'espota',
    timeoutMs: opts.timeoutMs ?? 180_000,
  });
}

/** Kill in-flight espota/curl OTA child if any. */
export async function cancelOtaFirmware(): Promise<boolean> {
  return invoke<boolean>('cancel_ota_firmware');
}

/** Browse LAN for `_arduino._tcp` / `_http._tcp` (desktop Tauri only). */
export async function discoverOtaHosts(timeoutMs = 2800): Promise<DiscoveredOtaHost[]> {
  return invoke<DiscoveredOtaHost[]>('discover_ota_hosts', { timeoutMs });
}

export async function listenOtaLog(onLine: (line: string) => void): Promise<UnlistenFn> {
  return listen<string>('ota-log', event => {
    onLine(event.payload);
  });
}

/** Map Rust errorCode / message → i18n key for UI status. */
export function mapOtaErrorMessage(
  t: (key: string) => string,
  result: Pick<OtaResult, 'message' | 'errorCode' | 'ok'>,
): string {
  if (result.ok) return result.message;
  switch (result.errorCode) {
    case 'auth':
      return t('ota.err.auth');
    case 'network':
      return t('ota.err.network');
    case 'tool':
      return t('ota.err.tool');
    case 'timeout':
      return t('ota.timedOut');
    case 'cancelled':
      return t('ota.cancelled');
    case 'generic':
      return t('ota.err.generic');
    default: {
      const lower = (result.message || '').toLowerCase();
      if (lower.includes('timeout')) return t('ota.timedOut');
      if (lower.includes('cancel') || lower.includes('anulow')) return t('ota.cancelled');
      if (lower.includes('password') || lower.includes('auth') || lower.includes('hasł')) {
        return t('ota.err.auth');
      }
      return result.message || t('ota.err.generic');
    }
  }
}
