/**
 * Channel-aware updater. Uses Rust commands so stable/beta endpoints work
 * (JS CheckOptions has no `endpoints` in plugin-updater 2.x).
 *
 * Beta stays gated until a dedicated prerelease manifest is published and tested.
 * DEB and other non-updater packages use the manual GitHub Releases path.
 */

import { invoke } from '@tauri-apps/api/core';
import type { UpdateChannel } from '../i18n/locales';
import {
  BETA_CHANNEL_AVAILABLE,
  loadUpdateChannel,
  resolveActiveUpdateChannel,
} from '../i18n/locales';

export const GITHUB_RELEASES_URL =
  'https://github.com/mateowoj-cpu/ESP32-App/releases/latest';

export type InstallPackageKind =
  | 'appimage'
  | 'deb'
  | 'nsis'
  | 'msi'
  | 'dmg'
  | 'unknown';

export interface UpdateInstallInfo {
  os: string;
  packageKind: InstallPackageKind;
  /** Tauri plugin can install this package format when a signed manifest exists. */
  updaterSupported: boolean;
  /** Prefer opening GitHub Releases (DEB, unsigned builds, missing assets). */
  manualDownloadRecommended: boolean;
  releasesUrl: string;
}

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

export function isBetaChannelChoiceEnabled(): boolean {
  return BETA_CHANNEL_AVAILABLE;
}

/** Effective channel for checks/install — saved beta is ignored until beta is ready. */
export function effectiveUpdateChannel(
  preferred: UpdateChannel = loadUpdateChannel(),
): UpdateChannel {
  return resolveActiveUpdateChannel(preferred);
}

export function defaultUpdateInstallInfo(): UpdateInstallInfo {
  return {
    os: 'unknown',
    packageKind: 'unknown',
    updaterSupported: false,
    manualDownloadRecommended: true,
    releasesUrl: GITHUB_RELEASES_URL,
  };
}

export function shouldOfferManualDownload(
  info: UpdateInstallInfo,
  result: UpdateCheckResult | null,
): boolean {
  if (info.manualDownloadRecommended || !info.updaterSupported) {
    return true;
  }
  if (!result) return false;
  return result.status === 'unavailable' || result.status === 'error';
}

export function shouldOfferUpdaterInstall(
  info: UpdateInstallInfo,
  result: UpdateCheckResult | null,
): boolean {
  return (
    !!result &&
    result.status === 'available' &&
    info.updaterSupported &&
    !info.manualDownloadRecommended
  );
}

export async function getUpdateInstallInfo(): Promise<UpdateInstallInfo> {
  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    if (!isTauri()) {
      return defaultUpdateInstallInfo();
    }
    const info = await invoke<UpdateInstallInfo>('get_update_install_info');
    return {
      ...info,
      releasesUrl: info.releasesUrl || GITHUB_RELEASES_URL,
    };
  } catch {
    return defaultUpdateInstallInfo();
  }
}

export async function openManualReleaseDownload(
  releasesUrl: string = GITHUB_RELEASES_URL,
): Promise<{ ok: boolean; message: string }> {
  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    if (isTauri()) {
      const { openExternalUrl } = await import('./tools');
      const result = await openExternalUrl(releasesUrl);
      return { ok: result.ok, message: result.message };
    }
    window.open(releasesUrl, '_blank', 'noopener,noreferrer');
    return { ok: true, message: releasesUrl };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function checkForAppUpdate(
  channel: UpdateChannel = loadUpdateChannel(),
): Promise<UpdateCheckResult> {
  const active = effectiveUpdateChannel(channel);
  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    if (!isTauri()) {
      return { status: 'unavailable' };
    }
    const update = await invoke<ChannelUpdateInfo | null>('check_update_channel', {
      channel: active,
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
  const active = effectiveUpdateChannel(channel);
  try {
    await invoke('download_and_install_channel', { channel: active });
    return { status: 'ok' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'error', message };
  }
}
