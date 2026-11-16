#!/usr/bin/env node
/**
 * Fail fast if Windows MSI/WiX packaging config would hit LGHT0311
 * (non-ASCII product strings under codepage 1252) or would build pl-PL MSI.
 *
 * Paths are relative to the repo root. Tauri resolves conf paths from src-tauri/.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const confPath = join(repoRoot, "src-tauri/tauri.conf.json");
const windowsOverlayPath = join(repoRoot, "src-tauri/tauri.windows.json");

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function deepMerge(a, b) {
  if (Array.isArray(b)) return b.slice();
  if (b && typeof b === "object") {
    const out = { ...(a && typeof a === "object" && !Array.isArray(a) ? a : {}) };
    for (const [k, v] of Object.entries(b)) {
      out[k] = deepMerge(out[k], v);
    }
    return out;
  }
  return b === undefined ? a : b;
}

function wixLanguages(language) {
  if (language == null) return ["en-US"];
  if (typeof language === "string") return [language];
  if (Array.isArray(language)) return language;
  if (typeof language === "object") return Object.keys(language);
  throw new Error(`Unexpected wix.language shape: ${JSON.stringify(language)}`);
}

function assertAscii(label, value) {
  if (typeof value !== "string") return;
  const bad = [...value].filter((ch) => ch.charCodeAt(0) > 127);
  if (bad.length) {
    throw new Error(
      `${label} contains non-ASCII (${[...new Set(bad)].join(" ")}): ${JSON.stringify(value)}`,
    );
  }
}

const base = loadJson(confPath);
const overlay = existsSync(windowsOverlayPath) ? loadJson(windowsOverlayPath) : {};
const merged = deepMerge(base, overlay);

const bundle = merged.bundle ?? {};
const wix = bundle.windows?.wix ?? {};
const langs = wixLanguages(wix.language);

if (langs.length !== 1 || langs[0] !== "en-US") {
  throw new Error(
    `WiX languages must be exactly ["en-US"] for MSI codepage 1252 safety; got ${JSON.stringify(langs)}`,
  );
}

for (const key of [
  "publisher",
  "copyright",
  "shortDescription",
  "longDescription",
  "homepage",
]) {
  assertAscii(`bundle.${key}`, bundle[key]);
}
assertAscii("productName", merged.productName);

for (const fa of bundle.fileAssociations ?? []) {
  assertAscii(`fileAssociation.name(${fa?.ext})`, fa?.name);
  assertAscii(`fileAssociation.description(${fa?.ext})`, fa?.description);
}

const nsis = bundle.windows?.nsis ?? {};
const custom = nsis.customLanguageFiles ?? {};
if ((nsis.languages ?? []).includes("Polish")) {
  const rel = custom.Polish;
  if (!rel) {
    throw new Error(
      'NSIS languages include Polish but bundle.windows.nsis.customLanguageFiles.Polish is missing',
    );
  }
  // Tauri CLI sets cwd to src-tauri when loading config; paths are relative to that dir.
  const abs = join(repoRoot, "src-tauri", rel);
  if (!existsSync(abs)) {
    throw new Error(`NSIS Polish custom language file missing: ${abs} (from ${rel})`);
  }
}

console.log("OK: MSI WiX en-US only + ASCII installer metadata");
console.log(`  conf: ${confPath}`);
if (existsSync(windowsOverlayPath)) {
  console.log(`  windows overlay: ${windowsOverlayPath}`);
}
console.log(`  wix.language: ${JSON.stringify(langs)}`);
if ((nsis.languages ?? []).includes("Polish")) {
  console.log(`  nsis Polish.nsh: src-tauri/${custom.Polish}`);
}
