import assert from 'node:assert/strict';
import { shouldUseNativeHttpFetch } from './netFetch';

assert.equal(
  shouldUseNativeHttpFetch('http://homeassistant.local:8123/api/...'),
  true,
  'plain HTTP custom weather uses native path',
);
assert.equal(
  shouldUseNativeHttpFetch('https://api.open-meteo.com/v1/forecast'),
  false,
  'HTTPS stays on WebView fetch',
);
assert.equal(shouldUseNativeHttpFetch('not a url'), false);

console.log('netFetch.test.ts: OK');
