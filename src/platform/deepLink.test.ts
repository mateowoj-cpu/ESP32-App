import { resolveOpenTarget } from './deepLink';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(
  resolveOpenTarget('esp32studio://open?path=C%3A%5Cproj%5Cdemo.esp32studio') ===
    'C:\\proj\\demo.esp32studio',
  'query path',
);

assert(
  resolveOpenTarget('C:\\proj\\demo.esp32studio') === 'C:\\proj\\demo.esp32studio',
  'plain path',
);

assert(resolveOpenTarget('esp32studio://flash?path=/tmp/fw.bin') === '/tmp/fw.bin', 'flash url');

assert(resolveOpenTarget('') === null, 'empty');

console.log('deepLink.test.ts: OK');
