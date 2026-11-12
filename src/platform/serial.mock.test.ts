/**
 * Lightweight smoke checks for the mock serial adapter.
 * Run: npx tsx src/platform/serial.mock.test.ts
 */
import {
  createMockSerialAdapter,
  MOCK_ESP32_S3_PORT,
  resolveSerialAdapter,
  setSerialAdapter,
  resetSerialAdapter,
  getSerialAdapter,
} from './serial';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  resetSerialAdapter();
  setSerialAdapter(createMockSerialAdapter());

  const adapter = getSerialAdapter();
  assert(adapter.kind === 'mock', 'expected mock adapter');
  assert(adapter.isAvailable(), 'mock should be available');
  assert(adapter.unavailableReason() === null, 'mock should have no unavailable reason');

  const ports = await adapter.listPorts();
  assert(ports.length === 1, 'expected one mock port');
  assert(ports[0].id === MOCK_ESP32_S3_PORT.id, 'unexpected mock port id');

  const open = await adapter.requestPort({ baudRate: 115200 });
  assert(open.info.usbVendorId === 0x303a, 'expected Espressif VID');
  assert(open.info.usbProductId === 0x1001, 'expected S3 PID');

  const chunks: string[] = [];
  open.onData(chunk => chunks.push(chunk));

  await open.write('ping\n');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert(
    chunks.some(c => c.toLowerCase().includes('pong')),
    `expected pong reply, got: ${JSON.stringify(chunks)}`
  );

  await open.close();

  resetSerialAdapter();
  const forced = resolveSerialAdapter({ forceMock: true });
  assert(forced.kind === 'mock', 'forceMock should resolve mock');

  console.log('serial.mock.test.ts: OK');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
