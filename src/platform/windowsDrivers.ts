/**
 * Shared USB-UART driver hints for Windows (docs + UsbDetectorView).
 */

export interface WindowsUsbDriverHint {
  id: string;
  name: string;
  vidHex: string;
  vid: number;
  typicalBoards: string;
  installUrl: string;
  notes: string;
}

export const WINDOWS_USB_DRIVER_HINTS: WindowsUsbDriverHint[] = [
  {
    id: 'espressif',
    name: 'Espressif native USB (CDC / JTAG)',
    vidHex: '0x303A',
    vid: 0x303a,
    typicalBoards: 'ESP32-S3, C3, C6, S2',
    installUrl: 'https://dl.espressif.com/dl/idf-driver/',
    notes: 'Zwykle instaluje się przez Windows Update. Użyj pakietu IDF, gdy COMx nie pojawia się.',
  },
  {
    id: 'cp210x',
    name: 'Silicon Labs CP210x',
    vidHex: '0x10C4',
    vid: 0x10c4,
    typicalBoards: 'DevKit V1, WROOM',
    installUrl: 'https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers',
    notes: 'Oficjalny sterownik VCP — wymagany dla wielu klasycznych DevKitów.',
  },
  {
    id: 'ch340',
    name: 'WCH CH340 / CH9102',
    vidHex: '0x1A86',
    vid: 0x1a86,
    typicalBoards: 'NodeMCU, D1 Mini, klony',
    installUrl: 'https://www.wch-ic.com/downloads/CH341SER_EXE.html',
    notes: 'Instaluj wyłącznie z oficjalnej strony WCH.',
  },
  {
    id: 'ftdi',
    name: 'FTDI FT232',
    vidHex: '0x0403',
    vid: 0x0403,
    typicalBoards: 'M5 / zewnętrzne adaptery USB-UART',
    installUrl: 'https://ftdichip.com/drivers/vcp-drivers/',
    notes: 'Opcjonalny — gdy płytka używa mostka FTDI.',
  },
];

export const WINDOWS_DRIVERS_DOC_URL =
  'https://github.com/mateowoj-cpu/ESP32-App/blob/main/docs/windows-drivers.md';

const TIP_STORAGE_KEY = 'esp32_windows_driver_tip_dismissed';

export function isWindowsDriverTipDismissed(): boolean {
  try {
    return localStorage.getItem(TIP_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissWindowsDriverTip(): void {
  try {
    localStorage.setItem(TIP_STORAGE_KEY, '1');
  } catch {
    // ignore quota / private mode
  }
}

/** Rough OS hint for showing Windows-only copy in the browser. */
export function looksLikeWindowsHost(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /windows/i.test(navigator.userAgent || '') || /win32|win64/i.test(navigator.platform || '');
}
