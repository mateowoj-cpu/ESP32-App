import { looksLikeHost } from './otaHost';
import type { DiscoveredOtaHost } from './ota';

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

console.log('ota.test.ts: OK');
