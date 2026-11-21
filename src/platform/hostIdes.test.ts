import {
  HOST_IDE_CATALOG,
  WINGET_ALLOWLIST,
  getHostIdeByProbeId,
  isWingetAllowlisted,
  wingetInstallCommand,
} from './hostIdes';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(HOST_IDE_CATALOG.length === 4, 'four host IDEs');
assert(
  HOST_IDE_CATALOG.every(ide => ide.downloadUrl.startsWith('https://')),
  'https-only downloads',
);
assert(
  !HOST_IDE_CATALOG.some(ide => /mirror|softonic|download\.cn/i.test(ide.downloadUrl)),
  'no shady mirrors',
);

const ids = HOST_IDE_CATALOG.map(i => i.id);
assert(ids.includes('arduino-ide'), 'arduino');
assert(ids.includes('vscode-platformio'), 'vscode+pio');
assert(ids.includes('sloeber'), 'sloeber');
assert(ids.includes('b4r'), 'b4r');

assert(WINGET_ALLOWLIST.length === 2, 'curated winget allowlist');
assert(isWingetAllowlisted('ArduinoSA.IDE.stable'), 'arduino winget ok');
assert(isWingetAllowlisted('Microsoft.VisualStudioCode'), 'vscode winget ok');
assert(!isWingetAllowlisted('Totally.Fake.Package'), 'reject unknown winget');

for (const ide of HOST_IDE_CATALOG) {
  if (ide.wingetId) {
    assert(isWingetAllowlisted(ide.wingetId), `catalog winget allowlisted: ${ide.wingetId}`);
  }
}

const arduino = getHostIdeByProbeId('arduino-ide');
assert(arduino?.wingetId === 'ArduinoSA.IDE.stable', 'arduino probe map');

const vscode = getHostIdeByProbeId('vscode-platformio');
assert(vscode?.extensionId === 'platformio.platformio-ide', 'pio extension id');
assert(vscode?.extensionUrl?.includes('marketplace.visualstudio.com'), 'marketplace url');

assert(
  wingetInstallCommand('ArduinoSA.IDE.stable').includes('--source winget'),
  'winget command uses official source',
);

const sloeber = getHostIdeByProbeId('sloeber');
assert(sloeber?.wingetId === null, 'sloeber has no winget — download only');
assert(sloeber?.downloadUrl.includes('baeyens.it'), 'sloeber official site');

const b4r = getHostIdeByProbeId('b4r');
assert(b4r?.wingetId === null, 'b4r has no winget — download only');
assert(b4r?.downloadUrl.includes('b4x.com'), 'b4r official site');

console.log('hostIdes.test.ts: OK');
