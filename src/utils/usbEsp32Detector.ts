import { ConnectedEsp32Info, Esp32Family } from '../types';

export interface BoardPreset {
  id: string;
  name: string;
  family: Esp32Family;
  model: string;
  vid: string;
  pid: string;
  cores: number;
  arch: string;
  clockMhz: number;
  flashMb: number;
  psramMb: number;
  touchController: 'none' | 'cst816s' | 'ft6236' | 'xpt2046' | 'gt911';
  touchSda: number;
  touchScl: number;
  touchInt: number;
  touchRst: number;
  features: string[];
}

export const POPULAR_ESP32_BOARDS: BoardPreset[] = [
  {
    id: 'esp32_devkit_v1',
    name: 'ESP32 DevKit V1 (ESP-WROOM-32)',
    family: 'ESP32',
    model: 'ESP32-D0WDQ6-V3',
    vid: '0x10C4',
    pid: '0xEA60',
    cores: 2,
    arch: 'Xtensa Dual-Core 32-bit LX6',
    clockMhz: 240,
    flashMb: 4,
    psramMb: 0,
    touchController: 'xpt2046',
    touchSda: 21,
    touchScl: 22,
    touchInt: 33,
    touchRst: 25,
    features: ['Wi-Fi 802.11 b/g/n', 'Bluetooth 4.2 BR/EDR & BLE', '12-bit ADC', 'PWM 16ch'],
  },
  {
    id: 'esp32_s3_tdisplay_touch',
    name: 'LilyGO T-Display-S3 Touch (CST816S)',
    family: 'ESP32-S3',
    model: 'ESP32-S3-WROOM-1-N16R8',
    vid: '0x303A',
    pid: '0x1001',
    cores: 2,
    arch: 'Xtensa Dual-Core 32-bit LX7 + Vector AI',
    clockMhz: 240,
    flashMb: 16,
    psramMb: 8,
    touchController: 'cst816s',
    touchSda: 18,
    touchScl: 17,
    touchInt: 21,
    touchRst: 16,
    features: ['Wbudowany dotyk pojemnościowy CST816S', 'USB OTG / Native JTAG', 'Wi-Fi 4 + BLE 5.0 Mesh', 'Instrukcje AI/DSP'],
  },
  {
    id: 'waveshare_esp32_s3_touch_round',
    name: 'Waveshare ESP32-S3 Round 1.28" (GC9A01 + CST816S)',
    family: 'ESP32-S3',
    model: 'ESP32-S3R8 (Round LCD)',
    vid: '0x303A',
    pid: '0x1001',
    cores: 2,
    arch: 'Xtensa Dual-Core 32-bit LX7',
    clockMhz: 240,
    flashMb: 16,
    psramMb: 8,
    touchController: 'cst816s',
    touchSda: 6,
    touchScl: 7,
    touchInt: 5,
    touchRst: 13,
    features: ['Ekran okrągły GC9A01', 'Dotyk pojemnościowy CST816S', 'Wbudowany żyroskop/akcelerometr', 'Slot kart MicroSD'],
  },
  {
    id: 'm5stack_core2',
    name: 'M5Stack Core2 / AWS (FT6336U)',
    family: 'ESP32',
    model: 'ESP32-D0WDQ6-V3',
    vid: '0x0403',
    pid: '0x6001',
    cores: 2,
    arch: 'Xtensa Dual-Core LX6',
    clockMhz: 240,
    flashMb: 16,
    psramMb: 8,
    touchController: 'ft6236',
    touchSda: 21,
    touchScl: 22,
    touchInt: 39,
    touchRst: 0,
    features: ['Dotyk pojemnościowy FT6336U', 'Wbudowany głośnik I2S', 'Układ zasilania AXP192', 'RTC BM8563'],
  },
  {
    id: 'esp32_c3_supermini',
    name: 'ESP32-C3 SuperMini (RISC-V)',
    family: 'ESP32-C3',
    model: 'ESP32-C3FN4 (RISC-V)',
    vid: '0x303A',
    pid: '0x1002',
    cores: 1,
    arch: '32-bit RISC-V Single-Core',
    clockMhz: 160,
    flashMb: 4,
    psramMb: 0,
    touchController: 'cst816s',
    touchSda: 8,
    touchScl: 9,
    touchInt: 3,
    touchRst: 2,
    features: ['Ultra-niski pobór prądu', 'Architektura RISC-V', 'Wi-Fi 4 + BLE 5.0 Long-Range'],
  },
  {
    id: 'esp32_ili9341_xpt2046',
    name: 'ESP32 + Ekran 2.8" SPI (ILI9341 + XPT2046)',
    family: 'ESP32',
    model: 'ESP32 NodeMCU (CH340)',
    vid: '0x1A86',
    pid: '0x7523',
    cores: 2,
    arch: 'Xtensa Dual-Core LX6',
    clockMhz: 240,
    flashMb: 4,
    psramMb: 0,
    touchController: 'xpt2046',
    touchSda: 23,
    touchScl: 18,
    touchInt: 36,
    touchRst: 4,
    features: ['Oporowy panel dotykowy XPT2046 SPI', 'Duży ekran 320x240 ILI9341', 'Konwerter USB-UART CH340'],
  },
];

