import { looksLikeHost } from './otaHost';
import type { DiscoveredOtaHost } from './ota';
import { mapOtaErrorMessage } from './ota';
import { matchesPreferredMdns, rankOtaHosts } from './otaRecent';

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

console.log('ota.test.ts: OK');
