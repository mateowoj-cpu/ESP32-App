/**
 * Tauri native serial adapter — talks to Rust commands in src-tauri/src/serial.rs.
 * Registered at bootstrap when `isTauri()` is true.
 *
 * Open does not start RX until the first `onData` subscriber (after Tauri listeners
 * are registered), so the first frame is not lost to a race with JS registration.
 */

import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { listen as tauriListen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  OpenSerialPort,
  RequestPortOptions,
  SerialAdapter,
  SerialDataListener,
  SerialDisconnectListener,
  SerialPortInfo,
} from './serial';
import { SerialRequestCancelledError } from './serial';

export interface NativePortDto {
  id: string;
  label: string;
  path: string;
  usbVendorId?: number | null;
  usbProductId?: number | null;
  manufacturer?: string | null;
  product?: string | null;
  likelyEsp32: boolean;
  /** Present on open_serial_port result. */
  sessionId?: number;
}

export interface SerialDataPayload {
  sessionId: number;
  path: string;
  chunk: string;
}

export interface SerialDisconnectedPayload {
  sessionId: number;
  path: string;
  reason: string;
}

export type NativeInvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
export type NativeListenFn = <T>(
  event: string,
  handler: (event: { payload: T }) => void
) => Promise<UnlistenFn>;

export interface NativeSerialDeps {
  invoke?: NativeInvokeFn;
  listen?: NativeListenFn;
}

const ESP_VENDOR_IDS = new Set([0x303a, 0x10c4, 0x1a86, 0x0403]);

function toPortInfo(dto: NativePortDto): SerialPortInfo {
  return {
    id: dto.id || dto.path,
    label: dto.label || dto.path,
    usbVendorId: dto.usbVendorId ?? undefined,
    usbProductId: dto.usbProductId ?? undefined,
  };
}

/** True when an event belongs to the active open session. */
export function isActiveSerialSession(
  eventSessionId: number | undefined,
  activeSessionId: number,
  eventPath: string,
  portId: string,
  portPath: string
): boolean {
  if (eventSessionId != null && eventSessionId !== activeSessionId) {
    return false;
  }
  return eventPath === portId || eventPath === portPath;
}

function pickBestPort(ports: NativePortDto[], options?: RequestPortOptions): NativePortDto {
  if (options?.portId) {
    const match = ports.find(p => p.id === options.portId || p.path === options.portId);
    if (!match) {
      throw new Error(`Nie znaleziono portu: ${options.portId}`);
    }
    return match;
  }

  if (options?.filters?.length) {
    const filtered = ports.filter(p =>
      options.filters!.some(f => {
        const vidOk = f.usbVendorId == null || p.usbVendorId === f.usbVendorId;
        const pidOk = f.usbProductId == null || p.usbProductId === f.usbProductId;
        return vidOk && pidOk;
      })
    );
    if (filtered.length === 1) return filtered[0];
    if (filtered.length > 1) {
      throw new Error(
        `Znaleziono wiele portów pasujących do filtra (${filtered.map(p => p.path).join(', ')}). Wybierz port ręcznie.`
      );
    }
  }

  const espLike = ports.filter(
    p => p.likelyEsp32 || (p.usbVendorId != null && ESP_VENDOR_IDS.has(p.usbVendorId))
  );
  if (espLike.length === 1) return espLike[0];
  if (espLike.length > 1) {
    throw new Error(
      `Wykryto wiele potencjalnych ESP32 (${espLike.map(p => p.path).join(', ')}). Wybierz port z listy.`
    );
  }

  if (ports.length === 1) return ports[0];
  if (ports.length === 0) {
    throw new Error(
      'Nie znaleziono żadnego portu COM/tty. Sprawdź kabel USB i sterownik (CH340 / CP210x / Espressif).'
    );
  }

  throw new Error(
    `Znaleziono wiele portów (${ports.map(p => p.path).join(', ')}). Wybierz port z listy.`
  );
}

