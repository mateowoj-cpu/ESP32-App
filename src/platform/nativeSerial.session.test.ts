/**
 * P1 native serial session tests (mocked Tauri invoke/listen).
 * Covers: rapid port switch, first frame, disconnect/rediscover.
 * Split UTF-8 is covered in Rust unit tests (decode_utf8_stream).
 *
 * Run: npx tsx src/platform/nativeSerial.session.test.ts
 */
import {
  createNativeSerialAdapter,
  isActiveSerialSession,
  type NativeInvokeFn,
  type NativeListenFn,
  type NativePortDto,
  type SerialDataPayload,
  type SerialDisconnectedPayload,
} from './nativeSerial';
import type { UnlistenFn } from '@tauri-apps/api/event';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

type DataHandler = (event: { payload: SerialDataPayload }) => void;
type DiscHandler = (event: { payload: SerialDisconnectedPayload }) => void;

function createMockBackend() {
  let nextSession = 1;
  let activeSession: number | null = null;
  let activePath: string | null = null;
  let readStarted = false;
  let openShouldFail = false;

  const dataHandlers = new Set<DataHandler>();
  const discHandlers = new Set<DiscHandler>();

  const knownPaths = ['COM1', 'COM2', 'COM3', 'COM5', 'COM9'];

  const portsFor = (path: string): NativePortDto => ({
    id: path,
    label: path,
    path,
    usbVendorId: 0x303a,
    usbProductId: 0x1001,
    likelyEsp32: true,
  });

  const invoke: NativeInvokeFn = async <T>(cmd: string, args?: Record<string, unknown>) => {
    switch (cmd) {
      case 'list_serial_ports': {
        return knownPaths.map(portsFor) as T;
      }
      case 'close_serial_port': {
        const sid = args?.sessionId;
        if (sid != null && activeSession != null && Number(sid) !== activeSession) {
          // Stale close after a newer open — ignore (matches Rust).
          return undefined as T;
        }
        activeSession = null;
        activePath = null;
        readStarted = false;
        return undefined as T;
      }
      case 'open_serial_port': {
        if (openShouldFail) {
          throw new Error('simulated open failure');
        }
        const path = String(args?.path ?? 'COM3');
        const sessionId = nextSession++;
        activeSession = sessionId;
        activePath = path;
        readStarted = false;
        return {
          ...portsFor(path),
          sessionId,
        } as T;
      }
      case 'start_serial_read': {
        const sessionId = Number(args?.sessionId);
        if (activeSession == null || sessionId !== activeSession) {
          throw new Error('stale session');
        }
        readStarted = true;
        return undefined as T;
      }
      case 'write_serial_port': {
        const sid = args?.sessionId;
        if (sid != null && activeSession != null && Number(sid) !== activeSession) {
          throw new Error('stale session write');
        }
        return undefined as T;
      }
      default:
        throw new Error(`unexpected invoke: ${cmd}`);
    }
  };

  const listen: NativeListenFn = async <T>(event: string, handler: (e: { payload: T }) => void) => {
    if (event === 'serial-data') {
      dataHandlers.add(handler as DataHandler);
      return (() => dataHandlers.delete(handler as DataHandler)) as UnlistenFn;
    }
    if (event === 'serial-disconnected') {
      discHandlers.add(handler as DiscHandler);
      return (() => discHandlers.delete(handler as DiscHandler)) as UnlistenFn;
    }
    throw new Error(`unexpected listen: ${event}`);
  };

  return {
    invoke,
    listen,
    get readStarted() {
      return readStarted;
    },
    get activeSession() {
      return activeSession;
    },
    setOpenShouldFail(v: boolean) {
      openShouldFail = v;
    },
    emitData(payload: SerialDataPayload) {
      dataHandlers.forEach(h => h({ payload }));
    },
    emitDisconnect(payload: SerialDisconnectedPayload) {
      discHandlers.forEach(h => h({ payload }));
    },
  };
}

async function testIsActiveSerialSessionHelper() {
  assert(
    isActiveSerialSession(5, 5, 'COM3', 'COM3', 'COM3'),
    'matching session should be active'
  );
  assert(
    !isActiveSerialSession(4, 5, 'COM3', 'COM3', 'COM3'),
    'stale session should be rejected'
  );
  assert(
    !isActiveSerialSession(5, 5, 'COM9', 'COM3', 'COM3'),
    'wrong path should be rejected'
  );
}

