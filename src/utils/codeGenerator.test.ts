/**
 * P2 C++ generator: single literal encoder + OpenWeatherMap verified TLS.
 * Includes a real g++ compile/run that checks resulting bytes (quote / backslash /
 * newline / control+hex-digit adjacency) and NTP-before-HTTPS for OWM.
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
assert(escapeCppStringLiteral('x\0y') === 'x\\000y', 'nul as fixed-width octal');
assert(
  escapeCppStringLiteral('\u0001A') === '\\001A',
  'SOH + hex digit A must use terminated octal, not \\x01A',
);
assert(!escapeCppStringLiteral('\u0001A').includes('\\x'), 'no unbounded \\x escapes');
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

// --- OpenWeatherMap: HTTPS + setCACert + NTP wait / short retry ---
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
assert(owmSketch.includes('bool fetchWeatherData()'), 'fetchWeatherData returns bool');
assert(owmSketch.includes('WEATHER_RETRY_MS'), 'short weather retry constant');
assert(owmSketch.includes('getLocalTime'), 'NTP/clock check present for OWM TLS');
assert(
  owmSketch.includes('odkładam HTTPS') || owmSketch.includes('Brak synchronizacji NTP'),
  'OWM defers HTTPS when clock unset',
);
assert(
  owmSketch.includes('Czas zsynchronizowany przed HTTPS') ||
    owmSketch.includes('configTzTime(TIMEZONE, NTP_SERVER)'),
  'setup waits / configures NTP before first OWM HTTPS',
);
assert(
  /lastWeatherFetchMillis = .+WEATHER_RETRY_MS/.test(owmSketch),
  'failed fetch schedules short retry, not full interval only',
);

// Non-OWM providers must not pull in secure client / CA / setup NTP wait block for OWM
const meteoSketch = generateArduinoCppCode(
  DEFAULT_DISPLAY_CONFIG,
  DEFAULT_SYSTEM_CONFIG,
  DEFAULT_API_CONFIG,
  PRESET_CYBER_PET_SCREENS,
  [],
);
assert(!meteoSketch.includes('WiFiClientSecure'), 'open-meteo skips WiFiClientSecure');
assert(!meteoSketch.includes('OWM_ROOT_CA'), 'open-meteo skips OWM CA');
assert(
  !meteoSketch.includes('przed HTTPS OpenWeatherMap'),
  'open-meteo skips OWM-specific NTP wait banner',
);

// --- Compile + run: g++ must produce the intended bytes ---
const dir = mkdtempSync(join(tmpdir(), 'esp32-cpp-literal-'));
const cppPath = join(dir, 'literals_byte_test.cpp');
const binPath = join(dir, 'literals_byte_test');
const sohA = '\u0001A'; // must be bytes 0x01, 0x41 — NOT 0x1A
const harness = `// Auto-generated byte probe for escapeCppStringLiteral
#include <cstdio>
#include <cstring>

static const char WIFI_SSID[] = ${cppStringLiteral(trickySsid)};
static const char WIFI_PASSWORD[] = ${cppStringLiteral(trickyPass)};
static const char OTA_PASSWORD[] = ${cppStringLiteral('ota"pass\\word')};
static const char CITY[] = ${cppStringLiteral('Dortmund"City')};
static const char MULTILINE[] = ${cppStringLiteral('line1\nline2\r\nend')};
static const char CTRL_HEX[] = ${cppStringLiteral(sohA)};
static const char NUL_MID[] = ${cppStringLiteral('x\0y')};
static const char OWM_URL[] = ${cppStringLiteral(
  `https://api.openweathermap.org/data/2.5/weather?q=Dortmund&units=metric&appid=secret"key\\value`,
)};

static void dump(const char* label, const char* s, std::size_t n) {
  std::printf("%s:", label);
  for (std::size_t i = 0; i < n; i++) std::printf(" %02x", (unsigned char)s[i]);
  std::printf("\\n");
}

int main() {
  if (std::strlen(CTRL_HEX) != 2) return 11;
  if ((unsigned char)CTRL_HEX[0] != 0x01 || (unsigned char)CTRL_HEX[1] != 0x41) return 12;
  if ((unsigned char)NUL_MID[0] != 'x' || (unsigned char)NUL_MID[1] != 0x00 || (unsigned char)NUL_MID[2] != 'y') return 13;
  if (std::strcmp(WIFI_SSID, ${cppStringLiteral(trickySsid)}) != 0) return 14;
  if (std::strcmp(WIFI_PASSWORD, ${cppStringLiteral(trickyPass)}) != 0) return 15;
  if (std::strcmp(MULTILINE, ${cppStringLiteral('line1\nline2\r\nend')}) != 0) return 16;
  dump("CTRL_HEX", CTRL_HEX, 2);
  dump("NUL_MID", NUL_MID, 3);
  (void)OTA_PASSWORD;
  (void)CITY;
  (void)OWM_URL;
  return 0;
}
`;
writeFileSync(cppPath, harness, 'utf8');

const compile = spawnSync('g++', ['-std=c++17', '-o', binPath, cppPath], {
  encoding: 'utf8',
});
if (compile.status !== 0) {
  rmSync(dir, { recursive: true, force: true });
  throw new Error(
    `g++ compile test failed (status ${compile.status}):\n${compile.stderr || compile.stdout}`,
  );
}

const run = spawnSync(binPath, [], { encoding: 'utf8' });
if (run.status !== 0) {
  rmSync(dir, { recursive: true, force: true });
  throw new Error(
    `g++ byte probe failed (status ${run.status}):\n${run.stderr || run.stdout}\nexpected CTRL_HEX bytes 01 41`,
  );
}
assert(
  (run.stdout || '').includes('CTRL_HEX: 01 41'),
  `expected CTRL_HEX dump 01 41, got: ${run.stdout}`,
);
assert(
  (run.stdout || '').includes('NUL_MID: 78 00 79'),
  `expected NUL_MID dump 78 00 79, got: ${run.stdout}`,
);
rmSync(dir, { recursive: true, force: true });

console.log(
  'codeGenerator.test.ts: OK (octal escapes + byte probe + OWM TLS/NTP retry)',
);
