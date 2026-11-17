import {
  loadPreferredBuildTool,
  savePreferredBuildTool,
  type PreferredBuildTool,
} from './tools';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const mem = new Map<string, string>();
const original = globalThis.localStorage;

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
  },
});

mem.clear();
assert(loadPreferredBuildTool() === 'auto', 'default auto');

for (const tool of ['auto', 'platformio', 'arduino-cli'] as PreferredBuildTool[]) {
  savePreferredBuildTool(tool);
  assert(loadPreferredBuildTool() === tool, `persist ${tool}`);
}

mem.set('esp32_preferred_build_tool', 'bogus');
assert(loadPreferredBuildTool() === 'auto', 'reject bogus');

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: original,
});

console.log('tools.test.ts: OK');