/**
 * Identify ESP32 family and characteristics based on USB VID and PID
 */
export function identifyEsp32FromUsbVidPid(vid: number | string, pid: number | string): ConnectedEsp32Info {
  const vidHex = typeof vid === 'number' ? `0x${vid.toString(16).toUpperCase().padStart(4, '0')}` : String(vid).toUpperCase();
  const pidHex = typeof pid === 'number' ? `0x${pid.toString(16).toUpperCase().padStart(4, '0')}` : String(pid).toUpperCase();

  // Match against known Espressif native USB
  if (vidHex === '0x303A') {
    if (pidHex === '0x1001') {
      return {
        connected: true,
        usbVendorId: vidHex,
        usbProductId: pidHex,
        chipFamily: 'ESP32-S3',
        chipModel: 'ESP32-S3 (Native USB / JTAG)',
        coreCount: 2,
        architecture: 'Xtensa Dual-Core 32-bit LX7 z instrukcjami wektorowymi AI',
        maxCpuClockMhz: 240,
        flashSizeMb: 16,
        psramSizeMb: 8,
        macAddress: '78:E3:6D:A4:B2:1C',
        baudRate: 115200,
        features: ['Wbudowany kontroler USB OTG', 'Wi-Fi 802.11 b/g/n', 'Bluetooth 5.0 BLE & Mesh', 'Akceleracja AI / DSP', 'Dotyk pojemnościowy do 14 pinów'],
        rawBootLog: `ESP-ROM:esp32s3-20210327\nBuild:Mar 27 2021\nrst:0x1 (POWERON),boot:0x2b (SPI_FAST_FLASH_BOOT)\nSPIWP:0xee\nmode:DIO, clock div:1\nload:0x3fce3808,len:0x44c\nload:0x403c9700,len:0xbe4\nentry 0x403c98d4\nI (24) boot: Chip: ESP32-S3 (QFN56) rev.0, Flash: 16MB, PSRAM: 8MB\n[ESP32 Display Studio] Gotowy do pracy!`,
      };
    } else if (pidHex === '0x1002') {
      return {
        connected: true,
        usbVendorId: vidHex,
        usbProductId: pidHex,
        chipFamily: 'ESP32-C3',
        chipModel: 'ESP32-C3 (RISC-V USB Serial)',
        coreCount: 1,
        architecture: '32-bit RISC-V RV32IMC',
        maxCpuClockMhz: 160,
        flashSizeMb: 4,
        psramSizeMb: 0,
        macAddress: '54:43:B2:8F:C0:E1',
        baudRate: 115200,
        features: ['Nowoczesny rdzeń open-source RISC-V', 'Wi-Fi 4 + BLE 5.0', 'Niski pobór energii (Ultra-Low Power)', 'Wbudowany konwerter USB JTAG/Serial'],
        rawBootLog: `ESP-ROM:esp32c3-api1-20210207\nBuild:Feb  7 2021\nrst:0x1 (POWERON),boot:0xc (SPI_FAST_FLASH_BOOT)\nSPIWP:0xee\nmode:DIO, clock div:1\nload:0x3fcd6100,len:0x1b4\nload:0x403ce000,len:0x6b0\nentry 0x403ce000\nI (22) boot: Chip: ESP32-C3 (QFN32) rev.3, Flash: 4MB\n[ESP32 Display Studio] Gotowy do pracy!`,
      };
    } else if (pidHex === '0x1003') {
      return {
        connected: true,
        usbVendorId: vidHex,
        usbProductId: pidHex,
        chipFamily: 'ESP32-C6',
        chipModel: 'ESP32-C6 (Wi-Fi 6 + Thread + Zigbee)',
        coreCount: 1,
        architecture: '32-bit RISC-V High-Performance + Low-Power Core',
        maxCpuClockMhz: 160,
        flashSizeMb: 8,
        psramSizeMb: 0,
        macAddress: '68:B6:B3:32:1A:F4',
        baudRate: 115200,
        features: ['Wi-Fi 6 (802.11ax)', 'Bluetooth 5.3 Low Energy', 'IEEE 802.15.4 (Zigbee 3.0 & Thread)', 'Wsparcie protokołu Smart Home Matter'],
        rawBootLog: `ESP-ROM:esp32c6-20220919\nBuild:Sep 19 2022\nrst:0x1 (POWERON),boot:0xc\nChip: ESP32-C6 (QFN40) rev.0, Flash: 8MB\n[ESP32 Display Studio] Wi-Fi 6 + Matter gotowy!`,
      };
    } else if (pidHex === '0x0002') {
      return {
        connected: true,
        usbVendorId: vidHex,
        usbProductId: pidHex,
        chipFamily: 'ESP32-S2',
        chipModel: 'ESP32-S2 (Native USB)',
        coreCount: 1,
        architecture: 'Xtensa Single-Core 32-bit LX7',
        maxCpuClockMhz: 240,
        flashSizeMb: 4,
        psramSizeMb: 2,
        macAddress: '70:04:1D:55:E8:90',
        baudRate: 115200,
        features: ['USB On-The-Go (OTG 1.1)', 'Wi-Fi 802.11 b/g/n', 'Pojemnościowy dotyk 14x GPIO', 'Interfejs LCD 8-bit równoległy'],
        rawBootLog: `ESP-ROM:esp32s2-rc4-20191025\nBuild:Oct 25 2019\nrst:0x1 (POWERON),boot:0x8 (SPI_FAST_FLASH_BOOT)\nChip: ESP32-S2 rev.0, Flash: 4MB\n[ESP32 Display Studio] Gotowy!`,
      };
    }
  }

  // Silicon Labs CP2102/CP2104
  if (vidHex === '0x10C4') {
    return {
      connected: true,
      usbVendorId: vidHex,
      usbProductId: pidHex,
      chipFamily: 'ESP32',
      chipModel: 'ESP32 WROOM / DevKit V1 (Silicon Labs CP210x)',
      coreCount: 2,
      architecture: 'Xtensa Dual-Core 32-bit LX6',
      maxCpuClockMhz: 240,
      flashSizeMb: 4,
      psramSizeMb: 0,
      macAddress: '24:0A:C4:58:3B:A0',
      baudRate: 115200,
      features: ['Dwurdzeniowy procesor 240MHz', 'Wi-Fi 802.11 b/g/n', 'Bluetooth Classic 4.2 + BLE', '10x pojemnościowe piny dotykowe Touch0-Touch9', 'Sprzętowe I2C, SPI, UART, PWM'],
      rawBootLog: `rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)\nconfigsip: 0, SPIWP:0xee\nclk_drv:0x00,q_drv:0x00,d_drv:0x00,cs0_drv:0x00,hd_drv:0x00,wp_drv:0x00\nmode:DIO, clock div:1\nload:0x3fff0030,len:1184\nload:0x40078000,len:13824\nho 0 tail 12 room 4\nload:0x40080400,len:3880\nentry 0x40080640\nI (45) boot: Chip: ESP32-D0WD-V3 (revision 3), Flash: 4MB\n[ESP32 Display Studio] Uruchamianie...`,
    };
  }

  // WCH CH340 / CH9102
  if (vidHex === '0x1A86') {
    return {
      connected: true,
      usbVendorId: vidHex,
      usbProductId: pidHex,
      chipFamily: 'ESP32',
      chipModel: 'ESP32 NodeMCU / D1 Mini (WCH CH340 / CH9102)',
      coreCount: 2,
      architecture: 'Xtensa Dual-Core 32-bit LX6',
      maxCpuClockMhz: 240,
      flashSizeMb: 4,
      psramSizeMb: 0,
      macAddress: 'A4:CF:12:89:D4:50',
      baudRate: 115200,
      features: ['Popularny moduł NodeMCU ESP32', 'Wi-Fi + BLE', 'Obsługa ekranów I2C OLED SSD1306 i LCD SPI'],
      rawBootLog: `rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)\nmode:DIO, clock div:1\nload:0x3fff0030,len:1184\nload:0x40078000,len:13824\nentry 0x40080640\nI (42) boot: ESP32 Chip Revision 1, Flash: 4MB\n[ESP32 Display Studio] Uruchamianie...`,
    };
  }

  // Fallback generic ESP32
  return {
    connected: true,
    usbVendorId: vidHex,
    usbProductId: pidHex,
    chipFamily: 'ESP32',
    chipModel: `ESP32 Urządzenie USB (${vidHex}:${pidHex})`,
    coreCount: 2,
    architecture: 'Xtensa Dual-Core 32-bit',
    maxCpuClockMhz: 240,
    flashSizeMb: 4,
    psramSizeMb: 0,
    macAddress: '3C:71:BF:10:20:30',
    baudRate: 115200,
    features: ['Wi-Fi 802.11 b/g/n', 'Bluetooth / BLE', 'GPIO, ADC, DAC, I2C, SPI'],
    rawBootLog: `rst:0x1 (POWERON_RESET),boot:0x13\nChip: Generic ESP32\n[ESP32 Display Studio] Połączono przez port USB Serial`,
  };
}
