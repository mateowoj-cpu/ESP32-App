/**
 * Contract checks for BuildResult / FlashPlan shapes used by FlashHelperPanel.
 * Pure logic for discovery/validation lives in Rust (`firmware_build` unit tests).
 */
import type { BuildResult, FlashPlan } from './firmwareBuild';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const usbPlan: FlashPlan = {
  buildId: 'b1',
  imageKind: 'usbFullSet',
  chipFamily: 'esp32',
  segments: [
    { offset: '0x1000', path: '/a/bootloader.bin', role: 'bootloader' },
    { offset: '0x8000', path: '/a/partitions.bin', role: 'partition-table' },
    { offset: '0x10000', path: '/a/firmware.bin', role: 'app' },
  ],
  otaPath: '/a/firmware.bin',
  metadataTrusted: true,
  artifactDir: '/a',
};

const otaOnly: BuildResult = {
  ok: true,
  tool: 'arduino-cli',
  firmwarePath: '/a/sketch.ino.bin',
  message: 'OTA only',
  buildId: 'b2',
  imageKind: 'otaApp',
  chipFamily: 'esp32c3',
  flashPlan: {
    buildId: 'b2',
    imageKind: 'otaApp',
    chipFamily: 'esp32c3',
    segments: [],
    otaPath: '/a/sketch.ino.bin',
    metadataTrusted: false,
    artifactDir: '/a',
  },
  autoFlashAllowed: false,
};

assert(usbPlan.metadataTrusted && usbPlan.imageKind === 'usbFullSet', 'usb plan trusted');
assert(!otaOnly.autoFlashAllowed, 'ota-only must block auto USB flash');
assert(otaOnly.flashPlan?.otaPath === otaOnly.firmwarePath, 'ota path aligns with firmwarePath');

const appSeg = usbPlan.segments.find(s => s.role === 'app');
assert(appSeg?.offset === '0x10000', 'app segment not at bootloader 0x1000');

console.log('firmwareBuild.test.ts: ok');
