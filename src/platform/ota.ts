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
}): Promise<OtaResult> {
  return invoke<OtaResult>('flash_ota_firmware', {
    host: opts.host,
    port: opts.port ?? 3232,
    password: opts.password ?? '',
    firmwarePath: opts.firmwarePath,
    method: opts.method ?? 'espota',
  });
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
