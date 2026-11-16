/**
 * Single source of truth: root package.json "version".
 * Asserts tauri.conf.json + Cargo.toml match. Optionally asserts a git tag.
 *
 * CLI:
 *   node scripts/ci/assert-app-version.mjs
 *   node scripts/ci/assert-app-version.mjs --github-output
 *   node scripts/ci/assert-app-version.mjs --tag v0.2.10
 *   APP_VERSION_TAG=v0.2.10 node scripts/ci/assert-app-version.mjs --github-output
 *
 * Writes (with --github-output): version, tag, artifact_suffix
 */

import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), "utf8"));
}

function cargoPackageVersion() {
  const toml = readFileSync(join(root, "src-tauri/Cargo.toml"), "utf8");
  // First [package] version = "x.y.z" only (ignore dependency versions).
  const pkg = toml.split(/^\[/m).find((block) => block.startsWith("package]"));
  if (!pkg) throw new Error("Cargo.toml missing [package] section");
  const m = pkg.match(/^version\s*=\s*"([^"]+)"/m);
  if (!m) throw new Error("Cargo.toml [package] missing version");
  return m[1];
}

function normalizeTagInput(raw) {
  const tag = (raw || "").trim();
  // GitHub expressions sometimes stringify false → "false".
  if (!tag || tag === "false" || tag === "null" || tag === "undefined") return "";
  return tag;
}

function parseArgs(argv) {
  const out = {
    githubOutput: false,
    tag: normalizeTagInput(process.env.APP_VERSION_TAG),
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--github-output") out.githubOutput = true;
    else if (argv[i] === "--tag") out.tag = normalizeTagInput(argv[++i] || "");
  }
  return out;
}

/** Accept v1.2.3, v1.2.3-beta, v1.2.3-beta.1, v1.2.3+meta */
function tagMatchesVersion(tag, version) {
  if (!tag) return true;
  const name = tag.startsWith("refs/tags/") ? tag.slice("refs/tags/".length) : tag;
  if (!name.startsWith("v")) {
    throw new Error(`Tag must start with v (got '${name}')`);
  }
  const body = name.slice(1);
  if (body === version) return true;
  if (body.startsWith(`${version}-`) || body.startsWith(`${version}+`)) return true;
  throw new Error(
    `Tag '${name}' does not match package.json version '${version}' (expected v${version} or v${version}-… / v${version}+…)`,
  );
}

export function resolveAppVersion({ tag = "" } = {}) {
  const pkg = readJson("package.json");
  const tauri = readJson("src-tauri/tauri.conf.json");
  const cargo = cargoPackageVersion();
  const version = pkg.version;

  if (!version || typeof version !== "string") {
    throw new Error("package.json missing string version");
  }
  if (tauri.version !== version) {
    throw new Error(
      `Version drift: package.json=${version} tauri.conf.json=${tauri.version}`,
    );
  }
  if (cargo !== version) {
    throw new Error(`Version drift: package.json=${version} Cargo.toml=${cargo}`);
  }

  // package-lock root versions should match when present
  let lock;
  try {
    lock = readJson("package-lock.json");
  } catch (err) {
    if (!(err && err.code === "ENOENT")) throw err;
    lock = null;
  }
  if (lock) {
    if (lock.version && lock.version !== version) {
      throw new Error(
        `Version drift: package.json=${version} package-lock.json=${lock.version}`,
      );
    }
    if (lock.packages?.[""]?.version && lock.packages[""].version !== version) {
      throw new Error(
        `Version drift: package.json=${version} package-lock packages[""]=${lock.packages[""].version}`,
      );
    }
  }

  tagMatchesVersion(tag, version);

  return {
    version,
    tag: tag
      ? tag.startsWith("refs/tags/")
        ? tag.slice("refs/tags/".length)
        : tag
      : `v${version}`,
    artifact_suffix: version,
  };
}

const isDirect = /(?:^|[/\\])assert-app-version\.mjs$/.test(process.argv[1] || "");

if (isDirect) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const meta = resolveAppVersion({ tag: args.tag });
    console.log(`OK: app version ${meta.version} (tag ${meta.tag})`);
    if (args.githubOutput) {
      const out = process.env.GITHUB_OUTPUT;
      if (!out) {
        console.error("GITHUB_OUTPUT is unset; cannot write CI outputs");
        process.exit(2);
      }
      appendFileSync(out, `version=${meta.version}\n`);
      appendFileSync(out, `tag=${meta.tag}\n`);
      appendFileSync(out, `artifact_suffix=${meta.artifact_suffix}\n`);
    }
  } catch (err) {
    console.error(String(err?.message || err));
    process.exit(1);
  }
}
