import { invoke } from '@tauri-apps/api/core';

export type PreferredBuildTool = 'auto' | 'platformio' | 'arduino-cli';

export interface ToolPathOverrides {
  platformio?: string | null;
  arduinoCli?: string | null;
  esptool?: string | null;
  arduinoIde?: string | null;
  idf?: string | null;
  wokwiCli?: string | null;
}

export interface ToolProbe {
  id: string;
  label: string;
  available: boolean;
  path?: string | null;
  version?: string | null;
  source: string;
  free: boolean;
  hint: string;
  homepage?: string | null;
}

export interface ExternalToolsStatus {
  tools: ToolProbe[];
}

export interface OpenResult {
  ok: boolean;
  message: string;
  path?: string | null;
}

const PREFERRED_TOOL_KEY = 'esp32_preferred_build_tool';

export function loadPreferredBuildTool(): PreferredBuildTool {
  try {
    const raw = localStorage.getItem(PREFERRED_TOOL_KEY);
    if (raw === 'platformio' || raw === 'arduino-cli' || raw === 'auto') return raw;
  } catch {
    // ignore
  }
  return 'auto';
}

export function savePreferredBuildTool(tool: PreferredBuildTool): void {
  try {
    localStorage.setItem(PREFERRED_TOOL_KEY, tool);
  } catch {
    // ignore
  }
}

export async function getExternalToolsStatus(): Promise<ExternalToolsStatus> {
  return invoke<ExternalToolsStatus>('get_external_tools_status');
}

export async function getToolPathOverrides(): Promise<ToolPathOverrides> {
  return invoke<ToolPathOverrides>('get_tool_path_overrides');
}

export async function setToolPathOverrides(
  overrides: ToolPathOverrides,
): Promise<ToolPathOverrides> {
  return invoke<ToolPathOverrides>('set_tool_path_overrides', {
    platformio: overrides.platformio ?? null,
    arduinoCli: overrides.arduinoCli ?? null,
    esptool: overrides.esptool ?? null,
    arduinoIde: overrides.arduinoIde ?? null,
    idf: overrides.idf ?? null,
    wokwiCli: overrides.wokwiCli ?? null,
  });
}

export async function openPathInOs(path: string): Promise<OpenResult> {
  return invoke<OpenResult>('open_path_in_os', { path });
}

export async function openExternalUrl(url: string): Promise<OpenResult> {
  return invoke<OpenResult>('open_external_url', { url });
}

export async function exportAndOpenArduinoIde(opts: {
  sketchSource: string;
  sketchName?: string;
}): Promise<OpenResult> {
  return invoke<OpenResult>('export_and_open_arduino_ide', {
    sketchSource: opts.sketchSource,
    sketchName: opts.sketchName ?? 'esp32_display_studio',
  });
}

export async function openWokwiSimulator(): Promise<OpenResult> {
  return invoke<OpenResult>('open_wokwi_simulator');
}
