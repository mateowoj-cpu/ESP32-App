import { invoke } from '@tauri-apps/api/core';

export interface DesktopStatus {
  appAutostart: boolean;
  agentAutostart: boolean;
  closeToTray: boolean;
  trayAvailable: boolean;
  hint: string;
}

export async function getDesktopStatus(): Promise<DesktopStatus> {
  return invoke<DesktopStatus>('get_desktop_status');
}

export async function setAppAutostart(enabled: boolean): Promise<boolean> {
  return invoke<boolean>('set_app_autostart', { enabled });
}

export async function setPcAgentAutostart(
  enabled: boolean,
  host: string,
  port: number,
): Promise<boolean> {
  return invoke<boolean>('set_pc_agent_autostart', { enabled, host, port });
}

export async function setCloseToTrayPreference(enabled: boolean): Promise<void> {
  return invoke('set_close_to_tray', { enabled });
}

export async function showMainWindow(): Promise<void> {
  return invoke('show_main_window');
}
