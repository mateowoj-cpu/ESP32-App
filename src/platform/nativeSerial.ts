/**
 * Tauri native serial adapter — talks to Rust commands in src-tauri/src/serial.rs.
 * Registered at bootstrap when `isTauri()` is true.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  OpenSerialPort,
  RequestPortOptions,
  SerialAdapter,
  SerialDataListener,
  SerialDisconnectListener,
  SerialPortInfo,
} from './serial';
import { SerialRequestCancelledError } from './serial';

interface NativePortDto {
  id: string;
  label: string;
  path: string;
  usbVendorId?: number | null;
  usbProductId?: number | null;
  manufacturer?: string | null;
  product?: string | null;
  likelyEsp32: boolean;
}

interface SerialDataPayload {
  path: string;
  chunk: string;
}

interface SerialDisconnectedPayload {
  path: string;
  reason: string;
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

export function createNativeSerialAdapter(): SerialAdapter {
  let unlistenData: UnlistenFn | null = null;
  let unlistenDisconnect: UnlistenFn | null = null;

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
      const ports = await invoke<NativePortDto[]>('list_serial_ports');
      let selected: NativePortDto;
      try {
        selected = pickBestPort(ports, options);
      } catch (err) {
        // Surface as cancelled when UI is expected to show a picker (multiple ports).
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('Wybierz port')) {
          throw new SerialRequestCancelledError(message);
        }
        throw err;
      }

      const baudRate = options?.baudRate ?? 115200;
      const opened = await invoke<NativePortDto>('open_serial_port', {
        path: selected.path,
        baudRate,
      });

      const info = toPortInfo(opened);
      const dataListeners = new Set<SerialDataListener>();
      const disconnectListeners = new Set<SerialDisconnectListener>();
      let closed = false;

      await cleanupListeners();

      unlistenData = await listen<SerialDataPayload>('serial-data', event => {
        if (closed) return;
        if (event.payload.path !== info.id && event.payload.path !== selected.path) return;
        dataListeners.forEach(listener => listener(event.payload.chunk));
      });

      unlistenDisconnect = await listen<SerialDisconnectedPayload>('serial-disconnected', event => {
        if (closed) return;
        if (event.payload.path !== info.id && event.payload.path !== selected.path) return;
        closed = true;
        disconnectListeners.forEach(listener => listener());
        void cleanupListeners();
      });

      return {
        info,
        async write(data: string) {
          if (closed) throw new Error('Port szeregowy jest zamknięty');
          await invoke('write_serial_port', { data });
        },
        async close() {
          if (closed) return;
          closed = true;
          try {
            await invoke('close_serial_port');
          } finally {
            await cleanupListeners();
            disconnectListeners.forEach(listener => listener());
          }
        },
        onData(listener: SerialDataListener) {
          dataListeners.add(listener);
          return () => dataListeners.delete(listener);
        },
        onDisconnect(listener: SerialDisconnectListener) {
          disconnectListeners.add(listener);
          return () => disconnectListeners.delete(listener);
        },
      } satisfies OpenSerialPort;
    },
  };
}

/** List native ports for UI pickers (returns empty outside Tauri / on error). */
export async function listNativeSerialPortsDetailed(): Promise<NativePortDto[]> {
  try {
    return await invoke<NativePortDto[]>('list_serial_ports');
  } catch {
    return [];
  }
}
