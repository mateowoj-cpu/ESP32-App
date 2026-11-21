/**
 * Pin programming + peripheral catalog codegen hooks.
 */
import { generateArduinoCppCode, generatePlatformIoIni } from './codeGenerator';
import {
  DEFAULT_API_CONFIG,
  DEFAULT_DISPLAY_CONFIG,
  DEFAULT_SYSTEM_CONFIG,
  PRESET_CYBER_PET_SCREENS,
} from './presets';
import type { DisplayConfig, SystemConfig } from '../types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const baseSystem: SystemConfig = { ...DEFAULT_SYSTEM_CONFIG };

const withHall: SystemConfig = {
  ...baseSystem,
  hallPin: 13,
  customPinFunctions: {
    ...(baseSystem.customPinFunctions || {}),
    13: 'INPUT_HALL',
  },
};

const code = generateArduinoCppCode(
  DEFAULT_DISPLAY_CONFIG,
  withHall,
  DEFAULT_API_CONFIG,
  PRESET_CYBER_PET_SCREENS,
  [],
);

assert(code.includes('#define PIN_HALL_ENABLED 1'), 'hall enabled define');
assert(code.includes('#define PIN_HALL_SENSOR 13'), 'hall pin define');
assert(code.includes('pinMode(PIN_HALL_SENSOR, INPUT_PULLUP)'), 'hall pinMode pullup');
assert(code.includes('digitalRead(PIN_HALL_SENSOR) == LOW'), 'hall active-low read');
assert(code.includes('[A3144]'), 'hall serial tag');

const codeOff = generateArduinoCppCode(
  DEFAULT_DISPLAY_CONFIG,
  baseSystem,
  DEFAULT_API_CONFIG,
  PRESET_CYBER_PET_SCREENS,
  [],
);
assert(codeOff.includes('#define PIN_HALL_ENABLED 0'), 'hall disabled when unset');
assert(codeOff.includes('#define PIN_POT_ADC'), 'pot define present');
assert(!codeOff.includes('PIN_POT_SENSOR'), 'legacy PIN_POT_SENSOR gone');

const withCatalog: SystemConfig = {
  ...baseSystem,
  dhtPin: 4,
  ultrasonicTrigPin: 5,
  ultrasonicEchoPin: 18,
  servoPin: 13,
  relayPin: 26,
  ws2812Pin: 16,
  ds18b20Pin: 15,
  bme280Enabled: true,
  mpu6050Enabled: true,
  l298nIn1Pin: 27,
  l298nIn2Pin: 12,
  l298nEnaPin: 14,
};

const catalogCode = generateArduinoCppCode(
  DEFAULT_DISPLAY_CONFIG,
  withCatalog,
  DEFAULT_API_CONFIG,
  PRESET_CYBER_PET_SCREENS,
  [],
);
assert(catalogCode.includes('#define PIN_DHT_ENABLED 1'), 'dht enabled');
assert(catalogCode.includes('#include <DHT.h>'), 'dht include');
assert(catalogCode.includes('#define PIN_US_ENABLED 1'), 'ultrasonic enabled');
assert(catalogCode.includes('pulseIn(PIN_US_ECHO'), 'ultrasonic pulseIn');
assert(catalogCode.includes('#define PIN_SERVO_ENABLED 1'), 'servo enabled');
assert(catalogCode.includes('#include <ESP32Servo.h>'), 'servo include');
assert(catalogCode.includes('#define PIN_RELAY_ENABLED 1'), 'relay enabled');
assert(catalogCode.includes('#define PIN_WS2812_ENABLED 1'), 'ws2812 enabled');
assert(catalogCode.includes('#define BME280_ENABLED 1'), 'bme280 enabled');
assert(catalogCode.includes('#define MPU6050_ENABLED 1'), 'mpu6050 enabled');
assert(catalogCode.includes('#define PIN_L298N_ENABLED 1'), 'l298n enabled');
assert(catalogCode.includes('#define PIN_DS18_ENABLED 1'), 'ds18 enabled');

const ili9341: DisplayConfig = {
  ...DEFAULT_DISPLAY_CONFIG,
  model: 'ili9341_320x240',
  width: 320,
  height: 240,
  bus: 'spi',
  mosiPin: 23,
  misoPin: 19,
  sckPin: 18,
  csPin: 15,
  dcPin: 2,
  rstPin: 4,
  backlightPin: 21,
};
const tftCode = generateArduinoCppCode(
  ili9341,
  baseSystem,
  DEFAULT_API_CONFIG,
  PRESET_CYBER_PET_SCREENS,
  [],
);
assert(tftCode.includes('#define USE_COLOR_TFT 1'), 'tft flag');
assert(tftCode.includes('Adafruit_ILI9341'), 'ili9341 driver');
assert(tftCode.includes('#define TFT_MOSI 23'), 'tft mosi');
assert(tftCode.includes('#define TFT_CS   15'), 'tft cs');
assert(!tftCode.includes('Adafruit_SSD1306 display('), 'no ssd1306 object on spi');

const pio = generatePlatformIoIni(ili9341, 'esp32', withCatalog);
assert(pio.includes('Adafruit ILI9341'), 'pio ili9341 dep');
assert(pio.includes('DHT sensor library'), 'pio dht dep');
assert(pio.includes('ESP32Servo'), 'pio servo dep');
assert(pio.includes('Adafruit NeoPixel'), 'pio neopixel dep');
assert(pio.includes('Adafruit BME280'), 'pio bme dep');

const st7789: DisplayConfig = {
  ...DEFAULT_DISPLAY_CONFIG,
  model: 'st7789_240x240',
  width: 240,
  height: 240,
  bus: 'spi',
  csPin: 5,
  dcPin: 2,
  rstPin: 4,
  backlightPin: 32,
};
const stCode = generateArduinoCppCode(
  st7789,
  baseSystem,
  DEFAULT_API_CONFIG,
  PRESET_CYBER_PET_SCREENS,
  [],
);
assert(stCode.includes('Adafruit_ST7789'), 'st7789 driver');
assert(DEFAULT_DISPLAY_CONFIG.misoPin === 19, 'default miso pin from popular VSPI');

console.log('pinProgramming.test.ts: OK');
