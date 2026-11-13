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

const { boardCacheKey, loadBoardPreset, saveBoardPreset } = await import('./boardCache');

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const key = boardCacheKey(0x303a, 0x1001, 'COM3');
assert(key.includes('303a'), 'vid hex');

saveBoardPreset(0x303a, 0x1001, 'COM3', {
  chip: 'esp32s3',
  offset: '0x0',
  baud: 921600,
  boardProfile: 'esp32s3',
});

const loaded = loadBoardPreset(0x303a, 0x1001, 'COM9');
assert(loaded?.chip === 'esp32s3', 'loose vid:pid cache');
assert(loaded?.offset === '0x0', 'offset');

console.log('boardCache.test.ts: OK');
