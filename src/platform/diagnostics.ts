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

/** Export local diagnostics ZIP (manifest + studio.log). Returns absolute path. */
export async function exportDiagnosticsZip(destPath?: string | null): Promise<string> {
  return invoke<string>('export_diagnostics_zip', {
    destPath: destPath?.trim() ? destPath : null,
  });
}

/** Prompt for save location (desktop), then export. Falls back to default diagnostics folder. */
export async function exportDiagnosticsZipWithDialog(): Promise<string> {
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const chosen = await save({
      defaultPath: `esp32-studio-diagnostics-${Date.now()}.zip`,
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
    });
    if (typeof chosen === 'string' && chosen.trim()) {
      return exportDiagnosticsZip(chosen);
    }
  } catch {
    // dialog unavailable — fall through
  }
  return exportDiagnosticsZip(null);
}
