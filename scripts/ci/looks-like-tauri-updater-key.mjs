/**
 * Shared minisign / tauri-signer private-key format gate (no secrets logged).
 * Mirrors scripts/windows/Test-TauriUpdaterKey.ps1.
 *
 * CLI (reads TAURI_SIGNING_PRIVATE_KEY from env, never prints it):
 *   node scripts/ci/looks-like-tauri-updater-key.mjs
 *   node scripts/ci/looks-like-tauri-updater-key.mjs --github-output
 *
 * Exit 0 when format looks valid; exit 1 otherwise.
 * With --github-output, always writes signed=true|false to GITHUB_OUTPUT and exits 0
 * so workflow steps can branch without failing the job.
 */

import { appendFileSync } from "node:fs";

export function looksLikeTauriUpdaterKey(raw) {
  if (raw == null || String(raw).trim() === "") return false;
  let content = String(raw).trim().replace(/\\n/g, "\n").replace(/\\r/g, "");
  return /^untrusted comment:/m.test(content);
}

const isDirect = /(?:^|[/\\])looks-like-tauri-updater-key\.mjs$/.test(
  process.argv[1] || "",
);

if (isDirect) {
  const githubOutput = process.argv.includes("--github-output");
  const key = process.env.TAURI_SIGNING_PRIVATE_KEY ?? "";
  const valid = looksLikeTauriUpdaterKey(key);

  if (githubOutput) {
    const out = process.env.GITHUB_OUTPUT;
    if (!out) {
      console.error("GITHUB_OUTPUT is unset; cannot write CI outputs");
      process.exit(2);
    }
    appendFileSync(out, `signed=${valid ? "true" : "false"}\n`);
    if (valid) {
      console.log("Updater key format OK — signed overlay path.");
    } else {
      console.log(
        "Updater key missing/invalid — UNSIGNED path (no TAURI_SIGNING_* in build env).",
      );
    }
    process.exit(0);
  }

  if (valid) {
    console.log("Updater key format OK.");
    process.exit(0);
  }
  console.log("Updater key missing/invalid.");
  process.exit(1);
}
