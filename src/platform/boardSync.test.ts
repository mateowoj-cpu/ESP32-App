const store = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => {
    store.set(k, v);
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => store.clear(),
  key: () => null,
  get length() {
    return store.size;
  },
} as Storage;

const {
  BUNDLED_COMMUNITY_CATALOG,
  applyCommunityCatalog,
  isCommunityCatalog,
  syncCommunityBoardProfiles,
  loadBoardSyncMeta,
} = await import('./boardSync');
const { loadBoardPreset } = await import('./boardCache');

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(isCommunityCatalog(BUNDLED_COMMUNITY_CATALOG), 'bundled catalog valid');
assert(BUNDLED_COMMUNITY_CATALOG.profiles.length >= 3, 'has profiles');

const n = applyCommunityCatalog(BUNDLED_COMMUNITY_CATALOG);
assert(n === BUNDLED_COMMUNITY_CATALOG.profiles.length, 'applied count');

const loaded = loadBoardPreset('10c4', 'ea60', 'COM9');
assert(loaded?.chip === 'esp32', 'cp210x preset');
assert(loaded?.offset === '0x1000', 'offset');

const meta = await syncCommunityBoardProfiles({ forceBundled: true });
assert(meta.count >= 3, 'sync count');
assert(meta.remote === false, 'force bundled');
assert(loadBoardSyncMeta()?.count === meta.count, 'meta persisted');

console.log('boardSync.test.ts: OK');
