import { looksLikeHost } from './otaHost';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(looksLikeHost('192.168.1.50'), 'ipv4');
assert(looksLikeHost('esp32-display.local'), 'mdns');
assert(!looksLikeHost(''), 'empty');
assert(!looksLikeHost('not an ip'), 'spaces');

console.log('ota.test.ts: OK');
