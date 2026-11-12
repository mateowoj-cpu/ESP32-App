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

export type {
  OpenSerialPort,
  RequestPortOptions,
  SerialAdapter,
  SerialBackendKind,
  SerialDataListener,
  SerialDisconnectListener,
  SerialPortInfo,
} from './serial';
