import assert from "node:assert/strict";
import { resolveAppVersion } from "./assert-app-version.mjs";

const meta = resolveAppVersion();
assert.equal(meta.version, meta.artifact_suffix);
assert.deepEqual(resolveAppVersion({ tag: meta.tag }), meta);
assert.deepEqual(resolveAppVersion({ tag: "refs/tags/" + meta.tag }), meta);
assert.throws(() => resolveAppVersion({ tag: meta.tag + "-beta.1" }), /Expected release tag/);
assert.throws(() => resolveAppVersion({ tag: "v0.0.0-not-this" }), /Expected release tag/);
console.log("OK: application version and stable release tag");
