/**
 * P2 C++ generator: single literal encoder + OpenWeatherMap verified TLS.
 * Includes a real g++ syntax compile of generated string literals (quote / backslash / newline).
 */
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  cppStringLiteral,
  escapeCppStringLiteral,
  generateArduinoCppCode,
  OPENWEATHERMAP_ROOT_CA_PEM,
} from './codeGenerator';
import {
  DEFAULT_API_CONFIG,
  DEFAULT_DISPLAY_CONFIG,
  DEFAULT_SYSTEM_CONFIG,
  PRESET_CYBER_PET_SCREENS,
} from './presets';
import type { ApiIntegrationsConfig, SystemConfig } from '../types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// --- Unit: escapeCppStringLiteral ---
assert(escapeCppStringLiteral('plain') === 'plain', 'plain passthrough');
assert(escapeCppStringLiteral('say "hi"') === 'say \\"hi\\"', 'quote escape');
assert(escapeCppStringLiteral('a\\b') === 'a\\\\b', 'backslash escape');
assert(escapeCppStringLiteral('line1\nline2') === 'line1\\nline2', 'newline escape');
assert(escapeCppStringLiteral('a\r\nb\t') === 'a\\r\\nb\\t', 'crlf + tab');
assert(escapeCppStringLiteral('x\0y') === 'x\\x00y', 'nul as hex');
assert(cppStringLiteral('a"b\\c\nd') === '"a\\"b\\\\c\\nd"', 'cppStringLiteral wrapper');

// Combined specials used as Wi-Fi / password payloads
const trickySsid = 'Net"work\\SSID';
const trickyPass = 'p@ss"word\\\nmore';
assert(
  escapeCppStringLiteral(trickySsid) === 'Net\\"work\\\\SSID',
  'ssid combined quote+backslash',
);
assert(
  escapeCppStringLiteral(trickyPass) === 'p@ss\\"word\\\\\\nmore',
  'password quote+backslash+newline',
);

// --- Generated sketch embeds encoder output ---
const systemEscaped: SystemConfig = {
  ...DEFAULT_SYSTEM_CONFIG,
  wifiSsid: trickySsid,
  wifiPassword: trickyPass,
  otaPassword: 'ota"pass\\word',
  mdnsName: 'host"name',
  ntpServer: 'ntp.example.com',
  timezone: 'CET-1CEST,M3.5.0,M10.5.0/3',
  bluetoothDeviceName: 'BT"Device\\Name',
};

const sketch = generateArduinoCppCode(
  DEFAULT_DISPLAY_CONFIG,
  systemEscaped,
  DEFAULT_API_CONFIG,
  PRESET_CYBER_PET_SCREENS,
  [],
);

assert(sketch.includes(`WIFI_SSID     = ${cppStringLiteral(trickySsid)};`), 'SSID uses encoder');
assert(
  sketch.includes(`WIFI_PASSWORD = ${cppStringLiteral(trickyPass)};`),
  'password uses encoder',
);
assert(
  sketch.includes(`OTA_PASSWORD  ${cppStringLiteral('ota"pass\\word')}`),
  'OTA password uses encoder',
);
assert(
  sketch.includes(`BT_DEVICE_NAME           ${cppStringLiteral('BT"Device\\Name')}`),
  'BT name uses encoder',
);
assert(!sketch.includes('WIFI_SSID     = "Net"work'), 'raw unescaped quote must not appear in SSID');

// --- OpenWeatherMap: HTTPS + setCACert, never setInsecure / plaintext http API ---
const apiOwm: ApiIntegrationsConfig = {
  ...DEFAULT_API_CONFIG,
  weather: {
    ...DEFAULT_API_CONFIG.weather,
    provider: 'openweathermap',
    city: 'Dortmund"City',
    apiKey: 'secret"key\\value',
  },
};

const owmSketch = generateArduinoCppCode(
  DEFAULT_DISPLAY_CONFIG,
  DEFAULT_SYSTEM_CONFIG,
  apiOwm,
  PRESET_CYBER_PET_SCREENS,
  [],
);

assert(owmSketch.includes('#include <WiFiClientSecure.h>'), 'WiFiClientSecure include');
assert(owmSketch.includes('setCACert(OWM_ROOT_CA)'), 'setCACert used');
assert(owmSketch.includes('WiFiClientSecure secureClient'), 'secure client instance');
assert(owmSketch.includes('https://api.openweathermap.org/'), 'HTTPS OpenWeatherMap URL');
assert(!owmSketch.includes('http://api.openweathermap.org/'), 'no plaintext OWM URL');
assert(!/\.setInsecure\s*\(/.test(owmSketch), 'must not disable TLS verification');
assert(owmSketch.includes('BEGIN CERTIFICATE'), 'root CA PEM embedded');
assert(
  owmSketch.includes(OPENWEATHERMAP_ROOT_CA_PEM.split('\n')[1]!),
  'Sectigo R46 body present',
);
assert(
  owmSketch.includes(escapeCppStringLiteral('secret"key\\value')),
  'API key escaped in URL literal',
);
assert(
  owmSketch.includes(cppStringLiteral(apiOwm.weather.city)),
  'city printf uses encoder',
);

// Non-OWM providers must not pull in secure client / CA
const meteoSketch = generateArduinoCppCode(
  DEFAULT_DISPLAY_CONFIG,
  DEFAULT_SYSTEM_CONFIG,
  DEFAULT_API_CONFIG,
  PRESET_CYBER_PET_SCREENS,
  [],
);
assert(!meteoSketch.includes('WiFiClientSecure'), 'open-meteo skips WiFiClientSecure');
assert(!meteoSketch.includes('OWM_ROOT_CA'), 'open-meteo skips OWM CA');

// --- Compile test: g++ must accept the encoded literals as C++ string literals ---
const dir = mkdtempSync(join(tmpdir(), 'esp32-cpp-literal-'));
const cppPath = join(dir, 'literals_compile_test.cpp');
const harness = `// Auto-generated compile probe for escapeCppStringLiteral
static const char* WIFI_SSID = ${cppStringLiteral(trickySsid)};
static const char* WIFI_PASSWORD = ${cppStringLiteral(trickyPass)};
static const char* OTA_PASSWORD = ${cppStringLiteral('ota"pass\\word')};
static const char* CITY = ${cppStringLiteral('Dortmund"City')};
static const char* MULTILINE = ${cppStringLiteral('line1\nline2\r\nend')};
static const char* OWM_URL = ${cppStringLiteral(
  `https://api.openweathermap.org/data/2.5/weather?q=Dortmund&units=metric&appid=secret"key\\value`,
)};

int main() {
  (void)WIFI_SSID;
  (void)WIFI_PASSWORD;
  (void)OTA_PASSWORD;
  (void)CITY;
  (void)MULTILINE;
  (void)OWM_URL;
  return 0;
}
`;
writeFileSync(cppPath, harness, 'utf8');

const compile = spawnSync('g++', ['-std=c++17', '-fsyntax-only', cppPath], {
  encoding: 'utf8',
});
if (compile.status !== 0) {
  rmSync(dir, { recursive: true, force: true });
  throw new Error(
    `g++ compile test failed (status ${compile.status}):\n${compile.stderr || compile.stdout}`,
  );
}
rmSync(dir, { recursive: true, force: true });

console.log('codeGenerator.test.ts: OK (escape + OWM TLS + g++ quote/backslash/newline)');
