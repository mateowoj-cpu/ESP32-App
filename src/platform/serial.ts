/**
 * Platform serial abstraction for ESP32 USB detection & COM monitor.
 *
 * UI code must use this module instead of calling `navigator.serial` directly.
 * Desktop hosts (e.g. Tauri) can register a native adapter later via
 * `setSerialAdapter(...)` without forking UsbDetectorView.
 */

export interface SerialPortInfo {
  /** Stable id for the port within the current session (browser handle or COMx). */
  id: string;
  /** Human-readable label, e.g. "COM3" or "USB Serial Device". */
  label: string;
  usbVendorId?: number;
  usbProductId?: number;
}

export type SerialDataListener = (chunk: string) => void;
export type SerialDisconnectListener = () => void;

export interface OpenSerialPort {
  info: SerialPortInfo;
  write(data: string): Promise<void>;
  close(): Promise<void>;
  onData(listener: SerialDataListener): () => void;
  onDisconnect(listener: SerialDisconnectListener): () => void;
}

export interface RequestPortOptions {
  /** Optional USB filters (Web Serial). Ignored by mock / future native adapters if unsupported. */
  filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;
  baudRate?: number;
}

export type SerialBackendKind = 'web' | 'mock' | 'native' | 'unavailable';

export interface SerialAdapter {
  readonly kind: SerialBackendKind;
  /** True when the user can pick / open a real or simulated port. */
  isAvailable(): boolean;
  /** Short PL message shown when serial is unavailable. */
  unavailableReason(): string | null;
  /** List already-authorized / known ports when the backend supports it. */
  listPorts(): Promise<SerialPortInfo[]>;
  /**
   * Ask the user (or host) to choose a port and optionally open it.
   * Web Serial: browser picker. Mock: returns a canned ESP32-S3 device.
   */
  requestPort(options?: RequestPortOptions): Promise<OpenSerialPort>;
}

/** Minimal Web Serial typings (not always present in lib.dom). */
interface WebSerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

interface WebSerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface WebSerialPort {
  getInfo(): WebSerialPortInfo;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

interface WebSerialApi {
  requestPort(options?: { filters?: WebSerialPortFilter[] }): Promise<WebSerialPort>;
  getPorts(): Promise<WebSerialPort[]>;
}

function getWebSerialApi(): WebSerialApi | null {
  if (typeof navigator === 'undefined') return null;
  const serial = (navigator as Navigator & { serial?: WebSerialApi }).serial;
  return serial ?? null;
}

function formatVidPid(vid?: number, pid?: number): string {
  const v = vid != null ? `0x${vid.toString(16).toUpperCase().padStart(4, '0')}` : '????';
  const p = pid != null ? `0x${pid.toString(16).toUpperCase().padStart(4, '0')}` : '????';
  return `${v}:${p}`;
}

function createOpenWebSerialPort(port: WebSerialPort, _baudRate: number): OpenSerialPort {
  const infoRaw = port.getInfo();
  const info: SerialPortInfo = {
    id: `web-${formatVidPid(infoRaw.usbVendorId, infoRaw.usbProductId)}-${Date.now()}`,
    label: `USB Serial (${formatVidPid(infoRaw.usbVendorId, infoRaw.usbProductId)})`,
    usbVendorId: infoRaw.usbVendorId,
    usbProductId: infoRaw.usbProductId,
  };

  const dataListeners = new Set<SerialDataListener>();
  const disconnectListeners = new Set<SerialDisconnectListener>();
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let closed = false;
  let readLoopPromise: Promise<void> | null = null;

  const decoder = new TextDecoder();

  const startReadLoop = async () => {
    if (!port.readable) return;
    reader = port.readable.getReader();
    try {
      while (!closed) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value && value.length > 0) {
          const text = decoder.decode(value, { stream: true });
          if (text) {
            dataListeners.forEach(listener => listener(text));
          }
        }
      }
    } catch {
      // Port closed or device unplugged mid-read.
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
      reader = null;
      if (!closed) {
        closed = true;
        disconnectListeners.forEach(listener => listener());
      }
    }
  };

  return {
    info,
    async write(data: string) {
      if (closed || !port.writable) {
        throw new Error('Port szeregowy jest zamknięty');
      }
      const writer = port.writable.getWriter();
      try {
        await writer.write(new TextEncoder().encode(data));
      } finally {
        writer.releaseLock();
      }
    },
    async close() {
      if (closed) return;
      closed = true;
      try {
        await reader?.cancel();
      } catch {
        // ignore
      }
      try {
        await port.close();
      } catch {
        // ignore
      }
      disconnectListeners.forEach(listener => listener());
    },
    onData(listener: SerialDataListener) {
      dataListeners.add(listener);
      if (!readLoopPromise) {
        // Open is awaited by requestPort before returning; start reading lazily on first subscriber.
        readLoopPromise = startReadLoop();
      }
      return () => {
        dataListeners.delete(listener);
      };
    },
    onDisconnect(listener: SerialDisconnectListener) {
      disconnectListeners.add(listener);
      return () => {
        disconnectListeners.delete(listener);
      };
    },
  };
}

