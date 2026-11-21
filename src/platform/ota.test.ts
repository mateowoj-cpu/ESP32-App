import { looksLikeHost } from './otaHost';
import type { DiscoveredOtaHost, OtaResult } from './ota';
import { mapOtaErrorMessage } from './ota';
import { matchesPreferredMdns, rankOtaHosts } from './otaRecent';
import { generateArduinoCppCode } from '../utils/codeGenerator';
import {
  DEFAULT_API_CONFIG,
  DEFAULT_DISPLAY_CONFIG,
  DEFAULT_SYSTEM_CONFIG,
  PRESET_CYBER_PET_SCREENS,
  normalizeOtaFields,
} from '../utils/presets';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(looksLikeHost('192.168.1.50'), 'ipv4');
assert(looksLikeHost('esp32-display.local'), 'mdns');
assert(!looksLikeHost(''), 'empty');
assert(!looksLikeHost('not an ip'), 'spaces');

const sample: DiscoveredOtaHost = {
  host: '192.168.1.50',
  hostname: 'esp32-display.local',
  addresses: ['192.168.1.50'],
  port: 3232,
  service: '_arduino._tcp.local',
  fullname: 'esp32-display._arduino._tcp.local',
};
assert(sample.port === 3232, 'discovered port');
assert(sample.service.includes('arduino'), 'arduino service');

const other: DiscoveredOtaHost = {
  host: '10.0.0.9',
  hostname: 'other.local',
  addresses: ['10.0.0.9'],
  port: 3232,
  service: '_http._tcp.local',
  fullname: 'other._http._tcp.local',
};
const ranked = rankOtaHosts([other, sample], 'esp32-display');
assert(ranked[0].hostname.includes('esp32-display'), 'rank prefers mdns name');
assert(matchesPreferredMdns(sample, 'esp32-display'), 'match mdns');

const t = (key: string) => `T:${key}`;
assert(
  mapOtaErrorMessage(t, { ok: false, message: 'x', errorCode: 'auth' }) === 'T:ota.err.auth',
  'map auth',
);
assert(
  mapOtaErrorMessage(t, { ok: false, message: 'espota timeout after 180s', errorCode: null }) ===
    'T:ota.timedOut',
  'map timeout msg',
);
assert(
  mapOtaErrorMessage(t, { ok: false, message: 'OTA anulowane', errorCode: 'cancelled' }) ===
    'T:ota.cancelled',
  'map cancelled distinct from timeout',
);
assert(
  mapOtaErrorMessage(t, { ok: false, message: 'espota timeout after 5s', errorCode: 'timeout' }) ===
    'T:ota.timedOut',
  'map timeout code',
);

// New projects: OTA opt-in + empty individual password (no shared default secret).
assert(DEFAULT_SYSTEM_CONFIG.otaEnabled === false, 'new project OTA disabled by default');
assert(DEFAULT_SYSTEM_CONFIG.otaPassword === '', 'new project OTA password empty');

const secret = 'super-secret-ota-pw';
const withSecret = {
  ...DEFAULT_SYSTEM_CONFIG,
  otaEnabled: true,
  otaPassword: secret,
};
const sketch = generateArduinoCppCode(
  DEFAULT_DISPLAY_CONFIG,
  withSecret,
  DEFAULT_API_CONFIG,
  PRESET_CYBER_PET_SCREENS,
  [],
);
assert(sketch.includes(`#define OTA_PASSWORD  "${secret}"`), 'codegen embeds project password');

const defaultSketch = generateArduinoCppCode(
  DEFAULT_DISPLAY_CONFIG,
  DEFAULT_SYSTEM_CONFIG,
  DEFAULT_API_CONFIG,
  PRESET_CYBER_PET_SCREENS,
  [],
);
assert(defaultSketch.includes('#define OTA_ENABLED   0'), 'default sketch OTA off');
assert(defaultSketch.includes('#define OTA_PASSWORD  ""'), 'default sketch empty OTA password');
assert(!defaultSketch.includes('esp32ota'), 'no shared default OTA password in sketch');

// Imported / partial configs without otaEnabled must not enable OTA with an empty password.
const omittedOta = { ...DEFAULT_SYSTEM_CONFIG };
delete (omittedOta as { otaEnabled?: boolean }).otaEnabled;
const omittedSketch = generateArduinoCppCode(
  DEFAULT_DISPLAY_CONFIG,
  omittedOta,
  DEFAULT_API_CONFIG,
  PRESET_CYBER_PET_SCREENS,
  [],
);
assert(omittedSketch.includes('#define OTA_ENABLED   0'), 'missing otaEnabled => OTA off');

const normalizedOmit = normalizeOtaFields(omittedOta);
assert(normalizedOmit.otaEnabled === false, 'normalizeOtaFields: omitted => false');
assert(normalizeOtaFields({ ...DEFAULT_SYSTEM_CONFIG, otaEnabled: true }).otaEnabled === true, 'normalize keeps true');
assert(
  normalizeOtaFields({ ...DEFAULT_SYSTEM_CONFIG, otaPassword: undefined as unknown as string }).otaPassword === '',
  'normalizeOtaFields: missing password => empty',
);

/** Simulate UI/diagnostics export lines built from OtaResult (password must never appear). */
function diagnosticsLineFromResult(result: Pick<OtaResult, 'message' | 'errorCode' | 'ok'>, host: string): string {
  const msg = mapOtaErrorMessage(t, result);
  return `${msg} host=${host} method=espota code=${result.errorCode || ''}`;
}

const cancelResult: OtaResult = {
  ok: false,
  method: 'espota',
  message: 'OTA anulowane przez użytkownika.',
  errorCode: 'cancelled',
};
const timeoutResult: OtaResult = {
  ok: false,
  method: 'espota',
  message: 'espota timeout after 5s',
  errorCode: 'timeout',
};
const maskedCmdEvent = '$ /usr/bin/python espota.py -i 192.168.1.50 -a *** -f app.bin';

for (const text of [
  diagnosticsLineFromResult(cancelResult, '192.168.1.50'),
  diagnosticsLineFromResult(timeoutResult, '192.168.1.50'),
  mapOtaErrorMessage(t, cancelResult),
  mapOtaErrorMessage(t, timeoutResult),
  maskedCmdEvent,
]) {
  assert(!text.includes(secret), `password must not appear in: ${text}`);
  assert(!text.includes('esp32ota') || text.includes('***'), `no default secret in: ${text}`);
}

assert(cancelResult.errorCode !== timeoutResult.errorCode, 'cancel vs timeout distinct');

console.log('ota.test.ts: OK');
