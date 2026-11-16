/**
 * Mirrors scripts/windows/Test-TauriUpdaterKey.ps1 format gate (no secrets).
 * Run: node scripts/windows/assert-updater-key-format.test.mjs
 */
import { looksLikeTauriUpdaterKey } from "../ci/looks-like-tauri-updater-key.mjs";

const cases = [
  ["", false],
  ["placeholder", false],
  ["RWRCSwAAAAB", false],
  ["untrusted comment: minisign encrypted secret key\nRWRCSwAAAAB", true],
  ["untrusted comment: x\\nRWRCSwAAAAB", true],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = looksLikeTauriUpdaterKey(input);
  if (got !== expected) {
    console.error("FAIL", JSON.stringify(input), "expected", expected, "got", got);
    failed++;
  }
}

if (failed) {
  console.error(`assert-updater-key-format: ${failed} failure(s)`);
  process.exit(1);
}
console.log("OK: updater key format gate");