async function testFirstFrameWaitsForOnData() {
  const backend = createMockBackend();
  const adapter = createNativeSerialAdapter({
    invoke: backend.invoke,
    listen: backend.listen,
  });

  const port = await adapter.requestPort({ portId: 'COM3', baudRate: 115200 });
  assert(!backend.readStarted, 'reader must not start before onData');

  // Stale/early emit before subscriber — no crash, nothing delivered.
  const early: string[] = [];
  backend.emitData({
    sessionId: backend.activeSession!,
    path: 'COM3',
    chunk: 'EARLY',
  });
  assert(early.length === 0, 'no subscriber yet');

  const chunks: string[] = [];
  port.onData(c => chunks.push(c));
  // Allow microtask for ensureReadStarted
  await Promise.resolve();
  assert(backend.readStarted, 'reader should start on first onData');

  backend.emitData({
    sessionId: backend.activeSession!,
    path: 'COM3',
    chunk: 'FIRST',
  });
  assert(chunks.join('') === 'FIRST', `expected FIRST, got ${JSON.stringify(chunks)}`);

  await port.close();
}

async function testRapidPortSwitch() {
  const backend = createMockBackend();
  const adapter = createNativeSerialAdapter({
    invoke: backend.invoke,
    listen: backend.listen,
  });

  const portA = await adapter.requestPort({ portId: 'COM1', baudRate: 115200 });
  const sessionA = backend.activeSession!;
  const chunksA: string[] = [];
  portA.onData(c => chunksA.push(c));
  await Promise.resolve();

  const portB = await adapter.requestPort({ portId: 'COM2', baudRate: 115200 });
  const sessionB = backend.activeSession!;
  assert(sessionB !== sessionA, 'new open must allocate a new session id');
  const chunksB: string[] = [];
  portB.onData(c => chunksB.push(c));
  await Promise.resolve();

  backend.emitData({ sessionId: sessionA, path: 'COM1', chunk: 'from-A' });
  backend.emitData({ sessionId: sessionB, path: 'COM2', chunk: 'from-B' });

  assert(chunksA.length === 0, 'stale session A must not deliver after switch');
  assert(chunksB.join('') === 'from-B', 'only active session B delivers');

  await portB.close();
}

async function testDisconnectAndRediscover() {
  const backend = createMockBackend();
  const adapter = createNativeSerialAdapter({
    invoke: backend.invoke,
    listen: backend.listen,
  });

  const port1 = await adapter.requestPort({ portId: 'COM5', baudRate: 115200 });
  const session1 = backend.activeSession!;
  let disconnected = false;
  port1.onDisconnect(() => {
    disconnected = true;
  });
  const chunks1: string[] = [];
  port1.onData(c => chunks1.push(c));
  await Promise.resolve();

  backend.emitDisconnect({
    sessionId: session1,
    path: 'COM5',
    reason: 'device unplugged',
  });
  assert(disconnected, 'disconnect listener should fire');

  // Late data for old session must not appear on a new open.
  const port2 = await adapter.requestPort({ portId: 'COM5', baudRate: 115200 });
  const session2 = backend.activeSession!;
  assert(session2 !== session1, 'rediscover allocates a new session');
  const chunks2: string[] = [];
  port2.onData(c => chunks2.push(c));
  await Promise.resolve();

  backend.emitData({ sessionId: session1, path: 'COM5', chunk: 'stale-after-unplug' });
  backend.emitData({ sessionId: session2, path: 'COM5', chunk: 'hello-again' });

  assert(chunks2.join('') === 'hello-again', 'only new session data delivered');
  assert(!chunks2.includes('stale-after-unplug'), 'old session data rejected');

  await port2.close();
}

async function testCleanupAfterFailedOpen() {
  const backend = createMockBackend();
  const adapter = createNativeSerialAdapter({
    invoke: backend.invoke,
    listen: backend.listen,
  });

  backend.setOpenShouldFail(true);
  let failed = false;
  try {
    await adapter.requestPort({ portId: 'COM9', baudRate: 115200 });
  } catch {
    failed = true;
  }
  assert(failed, 'open failure should reject');
  assert(backend.activeSession == null, 'failed open must leave no active session');

  backend.setOpenShouldFail(false);
  const port = await adapter.requestPort({ portId: 'COM9', baudRate: 115200 });
  assert(backend.activeSession != null, 'subsequent open should succeed');
  await port.close();
}

async function main() {
  await testIsActiveSerialSessionHelper();
  await testFirstFrameWaitsForOnData();
  await testRapidPortSwitch();
  await testDisconnectAndRediscover();
  await testCleanupAfterFailedOpen();
  console.log('nativeSerial.session.test.ts: OK');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
