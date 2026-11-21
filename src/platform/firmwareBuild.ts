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

/** One esptool write_flash segment. */
export interface FlashSegment {
  offset: string;
  path: string;
  /** `bootloader` | `partition-table` | `boot-app0` | `app` | `other` */
  role: string;
}

/**
 * Verified write plan from toolchain metadata, or a manual single-file plan.
 * `imageKind`: `otaApp` | `usbFullSet` | `manual`
 */
export interface FlashPlan {
  buildId: string;
  imageKind: 'otaApp' | 'usbFullSet' | 'manual' | string;
  chipFamily: string;
  segments: FlashSegment[];
  otaPath?: string | null;
  metadataTrusted: boolean;
  artifactDir: string;
}

export interface BuildResult {
  ok: boolean;
  tool: string;
  projectDir?: string | null;
  /** OTA / app path when available (never bootloader-only). */
  firmwarePath?: string | null;
  exitCode?: number | null;
  message: string;
  buildId?: string | null;
  imageKind?: string | null;
  chipFamily?: string | null;
  flashPlan?: FlashPlan | null;
  /** True only when USB Build & Flash may use `flashPlan`. */
  autoFlashAllowed: boolean;
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
