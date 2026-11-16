/**
 * Smoke tests for assert-app-version (no network).
 * Run: node scripts/ci/assert-app-version.test.mjs
 */

import { resolveAppVersion } from "./assert-app-version.mjs";
import { looksLikeTauriUpdaterKey } from "./looks-like-tauri-updater-key.mjs";

let failed = 0;

function check(label, cond) {
  if (!cond) {
    console.error("FAIL", label);
    failed++;
  } else {
    console.log("OK", label);
  }
}

const meta = resolveAppVersion();
check("version non-empty", Boolean(meta.version));
check("artifact_suffix == version", meta.artifact_suffix === meta.version);

try {
  resolveAppVersion({ tag: `v${meta.version}` });
  check("exact tag ok", true);
} catch {
  check("exact tag ok", false);
}

try {
  resolveAppVersion({ tag: `v${meta.version}-beta.1` });
  check("prerelease tag ok", true);
} catch {
  check("prerelease tag ok", false);
}

try {
  resolveAppVersion({ tag: "v0.0.0-not-this" });
  check("mismatched tag rejected", false);
} catch {
  check("mismatched tag rejected", true);
}

check("empty key", looksLikeTauriUpdaterKey("") === false);
check("placeholder key", looksLikeTauriUpdaterKey("placeholder") === false);
check(
  "minisign key",
  looksLikeTauriUpdaterKey(
    "untrusted comment: minisign encrypted secret key\nRWRCSwAAAAB",
  ) === true,
);

if (failed) {
  console.error(`assert-app-version.test: ${failed} failure(s)`);
  process.exit(1);
}
console.log("All assert-app-version / updater-key checks passed");
