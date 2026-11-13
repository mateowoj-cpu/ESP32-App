import { pioBoardId, resolvePioBoardProfile } from './codeGenerator';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(resolvePioBoardProfile('ESP32-S3') === 'esp32s3', 's3');
assert(resolvePioBoardProfile('ESP32-C3') === 'esp32c3', 'c3');
assert(resolvePioBoardProfile('ESP32') === 'esp32', 'classic');
assert(pioBoardId('esp32s3').board === 'esp32-s3-devkitc-1', 's3 board');
assert(pioBoardId('esp32').env === 'esp32dev', 'dev env');

console.log('pioBoard.test.ts: OK');
