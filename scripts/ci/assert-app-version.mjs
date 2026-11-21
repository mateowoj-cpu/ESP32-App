import { appendFileSync, readFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

export function resolveAppVersion({ tag = "" } = {}) {
  const { version } = readJson("../../package.json");
  const lock = readJson("../../package-lock.json");
  const tauri = readJson("../../src-tauri/tauri.conf.json");
  if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error("package.json must carry a stable SemVer version");
  }
  if (lock.version !== version || lock.packages?.[""]?.version !== version) {
    throw new Error("package-lock.json version does not match package.json");
  }
  if (tauri.version !== "../package.json") {
    throw new Error("Tauri must resolve the application version from ../package.json");
  }
  const expectedTag = "v" + version;
  if (tag && tag.replace(/^refs\/tags\//, "") !== expectedTag) {
    throw new Error("Expected release tag " + expectedTag + ", received " + tag);
  }
  return { version, tag: expectedTag, artifact_suffix: version };
}

if (/(?:^|[/\\])assert-app-version\.mjs$/.test(process.argv[1] || "")) {
  const argv = process.argv.slice(2);
  const index = argv.indexOf("--tag");
  try {
    if (index !== -1 && !argv[index + 1]) throw new Error("--tag requires a value");
    const meta = resolveAppVersion({
      tag: index === -1 ? process.env.APP_VERSION_TAG : argv[index + 1],
    });
    console.log("OK: app version " + meta.version + " (tag " + meta.tag + ")");
    if (argv.includes("--github-output")) {
      if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is unset");
      for (const [key, value] of Object.entries(meta)) {
        appendFileSync(process.env.GITHUB_OUTPUT, key + "=" + value + "\n");
      }
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
