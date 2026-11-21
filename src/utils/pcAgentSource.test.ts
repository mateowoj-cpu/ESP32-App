import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wrapPcAgentDownload } from './codeGenerator';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const canonicalPath = path.join(root, 'tools/pc-agent/esp32_pc_agent.py');
const canonical = readFileSync(canonicalPath, 'utf8');

assert.match(canonical, /def collect_stats/);
assert.match(canonical, /def post_stats/);
assert.match(canonical, /--once/);
assert.match(canonical, /\/api\/pc-stats/);
assert.match(canonical, /argparse/);

const script = wrapPcAgentDownload(canonical, '10.0.0.42', 9090);
assert.match(script, /tools\/pc-agent\/esp32_pc_agent\.py/);
assert.match(script, /--host 10\.0\.0\.42 --port 9090/);
assert.ok(script.includes(canonical.trim()), 'download embeds full canonical source');
assert.doesNotMatch(script, /ESP32 Display Studio — PC Agent \(wygenerowany skrypt\)/);

console.log('pcAgentSource.test.ts: ok');