export function createWebSerialAdapter(): SerialAdapter {
  return {
    kind: 'web',
    isAvailable() {
      return getWebSerialApi() != null;
    },
    unavailableReason() {
      if (getWebSerialApi() != null) return null;
      return (
        'Twoja przeglądarka nie obsługuje Web Serial API ' +
        '(dostępne w Google Chrome, Edge, Brave i Chromium na Windows/macOS/Linux). ' +
        'Możesz wybrać model ESP32 z poniższej bazy sprzętowej.'
      );
    },
    async listPorts() {
      const api = getWebSerialApi();
      if (!api) return [];
      const ports = await api.getPorts();
      return ports.map((port, index) => {
        const info = port.getInfo();
        return {
          id: `web-known-${index}-${formatVidPid(info.usbVendorId, info.usbProductId)}`,
          label: `USB Serial (${formatVidPid(info.usbVendorId, info.usbProductId)})`,
          usbVendorId: info.usbVendorId,
          usbProductId: info.usbProductId,
        };
      });
    },
    async requestPort(options?: RequestPortOptions) {
      const api = getWebSerialApi();
      if (!api) {
        throw new Error(this.unavailableReason() || 'Web Serial niedostępne');
      }
      const baudRate = options?.baudRate ?? 115200;
      const port = await api.requestPort(
        options?.filters?.length ? { filters: options.filters } : undefined
      );
      await port.open({ baudRate });
      return createOpenWebSerialPort(port, baudRate);
    },
  };
}

/** Default mock device: Espressif ESP32-S3 native USB (VID 0x303A / PID 0x1001). */
export const MOCK_ESP32_S3_PORT: SerialPortInfo = {
  id: 'mock-esp32-s3',
  label: 'COM3 (Mock ESP32-S3)',
  usbVendorId: 0x303a,
  usbProductId: 0x1001,
};

export function createMockSerialAdapter(
  portInfo: SerialPortInfo = MOCK_ESP32_S3_PORT
): SerialAdapter {
  return {
    kind: 'mock',
    isAvailable() {
      return true;
    },
    unavailableReason() {
      return null;
    },
    async listPorts() {
      return [portInfo];
    },
    async requestPort(_options?: RequestPortOptions) {
      const dataListeners = new Set<SerialDataListener>();
      const disconnectListeners = new Set<SerialDisconnectListener>();
      let closed = false;

      // Simulate a short boot banner after "connect".
      queueMicrotask(() => {
        if (closed) return;
        const banner =
          'ESP-ROM:esp32s3-20210327\n' +
          '[MOCK] Port szeregowy symulowany — brak fizycznego urządzenia\n';
        dataListeners.forEach(listener => listener(banner));
      });

      return {
        info: portInfo,
        async write(data: string) {
          if (closed) throw new Error('Port mock jest zamknięty');
          const trimmed = data.trim();
          let reply = `> Nieznana komenda mock: ${trimmed}\n`;
          const lower = trimmed.toLowerCase();
          if (lower === 'ping') reply = 'ESP32 PONG (mock)\n';
          else if (lower === 'info') reply = 'Chip: ESP32-S3 (mock) | Flash: 16MB\n';
          else if (lower === 'restart') reply = 'ESP-ROM: Restart (mock) OK\n';
          queueMicrotask(() => {
            if (!closed) dataListeners.forEach(listener => listener(reply));
          });
        },
        async close() {
          if (closed) return;
          closed = true;
          disconnectListeners.forEach(listener => listener());
        },
        onData(listener: SerialDataListener) {
          dataListeners.add(listener);
          return () => dataListeners.delete(listener);
        },
        onDisconnect(listener: SerialDisconnectListener) {
          disconnectListeners.add(listener);
          return () => disconnectListeners.delete(listener);
        },
      };
    },
  };
}

export function createUnavailableSerialAdapter(reason: string): SerialAdapter {
  return {
    kind: 'unavailable',
    isAvailable() {
      return false;
    },
    unavailableReason() {
      return reason;
    },
    async listPorts() {
      return [];
    },
    async requestPort() {
      throw new Error(reason);
    },
  };
}

/**
 * Resolve the best available adapter for the current runtime.
 * Prefer Web Serial when present; otherwise fall back to unavailable
 * (UI still allows manual board presets). Pass `forceMock` in tests.
 */
export function resolveSerialAdapter(options?: { forceMock?: boolean }): SerialAdapter {
  if (options?.forceMock) {
    return createMockSerialAdapter();
  }
  const web = createWebSerialAdapter();
  if (web.isAvailable()) {
    return web;
  }
  return createUnavailableSerialAdapter(
    web.unavailableReason() ||
      'Port szeregowy jest niedostępny w tym środowisku. Wybierz płytkę z bazy sprzętowej.'
  );
}

let activeAdapter: SerialAdapter | null = null;

/** Get (and lazily create) the process-wide serial adapter. */
export function getSerialAdapter(): SerialAdapter {
  if (!activeAdapter) {
    activeAdapter = resolveSerialAdapter();
  }
  return activeAdapter;
}

/** Override adapter (tests, Tauri bootstrap, mock demo mode). */
export function setSerialAdapter(adapter: SerialAdapter): void {
  activeAdapter = adapter;
}

/** Reset to automatic resolution on next getSerialAdapter(). */
export function resetSerialAdapter(): void {
  activeAdapter = null;
}

export class SerialRequestCancelledError extends Error {
  readonly name = 'SerialRequestCancelledError';
  constructor(message = 'Wybór portu został anulowany') {
    super(message);
  }
}

export function isSerialRequestCancelled(err: unknown): boolean {
  if (err instanceof SerialRequestCancelledError) return true;
  if (err && typeof err === 'object' && 'name' in err) {
    return (err as { name: string }).name === 'NotFoundError';
  }
  return false;
}
