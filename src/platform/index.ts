export {
  MOCK_ESP32_S3_PORT,
  SerialRequestCancelledError,
  createMockSerialAdapter,
  createUnavailableSerialAdapter,
  createWebSerialAdapter,
  getSerialAdapter,
  isSerialRequestCancelled,
  resetSerialAdapter,
  resolveSerialAdapter,
  setSerialAdapter,
} from './serial';

// nativeSerial is loaded only from main.tsx via dynamic import when running inside Tauri,
// so the browser build does not eagerly pull @tauri-apps/api.

export type {
  OpenSerialPort,
  RequestPortOptions,
  SerialAdapter,
  SerialBackendKind,
  SerialDataListener,
  SerialDisconnectListener,
  SerialPortInfo,
} from './serial';
