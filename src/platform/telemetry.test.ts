import assert from 'node:assert/strict';
import { buildTelemetryPayload } from './telemetry';

const payload = buildTelemetryPayload({ name: 'build_result', ok: true });
assert.equal(payload.event, 'build_result');
assert.equal(payload.ok, true);
assert.equal(payload.v, '0.2.8');
assert.ok(typeof payload.os === 'string' && payload.os.length > 0);
assert.ok(typeof payload.ts === 'number');

// Ensure no accidental PII fields
const keys = Object.keys(payload).sort();
assert.deepEqual(keys, ['event', 'ok', 'os', 'ts', 'v']);

const minimal = buildTelemetryPayload({ name: 'app_open' });
assert.equal('ok' in minimal, false);

console.log('telemetry.test.ts: OK');
