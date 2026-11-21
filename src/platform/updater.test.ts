/**
 * Updater channel helpers + manual-download gating (no Tauri invoke).
 * Run: npx tsx src/platform/updater.test.ts
 */
import assert from 'node:assert/strict';
import {
  BETA_CHANNEL_AVAILABLE,
  resolveActiveUpdateChannel,
  UPDATE_ENDPOINTS,
} from '../i18n/locales';
import {
  GITHUB_RELEASES_URL,
  defaultUpdateInstallInfo,
  isBetaChannelChoiceEnabled,
  shouldOfferManualDownload,
  shouldOfferUpdaterInstall,
  type UpdateCheckResult,
  type UpdateInstallInfo,
} from './updater';

assert.equal(isBetaChannelChoiceEnabled(), BETA_CHANNEL_AVAILABLE, 'beta UI gate matches flag');
assert.equal(BETA_CHANNEL_AVAILABLE, false, 'beta stays off until prerelease manifest is tested');

assert.equal(resolveActiveUpdateChannel('stable'), 'stable');
assert.equal(
  resolveActiveUpdateChannel('beta'),
  BETA_CHANNEL_AVAILABLE ? 'beta' : 'stable',
  'saved beta preference must not activate until channel is ready',
);

for (const url of UPDATE_ENDPOINTS.beta) {
  assert.ok(!url.includes('/releases/latest/'), `beta must not use stable latest: ${url}`);
  assert.ok(url.includes('beta-channel') || url.includes('latest-beta'), `beta url shape: ${url}`);
}
assert.ok(
  UPDATE_ENDPOINTS.stable[0].includes('/releases/latest/download/latest.json'),
  'stable endpoint',
);

assert.equal(GITHUB_RELEASES_URL.includes('/releases/latest'), true);

const deb: UpdateInstallInfo = {
  os: 'linux',
  packageKind: 'deb',
  updaterSupported: false,
  manualDownloadRecommended: true,
  releasesUrl: GITHUB_RELEASES_URL,
};
const appimage: UpdateInstallInfo = {
  os: 'linux',
  packageKind: 'appimage',
  updaterSupported: true,
  manualDownloadRecommended: false,
  releasesUrl: GITHUB_RELEASES_URL,
};
const available: UpdateCheckResult = { status: 'available', version: '0.3.0' };
const err: UpdateCheckResult = { status: 'error', message: 'no manifest' };
const unavailable: UpdateCheckResult = { status: 'unavailable' };

assert.equal(shouldOfferManualDownload(deb, available), true, 'DEB always offers manual');
assert.equal(shouldOfferUpdaterInstall(deb, available), false, 'DEB never uses plugin install');
assert.equal(shouldOfferUpdaterInstall(appimage, available), true, 'AppImage can use updater');
assert.equal(shouldOfferManualDownload(appimage, available), false, 'AppImage ok skips manual');
assert.equal(shouldOfferManualDownload(appimage, err), true, 'errors offer manual');
assert.equal(shouldOfferManualDownload(appimage, unavailable), true, 'unavailable offers manual');

const fallback = defaultUpdateInstallInfo();
assert.equal(fallback.manualDownloadRecommended, true);
assert.equal(fallback.updaterSupported, false);

console.log('updater.test.ts: OK');
