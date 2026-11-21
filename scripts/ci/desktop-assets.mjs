import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync, createReadStream, existsSync, mkdirSync, mkdtempSync,
  readdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { resolveAppVersion } from './assert-app-version.mjs';

const bundleDir = 'src-tauri/target/release/bundle';
const outputDir = 'desktop-assets';
const signed = process.env.SIGNED_UPDATER === 'true';

function assetPlan(version) {
  const product = 'ESP32.Display.Studio-' + version;
  return {
    'windows-x86_64': [
      { dir: 'nsis', suffix: '-setup.exe', name: product + '-windows-x64-setup.exe', target: 'windows-x86_64-nsis' },
      { dir: 'msi', suffix: '.msi', name: product + '-windows-x64.msi', target: 'windows-x86_64-msi' },
      { dir: 'tools/pc-agent/dist', suffix: 'esp32-pc-agent.exe', name: 'esp32-pc-agent.exe', agent: true },
    ],
    'linux-x86_64': [
      { dir: 'appimage', suffix: '.AppImage', name: product + '-linux-x86_64.AppImage', target: 'linux-x86_64-appimage' },
      { dir: 'deb', suffix: '.deb', name: product + '-linux-amd64.deb' },
    ],
    'darwin-aarch64': [
      { dir: 'dmg', suffix: '.dmg', name: product + '-macos-arm64.dmg' },
      { dir: 'macos', suffix: '.app.tar.gz', name: product + '-macos-arm64.app.tar.gz', target: 'darwin-aarch64', updaterOnly: true },
    ],
    'darwin-x86_64': [
      { dir: 'dmg', suffix: '.dmg', name: product + '-macos-x86_64.dmg' },
      { dir: 'macos', suffix: '.app.tar.gz', name: product + '-macos-x86_64.app.tar.gz', target: 'darwin-x86_64', updaterOnly: true },
    ],
  };
}

function verifyFile(path) {
  const file = statSync(path);
  if (!file.isFile() || file.size === 0) throw new Error('Invalid artifact: ' + path);
}

function stageAsset(spec, version) {
  const dir = spec.agent ? spec.dir : join(bundleDir, spec.dir);
  const files = readdirSync(dir).filter(name => name.endsWith(spec.suffix));
  if (files.length !== 1) {
    throw new Error('Expected one ' + spec.suffix + ' in ' + dir + ', found ' + files.length);
  }
  const [name] = files;
  if (!spec.agent && !spec.updaterOnly && !name.includes('_' + version + '_')) {
    throw new Error('Unexpected version in Tauri bundle filename: ' + name);
  }
  const path = join(dir, name);
  verifyFile(path);
  copyFileSync(path, join(outputDir, spec.name));
  if (signed && spec.target) {
    verifyFile(path + '.sig');
    copyFileSync(path + '.sig', join(outputDir, spec.name + '.sig'));
  }
}

async function checksum(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function verifyUpdaterAsset(path, signature, version, temp) {
  const decodedSignature = join(temp, 'asset.minisig');
  const decoded = Buffer.from(signature, 'base64').toString('utf8');
  writeFileSync(decodedSignature, decoded);
  execFileSync('minisign', [
    '-Vm', path, '-p', join(temp, 'updater.pub'), '-x', decodedSignature,
  ], { stdio: 'inherit' });
  const trustedComment = decoded.split(/\r?\n/).find(line => line.startsWith('trusted comment:'));
  if (!trustedComment?.split('\t').includes('version:' + version)) {
    throw new Error('Updater signature does not attest app version ' + version + ': ' + path);
  }
}

async function collect(plan, { version, tag }) {
  const platformUpdates = {};
  const temp = signed ? mkdtempSync(join(tmpdir(), 'esp32-updater-')) : undefined;
  const repository = process.env.GITHUB_REPOSITORY;
  try {
    if (signed) {
      if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid repository');
      const base = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
      writeFileSync(join(temp, 'updater.pub'), Buffer.from(base.plugins.updater.pubkey, 'base64'));
    }
    for (const [platform, assets] of Object.entries(plan)) {
      const dir = join('desktop-artifacts', 'desktop-' + platform);
      for (const spec of assets) {
        if (spec.updaterOnly && !signed) continue;
        const path = join(dir, spec.name);
        verifyFile(path);
        copyFileSync(path, join(outputDir, spec.name));
        if (signed && spec.target) {
          const signature = readFileSync(path + '.sig', 'utf8').trim();
          verifyUpdaterAsset(path, signature, version, temp);
          copyFileSync(path + '.sig', join(outputDir, spec.name + '.sig'));
          platformUpdates[spec.target] = {
            signature,
            url: 'https://github.com/' + repository + '/releases/download/' + tag + '/' + spec.name,
          };
        }
      }
    }
    if (signed) {
      // No generic Linux entry: a deb install must use its package manager.
      const manifest = { version, pub_date: new Date().toISOString(), platforms: platformUpdates };
      writeFileSync(join(outputDir, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n');
    }
    const checksums = [];
    for (const file of readdirSync(outputDir).sort()) {
      checksums.push(await checksum(join(outputDir, file)) + '  ' + file);
    }
    writeFileSync(join(outputDir, 'SHA256SUMS.txt'), checksums.join('\n') + '\n');
  } finally {
    if (temp) rmSync(temp, { recursive: true, force: true });
  }
}

function compareStable(left, right) {
  const a = left.slice(1).split('.').map(BigInt);
  const b = right.slice(1).split('.').map(BigInt);
  for (const [index, component] of a.entries()) {
    if (component > b[index]) return 1;
    if (component < b[index]) return -1;
  }
  return 0;
}

const mode = process.argv[2];
const info = resolveAppVersion({ tag: process.env.APP_VERSION_TAG });
if (mode === 'guard-publish') {
  const [tag, inventory] = process.argv.slice(3);
  if (tag !== info.tag) throw new Error('Publication tag does not match the checked-out app version');
  const published = readFileSync(inventory, 'utf8').split(/\r?\n/);
  if (published.some(previous => /^v\d+\.\d+\.\d+$/.test(previous) && compareStable(previous, tag) >= 0)) {
    throw new Error('A matching or newer stable release has already been published');
  }
} else if (mode === 'stage' || mode === 'collect') {
  const plan = assetPlan(info.version);
  if (existsSync(outputDir)) throw new Error('Expected an empty staging area: ' + basename(outputDir));
  mkdirSync(outputDir);
  if (mode === 'stage') {
    const platform = process.env.PLATFORM;
    if (!Object.hasOwn(plan, platform)) throw new Error('Unknown desktop platform: ' + platform);
    for (const asset of plan[platform]) {
      if (!asset.updaterOnly || signed) stageAsset(asset, info.version);
    }
  } else {
    await collect(plan, info);
  }
} else {
  throw new Error('Usage: desktop-assets.mjs stage | collect | guard-publish <tag> <inventory>');
}
