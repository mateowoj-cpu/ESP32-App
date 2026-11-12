/**
 * Thin wrapper around @tauri-apps/plugin-updater.
 * Only loaded inside the Tauri shell.
 */

export type UpdateCheckResult =
  | { status: 'unavailable' }
  | { status: 'up-to-date' }
  | { status: 'available'; version: string; body?: string; date?: string }
  | { status: 'error'; message: string };

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update) {
      return { status: 'up-to-date' };
    }
    return {
      status: 'available',
      version: update.version,
      body: update.body,
      date: update.date,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not available|plugin not|webview/i.test(message)) {
      return { status: 'unavailable' };
    }
    return { status: 'error', message };
  }
}

export async function downloadAndInstallUpdate(): Promise<{ status: 'ok' } | { status: 'error'; message: string }> {
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const { relaunch } = await import('@tauri-apps/plugin-process');
    const update = await check();
    if (!update) {
      return { status: 'error', message: 'Brak dostępnej aktualizacji.' };
    }
    await update.downloadAndInstall();
    await relaunch();
    return { status: 'ok' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'error', message };
  }
}
