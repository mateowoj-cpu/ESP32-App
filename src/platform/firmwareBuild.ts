import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface ToolchainInfo {
  platformio?: string | null;
  arduinoCli?: string | null;
  preferred?: string | null;
  available: boolean;
  /** `sidecar` | `path` | `none` */
  source?: string | null;
  hint: string;
}

export interface BuildResult {
  ok: boolean;
  tool: string;
  projectDir?: string | null;
  firmwarePath?: string | null;
  exitCode?: number | null;
  message: string;
}

export async function getFirmwareToolchainInfo(): Promise<ToolchainInfo> {
  return invoke<ToolchainInfo>('get_firmware_toolchain_info');
}

export async function buildFirmwareFromSketch(opts: {
  sketchSource: string;
  platformioIni: string;
  boardProfile: string;
  sketchName?: string;
  preferredTool?: 'auto' | 'platformio' | 'arduino-cli';
}): Promise<BuildResult> {
  return invoke<BuildResult>('build_firmware_from_sketch', {
    sketchSource: opts.sketchSource,
    platformioIni: opts.platformioIni,
    boardProfile: opts.boardProfile,
    sketchName: opts.sketchName ?? 'esp32_display_studio',
    preferredTool: opts.preferredTool ?? 'auto',
  });
}

export async function listenBuildLog(onLine: (line: string) => void): Promise<UnlistenFn> {
  return listen<string>('build-log', event => {
    onLine(event.payload);
  });
}
