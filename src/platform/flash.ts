import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface EsptoolInfo {
  available: boolean;
  command?: string[] | null;
  version?: string | null;
  hint: string;
}

export interface FlashResult {
  ok: boolean;
  exitCode?: number | null;
  message: string;
}

export interface OpenFilePayload {
  path: string;
  kind: string;
  fileName: string;
  content?: string | null;
}

export async function getEsptoolInfo(): Promise<EsptoolInfo> {
  return invoke<EsptoolInfo>('get_esptool_info');
}

export async function flashWriteFirmware(opts: {
  port: string;
  baud: number;
  chip: string;
  firmwarePath: string;
  flashOffset?: string;
}): Promise<FlashResult> {
  return invoke<FlashResult>('flash_write_firmware', {
    port: opts.port,
    baud: opts.baud,
    chip: opts.chip,
    firmwarePath: opts.firmwarePath,
    flashOffset: opts.flashOffset ?? '0x1000',
  });
}

export async function readOpenFile(path: string): Promise<OpenFilePayload> {
  return invoke<OpenFilePayload>('read_open_file', { path });
}

export async function listenFlashLog(onLine: (line: string) => void): Promise<UnlistenFn> {
  return listen<string>('flash-log', event => {
    onLine(event.payload);
  });
}

export async function pickFirmwareFile(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    multiple: false,
    filters: [
      { name: 'Firmware', extensions: ['bin', 'elf'] },
      { name: 'All', extensions: ['*'] },
    ],
  });
  if (typeof selected === 'string') return selected;
  return null;
}
