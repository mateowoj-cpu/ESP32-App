/**
 * Channel-aware updater. Uses Rust commands so stable/beta endpoints work
 * (JS CheckOptions has no `endpoints` in plugin-updater 2.x).
 */

import { invoke } from '@tauri-apps/api/core';
import type { UpdateChannel } from '../i18n/locales';
import { loadUpdateChannel } from '../i18n/locales';

export type UpdateCheckResult =
  | { status: 'unavailable' }
  | { status: 'up-to-date' }
  | { status: 'available'; version: string; body?: string; date?: string }
  | { status: 'error'; message: string };

interface ChannelUpdateInfo {
  version: string;
  body?: string | null;
  date?: string | null;
  channel: string;
}

export async function checkForAppUpdate(
  channel: UpdateChannel = loadUpdateChannel(),
): Promise<UpdateCheckResult> {
  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    if (!isTauri()) {
      return { status: 'unavailable' };
    }
    const update = await invoke<ChannelUpdateInfo | null>('check_update_channel', {
      channel,
    });
    if (!update) {
      return { status: 'up-to-date' };
    }
    return {
      status: 'available',
      version: update.version,
      body: update.body ?? undefined,
      date: update.date ?? undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not available|plugin not|webview|Command/i.test(message)) {
      return { status: 'unavailable' };
    }
    return { status: 'error', message };
  }
}

export async function downloadAndInstallUpdate(
  channel: UpdateChannel = loadUpdateChannel(),
): Promise<{ status: 'ok' } | { status: 'error'; message: string }> {
  try {
    await invoke('download_and_install_channel', { channel });
    return { status: 'ok' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'error', message };
  }
}
