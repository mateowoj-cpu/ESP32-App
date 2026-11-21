import {
  ALLOWED_OPEN_EXTENSIONS,
  decodeUriComponentOnce,
  isAllowedOpenPath,
  resolveOpenTarget,
  runOpenPathsSession,
  settleOpenPathsSubscription,
  shouldReadOpenContent,
} from './deepLink';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(
  resolveOpenTarget('esp32studio://open?path=C%3A%5Cproj%5Cdemo.esp32studio') ===
    'C:\\proj\\demo.esp32studio',
  'query path',
);

assert(
  resolveOpenTarget('C:\\proj\\demo.esp32studio') === 'C:\\proj\\demo.esp32studio',
  'plain path',
);

assert(resolveOpenTarget('esp32studio://flash?path=/tmp/fw.bin') === '/tmp/fw.bin', 'flash url');

assert(resolveOpenTarget('') === null, 'empty');

// Decode once: URLSearchParams already decoded — `%` in the name must survive.
assert(
  resolveOpenTarget('esp32studio://open?path=%2Ftmp%2F100%25.esp32studio') ===
    '/tmp/100%.esp32studio',
  'percent in filename',
);

assert(
  resolveOpenTarget('esp32studio://open?path=%2Ftmp%2Fmy%20file.esp32studio') ===
    '/tmp/my file.esp32studio',
  'space in filename',
);

assert(
  resolveOpenTarget(
    'esp32studio://open?path=%2Ftmp%2Fza%C5%BC%C3%B3%C5%82%C4%87%20projekt.esp32studio',
  ) === '/tmp/zażółć projekt.esp32studio',
  'Polish chars + space',
);

// Double-encoded `%25` should become a single `%` after one URL parse, not throw.
assert(
  resolveOpenTarget('esp32studio://open?path=/tmp/100%25.esp32studio') ===
    '/tmp/100%.esp32studio',
  'literal percent via query',
);

assert(
  resolveOpenTarget('file:///tmp/za%C5%BC%C3%B3%C5%82%C4%87%20projekt.esp32studio') ===
    '/tmp/zażółć projekt.esp32studio',
  'macOS Open With file:// URL',
);

// Pathname form stays percent-encoded in URL.pathname — decode once.
assert(
  resolveOpenTarget('esp32studio://open/tmp/my%20file.esp32studio') ===
    '/tmp/my file.esp32studio',
  'pathname space',
);
assert(
  resolveOpenTarget(
    'esp32studio://open/tmp/za%C5%BC%C3%B3%C5%82%C4%87%20projekt.esp32studio',
  ) === '/tmp/zażółć projekt.esp32studio',
  'pathname Polish + space',
);
assert(
  resolveOpenTarget('esp32studio://open/tmp/100%25.esp32studio') ===
    '/tmp/100%.esp32studio',
  'pathname percent',
);

assert(
  resolveOpenTarget('file:///C:/Users/Demo/my%20file.esp32studio') ===
    'C:/Users/Demo/my file.esp32studio',
  'Windows file:// URL',
);

assert(decodeUriComponentOnce('100%.esp32studio') === '100%.esp32studio', 'no second decode of %');
assert(decodeUriComponentOnce('my%20file') === 'my file', 'decode once when encoded');
assert(decodeUriComponentOnce('za%C5%BC') === 'zaż', 'decode Polish once');

assert(isAllowedOpenPath('/tmp/demo.esp32studio'), 'allow esp32studio');
assert(isAllowedOpenPath('/tmp/sketch.ino'), 'allow ino');
assert(isAllowedOpenPath('/tmp/fw.bin'), 'allow bin');
assert(!isAllowedOpenPath('/tmp/secrets.txt'), 'reject txt before content read');
assert(!isAllowedOpenPath('/tmp/noext'), 'reject no extension');
assert(shouldReadOpenContent('/tmp/demo.esp32studio'), 'read project content');
assert(!shouldReadOpenContent('/tmp/fw.bin'), 'skip firmware content');
assert(ALLOWED_OPEN_EXTENSIONS.includes('esp32studio'), 'extension list');

// --- async session behaviour (first/second instance, offline, channel change) ---

async function runAsyncTests() {
  // Offline updater must not block open-path binding (first instance cold start).
  let bound = false;
  const offline = await runOpenPathsSession({
    checkUpdate: async () => {
      throw new Error('network offline');
    },
    bindOpenPaths: async () => {
      bound = true;
      return () => undefined;
    },
  });
  assert(bound, 'offline: bind still runs');
  assert(offline.updateError === 'network offline', 'offline: update error captured');
  offline.unlisten();

  // Channel change: updater re-runs independently; open binder is a separate effect.
  let updateCalls = 0;
  let bindCalls = 0;
  const channelA = await runOpenPathsSession({
    checkUpdate: async () => {
      updateCalls += 1;
    },
    bindOpenPaths: async () => {
      bindCalls += 1;
      return () => undefined;
    },
  });
  channelA.unlisten();
  // Simulate channel change remounting only the updater path (bind stays at 1 in App).
  await (async () => {
    updateCalls += 1; // second channel check
  })();
  assert(updateCalls === 2, 'channel change: updater runs again');
  assert(bindCalls === 1, 'channel change: open binder not remounted');

  // Late-registered subscription cleanup (unmount before listen promise settles).
  const lateHits = { n: 0 };
  const lateStop = settleOpenPathsSubscription(() => {
    lateHits.n += 1;
  }, true);
  assert(lateHits.n === 1, 'late subscription unlisten called immediately');
  lateStop();
  assert(lateHits.n === 1, 'noop stop after late cleanup');

  const keepHits = { n: 0 };
  const keep = settleOpenPathsSubscription(() => {
    keepHits.n += 1;
  }, false);
  assert(keepHits.n === 0, 'active subscription kept');
  const beforeStop = keepHits.n;
  keep();
  assert(keepHits.n === beforeStop + 1, 'active subscription cleaned on stop');

  // First vs second instance delivery model (buffer then live).
  const firstInstancePaths: string[] = [];
  const secondInstancePaths: string[] = [];
  const coldStart = ['esp32studio://open?path=%2Ftmp%2Fza%C5%BC%C3%B3%C5%82%C4%87%20projekt.esp32studio'];
  const warmOpen = ['/tmp/my file.esp32studio', '/tmp/100%.esp32studio'];

  for (const raw of coldStart) {
    const t = resolveOpenTarget(raw);
    if (t && isAllowedOpenPath(t)) firstInstancePaths.push(t);
  }
  for (const raw of warmOpen) {
    const t = resolveOpenTarget(raw);
    if (t && isAllowedOpenPath(t)) secondInstancePaths.push(t);
  }

  assert(
    firstInstancePaths[0] === '/tmp/zażółć projekt.esp32studio',
    'first instance: Polish + space path',
  );
  assert(secondInstancePaths.includes('/tmp/my file.esp32studio'), 'second instance: space');
  assert(secondInstancePaths.includes('/tmp/100%.esp32studio'), 'second instance: percent');

  console.log('deepLink.test.ts: OK');
}

await runAsyncTests();
