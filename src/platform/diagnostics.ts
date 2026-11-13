import { invoke } from '@tauri-apps/api/core';
import { loadDiagnosticsEnabled } from '../i18n/locales';

export async function appendDiagnosticsLog(line: string, category = 'general'): Promise<void> {
  if (!loadDiagnosticsEnabled()) return;
  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    if (!isTauri()) return;
    await invoke('append_diagnostics_log', { category, line });
  } catch {
    // ignore — browser or missing command
  }
}

export async function getDiagnosticsLogPath(): Promise<string | null> {
  try {
    return await invoke<string>('get_diagnostics_log_path');
  } catch {
    return null;
  }
}

export async function openDiagnosticsFolder(): Promise<void> {
  await invoke('open_diagnostics_folder');
}

export async function setDiagnosticsEnabledNative(enabled: boolean): Promise<void> {
  try {
    await invoke('set_diagnostics_enabled', { enabled });
  } catch {
    // ignore
  }
}
