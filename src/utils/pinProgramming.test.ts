/**
 * Lightweight checks for hall pin programming + codegen hooks.
 */
import { generateArduinoCppCode } from './codeGenerator';
import {
  DEFAULT_API_CONFIG,
  DEFAULT_DISPLAY_CONFIG,
  DEFAULT_SYSTEM_CONFIG,
  PRESET_CYBER_PET_SCREENS,
} from './presets';
import type { SystemConfig } from '../types';

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

console.log('pinProgramming.test.ts: OK');