export function createNativeSerialAdapter(deps: NativeSerialDeps = {}): SerialAdapter {
  const invoke: NativeInvokeFn = deps.invoke ?? ((cmd, args) => tauriInvoke(cmd, args));
  const listen: NativeListenFn = deps.listen ?? ((event, handler) => tauriListen(event, handler));

  let unlistenData: UnlistenFn | null = null;
  let unlistenDisconnect: UnlistenFn | null = null;
  /** Serializes overlapping requestPort / close calls on the JS side. */
  let lifecycleQueue: Promise<void> = Promise.resolve();

  const runExclusive = async <T>(fn: () => Promise<T>): Promise<T> => {
    let release!: () => void;
    const prev = lifecycleQueue;
    lifecycleQueue = new Promise<void>(resolve => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  };

  const cleanupListeners = async () => {
    if (unlistenData) {
      unlistenData();
      unlistenData = null;
    }
    if (unlistenDisconnect) {
      unlistenDisconnect();
      unlistenDisconnect = null;
    }
  };

  return {
    kind: 'native',
    isAvailable() {
      return true;
    },
    unavailableReason() {
      return null;
    },
    async listPorts() {
      const ports = await invoke<NativePortDto[]>('list_serial_ports');
      return ports.map(toPortInfo);
    },
    async requestPort(options?: RequestPortOptions) {
      return runExclusive(async () => {
        const ports = await invoke<NativePortDto[]>('list_serial_ports');
        let selected: NativePortDto;
        try {
          selected = pickBestPort(ports, options);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes('Wybierz port')) {
            throw new SerialRequestCancelledError(message);
          }
          throw err;
        }

        const baudRate = options?.baudRate ?? 115200;

        // Close any previous native session before opening (Rust also serializes).
        try {
          await invoke('close_serial_port');
        } catch {
          // ignore — may already be closed
        }
        await cleanupListeners();

        let opened: NativePortDto;
        try {
          opened = await invoke<NativePortDto>('open_serial_port', {
            path: selected.path,
            baudRate,
          });
        } catch (err) {
          // Partial failure: ensure Rust state is cleared and listeners are gone.
          try {
            await invoke('close_serial_port');
          } catch {
            // ignore
          }
          await cleanupListeners();
          throw err;
        }

        const sessionId = opened.sessionId;
        if (sessionId == null || !Number.isFinite(sessionId)) {
          try {
            await invoke('close_serial_port');
          } catch {
            // ignore
          }
          throw new Error('open_serial_port nie zwrócił sessionId');
        }

        const info = toPortInfo(opened);
        const dataListeners = new Set<SerialDataListener>();
        const disconnectListeners = new Set<SerialDisconnectListener>();
        let closed = false;
        let readStarted = false;
        let readStartPromise: Promise<void> | null = null;

        // Register Tauri listeners BEFORE starting the Rust reader.
        unlistenData = await listen<SerialDataPayload>('serial-data', event => {
          if (closed) return;
          if (
            !isActiveSerialSession(
              event.payload.sessionId,
              sessionId,
              event.payload.path,
              info.id,
              selected.path
            )
          ) {
            return;
          }
          dataListeners.forEach(listener => listener(event.payload.chunk));
        });

        unlistenDisconnect = await listen<SerialDisconnectedPayload>(
          'serial-disconnected',
          event => {
            if (closed) return;
            if (
              !isActiveSerialSession(
                event.payload.sessionId,
                sessionId,
                event.payload.path,
                info.id,
                selected.path
              )
            ) {
              return;
            }
            closed = true;
            disconnectListeners.forEach(listener => listener());
            void cleanupListeners();
          }
        );

        const ensureReadStarted = () => {
          if (readStarted || closed) return readStartPromise ?? Promise.resolve();
          readStarted = true;
          readStartPromise = invoke('start_serial_read', { sessionId }).then(
            () => undefined,
            err => {
              readStarted = false;
              readStartPromise = null;
              throw err;
            }
          );
          return readStartPromise;
        };

        return {
          info,
          async write(data: string) {
            if (closed) throw new Error('Port szeregowy jest zamknięty');
            await invoke('write_serial_port', { data, sessionId });
          },
          async close() {
            if (closed) return;
            closed = true;
            try {
              await invoke('close_serial_port', { sessionId });
            } finally {
              await cleanupListeners();
              disconnectListeners.forEach(listener => listener());
            }
          },
          onData(listener: SerialDataListener) {
            dataListeners.add(listener);
            // Align RX start with first JS subscriber (mirrors Web Serial).
            void ensureReadStarted();
            return () => dataListeners.delete(listener);
          },
          onDisconnect(listener: SerialDisconnectListener) {
            disconnectListeners.add(listener);
            return () => disconnectListeners.delete(listener);
          },
        } satisfies OpenSerialPort;
      });
    },
  };
}

/** List native ports for UI pickers (returns empty outside Tauri / on error). */
export async function listNativeSerialPortsDetailed(): Promise<NativePortDto[]> {
  try {
    return await tauriInvoke<NativePortDto[]>('list_serial_ports');
  } catch {
    return [];
  }
}
