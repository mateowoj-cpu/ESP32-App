/**
 * Community marketplace — data-only sandbox (Faza 14 → 15).
 *
 * Safety rules:
 * - JSON catalog + import/export of widgets and automation rules only
 * - Schema validation against known enums / shapes
 * - NEVER eval, Function(), dynamic import of user code, or script fields
 * - Faza 15: manifest v2 + Ed25519 pack signatures + HTTPS host allowlist
 *   for remote fetches (still data-only — signatures authenticate JSON, not code)
 */

import type {
  ActionType,
  AutomationRule,
  PetMood,
  TriggerType,
  UIWidget,
  WidgetType,
} from '../types';

export type MarketplaceKind = 'widget_pack' | 'rule_pack';
export type MarketplacePackVersion = 1 | 2;

export interface MarketplaceCatalogEntry {
  id: string;
  kind: MarketplaceKind;
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  author: string;
  tags: string[];
  /** Path under /marketplace/packs/ or inline pack id resolved from bundled packs. */
  packId: string;
  /** Optional HTTPS URL (must pass host allowlist) for remote pack JSON. */
  packUrl?: string;
  /** Publisher id matching a trusted Ed25519 public key (manifest v2). */
  publisherId?: string;
  /** When true, remote install requires a valid signature from publisherId. */
  requireSignature?: boolean;
}

export interface MarketplaceCatalog {
  version: number;
  updatedAt: string;
  source?: string;
  entries: MarketplaceCatalogEntry[];
}

export interface MarketplacePublisher {
  id: string;
  name: string;
  /** Raw 32-byte Ed25519 public key, base64. */
  publicKeyB64: string;
}

export interface MarketplaceWidgetPack {
  format: 'esp32studio-marketplace';
  kind: 'widget_pack';
  version: MarketplacePackVersion;
  id: string;
  title: string;
  description?: string;
  author?: string;
  publisherId?: string;
  /** Ed25519 signature (base64) over canonical JSON without this field. */
  signature?: string;
  widgets: UIWidget[];
}

export interface MarketplaceRulePack {
  format: 'esp32studio-marketplace';
  kind: 'rule_pack';
  version: MarketplacePackVersion;
  id: string;
  title: string;
  description?: string;
  author?: string;
  publisherId?: string;
  signature?: string;
  rules: AutomationRule[];
}

export type MarketplacePack = MarketplaceWidgetPack | MarketplaceRulePack;

export type MarketplaceParseResult =
  | { ok: true; pack: MarketplacePack }
  | { ok: false; error: string };

export type MarketplaceVerifyResult =
  | { ok: true; publisherId: string }
  | { ok: false; error: string };

const WIDGET_TYPES = new Set<WidgetType>([
  'text',
  'cyber_pet',
  'clock',
  'gauge',
  'progress_bar',
  'sparkline',
  'weather',
  'pc_monitor',
  'menu',
  'battery_wifi',
  'icon',
]);

const TRIGGER_TYPES = new Set<TriggerType>([
  'pir_motion',
  'light_lux_below',
  'temp_above',
  'boot_button_pressed',
  'gpio_button_pressed',
  'time_is',
  'notification_received',
  'rotary_turned',
  'screen_touch_tap',
  'screen_touch_swipe',
  'usb_connected',
  'usb_disconnected',
  'bluetooth_connected',
]);

const ACTION_TYPES = new Set<ActionType>([
  'switch_screen',
  'wake_display',
  'set_pet_mood',
  'set_brightness',
  'sound_buzzer',
  'show_notification',
]);

const PET_MOODS = new Set<PetMood>([
  'neutral',
  'blink',
  'glance_left',
  'glance_right',
  'look_around',
  'look_up',
  'look_left',
  'look_right',
  'happy',
  'surprised',
  'yawn',
  'sleep',
  'crazy',
  'dizzy',
  'angry',
  'love',
]);

/** Keys that imply executable / untrusted code — always reject. */
const FORBIDDEN_KEYS = new Set([
  'script',
  'code',
  'eval',
  'javascript',
  'wasm',
  'module',
  'import',
  'require',
  'function',
  'fn',
  'handler',
  'onRun',
  'executable',
  'payload_b64',
  'shell',
  'command',
]);

const MAX_WIDGETS = 48;
const MAX_RULES = 64;
const MAX_STRING = 512;
const MAX_DEPTH = 8;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function scanForbiddenKeys(value: unknown, depth = 0): string | null {
  if (depth > MAX_DEPTH) return 'Nesting too deep';
  if (Array.isArray(value)) {
    for (const item of value) {
      const err = scanForbiddenKeys(item, depth + 1);
      if (err) return err;
    }
    return null;
  }
  if (!isPlainObject(value)) return null;
  for (const [k, v] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(k)) return `Forbidden key: ${k}`;
    if (typeof v === 'function') return 'Functions are not allowed';
    const err = scanForbiddenKeys(v, depth + 1);
    if (err) return err;
  }
  return null;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function isSafeString(v: unknown, max = MAX_STRING): v is string {
  return typeof v === 'string' && v.length <= max;
}

function validateWidget(raw: unknown, index: number): string | null {
  if (!isPlainObject(raw)) return `widgets[${index}]: expected object`;
  if (!isSafeString(raw.id, 128)) return `widgets[${index}]: invalid id`;
  if (typeof raw.type !== 'string' || !WIDGET_TYPES.has(raw.type as WidgetType)) {
    return `widgets[${index}]: unknown type`;
  }
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    if (!isFiniteNumber(raw[key])) return `widgets[${index}]: invalid ${key}`;
  }
  if (raw.label !== undefined && !isSafeString(raw.label)) {
    return `widgets[${index}]: label too long`;
  }
  return null;
}

function validateRule(raw: unknown, index: number): string | null {
  if (!isPlainObject(raw)) return `rules[${index}]: expected object`;
  if (!isSafeString(raw.id, 128)) return `rules[${index}]: invalid id`;
  if (!isSafeString(raw.name)) return `rules[${index}]: invalid name`;
  if (typeof raw.enabled !== 'boolean') return `rules[${index}]: enabled must be boolean`;
  if (!isPlainObject(raw.trigger)) return `rules[${index}]: missing trigger`;
  if (
    typeof raw.trigger.type !== 'string' ||
    !TRIGGER_TYPES.has(raw.trigger.type as TriggerType)
  ) {
    return `rules[${index}]: unknown trigger type`;
  }
  if (!isPlainObject(raw.action)) return `rules[${index}]: missing action`;
  if (
    typeof raw.action.type !== 'string' ||
    !ACTION_TYPES.has(raw.action.type as ActionType)
  ) {
    return `rules[${index}]: unknown action type`;
  }
  if (
    raw.action.petMood !== undefined &&
    (typeof raw.action.petMood !== 'string' ||
      !PET_MOODS.has(raw.action.petMood as PetMood))
  ) {
    return `rules[${index}]: unknown petMood`;
  }
  return null;
}

export function isMarketplaceCatalog(value: unknown): value is MarketplaceCatalog {
  if (!isPlainObject(value)) return false;
  const c = value as unknown as MarketplaceCatalog;
  return (
    typeof c.version === 'number' &&
    Array.isArray(c.entries) &&
    c.entries.every(
      e =>
        e &&
        typeof e.id === 'string' &&
        (e.kind === 'widget_pack' || e.kind === 'rule_pack') &&
        typeof e.title === 'string' &&
        typeof e.description === 'string' &&
        typeof e.author === 'string' &&
        Array.isArray(e.tags) &&
        typeof e.packId === 'string' &&
        (e.packUrl === undefined || typeof e.packUrl === 'string') &&
        (e.publisherId === undefined || typeof e.publisherId === 'string') &&
        (e.requireSignature === undefined || typeof e.requireSignature === 'boolean'),
    )
  );
}

function packMetaFromRaw(raw: Record<string, unknown>): {
  publisherId?: string;
  signature?: string;
  version: MarketplacePackVersion;
} {
  const version: MarketplacePackVersion = raw.version === 2 ? 2 : 1;
  return {
    version,
    publisherId: isSafeString(raw.publisherId, 128) ? raw.publisherId : undefined,
    signature: isSafeString(raw.signature, 256) ? raw.signature : undefined,
  };
}

export function parseMarketplacePack(raw: unknown): MarketplaceParseResult {
  const forbidden = scanForbiddenKeys(raw);
  if (forbidden) return { ok: false, error: forbidden };

  if (!isPlainObject(raw)) return { ok: false, error: 'Pack must be a JSON object' };
  if (raw.format !== 'esp32studio-marketplace') {
    return { ok: false, error: 'format must be esp32studio-marketplace' };
  }
  if (raw.version !== 1 && raw.version !== 2) {
    return { ok: false, error: 'Unsupported pack version (want 1 or 2)' };
  }
  if (!isSafeString(raw.id, 128)) return { ok: false, error: 'Invalid pack id' };
  if (!isSafeString(raw.title)) return { ok: false, error: 'Invalid pack title' };

  const meta = packMetaFromRaw(raw);

  if (raw.kind === 'widget_pack') {
    if (!Array.isArray(raw.widgets)) return { ok: false, error: 'widgets must be an array' };
    if (raw.widgets.length === 0 || raw.widgets.length > MAX_WIDGETS) {
      return { ok: false, error: `widgets length must be 1–${MAX_WIDGETS}` };
    }
    for (let i = 0; i < raw.widgets.length; i++) {
      const err = validateWidget(raw.widgets[i], i);
      if (err) return { ok: false, error: err };
    }
    return {
      ok: true,
      pack: {
        format: 'esp32studio-marketplace',
        kind: 'widget_pack',
        version: meta.version,
        id: raw.id,
        title: raw.title,
        description: isSafeString(raw.description) ? raw.description : undefined,
        author: isSafeString(raw.author) ? raw.author : undefined,
        publisherId: meta.publisherId,
        signature: meta.signature,
        widgets: raw.widgets as UIWidget[],
      },
    };
  }

  if (raw.kind === 'rule_pack') {
    if (!Array.isArray(raw.rules)) return { ok: false, error: 'rules must be an array' };
    if (raw.rules.length === 0 || raw.rules.length > MAX_RULES) {
      return { ok: false, error: `rules length must be 1–${MAX_RULES}` };
    }
    for (let i = 0; i < raw.rules.length; i++) {
      const err = validateRule(raw.rules[i], i);
      if (err) return { ok: false, error: err };
    }
    return {
      ok: true,
      pack: {
        format: 'esp32studio-marketplace',
        kind: 'rule_pack',
        version: meta.version,
        id: raw.id,
        title: raw.title,
        description: isSafeString(raw.description) ? raw.description : undefined,
        author: isSafeString(raw.author) ? raw.author : undefined,
        publisherId: meta.publisherId,
        signature: meta.signature,
        rules: raw.rules as AutomationRule[],
      },
    };
  }

  return { ok: false, error: 'kind must be widget_pack or rule_pack' };
}

export function parseMarketplacePackJson(text: string): MarketplaceParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
  return parseMarketplacePack(raw);
}

export function exportWidgetPack(
  widgets: UIWidget[],
  meta: {
    id: string;
    title: string;
    description?: string;
    author?: string;
    publisherId?: string;
    version?: MarketplacePackVersion;
  },
): MarketplaceWidgetPack {
  return {
    format: 'esp32studio-marketplace',
    kind: 'widget_pack',
    version: meta.version ?? 1,
    id: meta.id,
    title: meta.title,
    description: meta.description,
    author: meta.author,
    publisherId: meta.publisherId,
    widgets: widgets.map(w => ({ ...w })),
  };
}

export function exportRulePack(
  rules: AutomationRule[],
  meta: {
    id: string;
    title: string;
    description?: string;
    author?: string;
    publisherId?: string;
    version?: MarketplacePackVersion;
  },
): MarketplaceRulePack {
  return {
    format: 'esp32studio-marketplace',
    kind: 'rule_pack',
    version: meta.version ?? 1,
    id: meta.id,
    title: meta.title,
    description: meta.description,
    author: meta.author,
    publisherId: meta.publisherId,
    rules: rules.map(r => ({
      ...r,
      trigger: { ...r.trigger },
      action: { ...r.action },
    })),
  };
}

/** Remap imported widget ids so they do not collide with the active screen. */
export function sandboxImportWidgets(
  pack: MarketplaceWidgetPack,
  existingIds: Set<string>,
): UIWidget[] {
  const stamp = Date.now().toString(36);
  return pack.widgets.map((w, i) => {
    let id = `mkt_${stamp}_${i}_${w.id}`.slice(0, 120);
    while (existingIds.has(id)) id = `${id}_x`;
    existingIds.add(id);
    return { ...w, id };
  });
}

/** Remap imported rule ids; never execute — caller merges into app state only. */
export function sandboxImportRules(
  pack: MarketplaceRulePack,
  existingIds: Set<string>,
): AutomationRule[] {
  const stamp = Date.now().toString(36);
  return pack.rules.map((r, i) => {
    let id = `mkt_${stamp}_${i}_${r.id}`.slice(0, 120);
    while (existingIds.has(id)) id = `${id}_x`;
    existingIds.add(id);
    return {
      ...r,
      id,
      enabled: !!r.enabled,
      trigger: { ...r.trigger },
      action: { ...r.action },
    };
  });
}

export const BUNDLED_MARKETPLACE_CATALOG: MarketplaceCatalog = {
  version: 2,
  updatedAt: '2026-11-13T00:00:00.000Z',
  source: 'esp32-display-studio/marketplace-bundled',
  entries: [
    {
      id: 'pack-status-strip',
      kind: 'widget_pack',
      title: 'Pasek statusu (zegar + Wi‑Fi)',
      titleEn: 'Status strip (clock + Wi‑Fi)',
      description: 'Kompaktowy zegar 24h i ikona baterii/Wi‑Fi pod OLED 128×64.',
      descriptionEn: 'Compact 24h clock and battery/Wi‑Fi icon for 128×64 OLED.',
      author: 'ESP32 Display Studio',
      tags: ['oled', 'clock', 'status'],
      packId: 'status-strip',
      requireSignature: false,
    },
    {
      id: 'pack-night-rules',
      kind: 'rule_pack',
      title: 'Reguły nocne',
      titleEn: 'Night rules',
      description: 'Przyciemnienie po 22:00 i sen zwierzaka przy ruchu w nocy.',
      descriptionEn: 'Dim after 22:00 and sleep-mood pet on night motion.',
      author: 'ESP32 Display Studio',
      tags: ['automation', 'night', 'brightness'],
      packId: 'night-rules',
      requireSignature: false,
    },
    {
      id: 'pack-pc-mini',
      kind: 'widget_pack',
      title: 'Mini monitor PC',
      titleEn: 'PC mini monitor',
      description: 'Widget pc_monitor + sparkline CPU — dane z agenta PC.',
      descriptionEn: 'pc_monitor widget + CPU sparkline — data from the PC agent.',
      author: 'ESP32 Display Studio',
      tags: ['pc', 'monitor', 'sparkline'],
      packId: 'pc-mini',
      requireSignature: false,
    },
  ],
};

export const BUNDLED_MARKETPLACE_PACKS: Record<string, MarketplacePack> = {
  'status-strip': {
    format: 'esp32studio-marketplace',
    kind: 'widget_pack',
    version: 1,
    id: 'status-strip',
    title: 'Status strip',
    author: 'ESP32 Display Studio',
    widgets: [
      {
        id: 'm_clock',
        type: 'clock',
        x: 4,
        y: 4,
        width: 72,
        height: 20,
        clockFormat: '24h',
        showSeconds: false,
        showDate: false,
        binding: 'time',
      },
      {
        id: 'm_batt_wifi',
        type: 'battery_wifi',
        x: 80,
        y: 4,
        width: 44,
        height: 20,
      },
    ],
  },
  'night-rules': {
    format: 'esp32studio-marketplace',
    kind: 'rule_pack',
    version: 1,
    id: 'night-rules',
    title: 'Night rules',
    author: 'ESP32 Display Studio',
    rules: [
      {
        id: 'm_rule_dim',
        name: 'Dim at 22:00',
        enabled: true,
        trigger: { type: 'time_is', time: '22:00' },
        action: { type: 'set_brightness', brightness: 15 },
      },
      {
        id: 'm_rule_night_pir',
        name: 'Night PIR → sleep mood',
        enabled: true,
        trigger: { type: 'pir_motion', gpioPin: 14 },
        action: { type: 'set_pet_mood', petMood: 'sleep' },
      },
    ],
  },
  'pc-mini': {
    format: 'esp32studio-marketplace',
    kind: 'widget_pack',
    version: 1,
    id: 'pc-mini',
    title: 'PC mini monitor',
    author: 'ESP32 Display Studio',
    widgets: [
      {
        id: 'm_pc',
        type: 'pc_monitor',
        x: 4,
        y: 4,
        width: 120,
        height: 36,
      },
      {
        id: 'm_cpu_spark',
        type: 'sparkline',
        x: 4,
        y: 42,
        width: 120,
        height: 18,
        label: 'CPU',
        binding: 'cpu',
        historyPoints: 16,
      },
    ],
  },
};

const DEFAULT_CATALOG_URL =
  'https://raw.githubusercontent.com/mateowoj-cpu/ESP32-App/main/public/marketplace/catalog.json';

/** HTTPS hosts allowed for remote catalog / pack fetch (Faza 15). */
export const MARKETPLACE_ALLOWED_HOSTS = new Set([
  'raw.githubusercontent.com',
]);

/** Path prefixes allowed on raw.githubusercontent.com. */
export const MARKETPLACE_ALLOWED_PATH_PREFIXES = [
  '/mateowoj-cpu/ESP32-App/',
];

/**
 * Trusted Ed25519 publishers (public keys only).
 * Humans add keys after `scripts/marketplace/sign-pack.mjs --generate`.
 * Never commit private keys. Empty by default until a publisher is registered.
 */
const trustedPublishers = new Map<string, MarketplacePublisher>();

export function listTrustedPublishers(): MarketplacePublisher[] {
  return [...trustedPublishers.values()];
}

export function clearTrustedPublishers(): void {
  trustedPublishers.clear();
}

/** Register or replace a trusted publisher public key (raw 32-byte Ed25519, base64). */
export function registerTrustedPublisher(publisher: MarketplacePublisher): void {
  if (!publisher.id || !isSafeString(publisher.id, 128)) {
    throw new Error('Invalid publisher id');
  }
  const raw = decodeBase64(publisher.publicKeyB64);
  if (!raw || raw.byteLength !== 32) {
    throw new Error('Publisher publicKeyB64 must be 32 raw Ed25519 bytes (base64)');
  }
  trustedPublishers.set(publisher.id, {
    id: publisher.id,
    name: publisher.name || publisher.id,
    publicKeyB64: publisher.publicKeyB64,
  });
}

export async function loadTrustedPublishersFromJson(
  url = '/marketplace/publishers.json',
): Promise<number> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return 0;
    const json: unknown = await res.json();
    if (!isPlainObject(json) || !Array.isArray(json.publishers)) return 0;
    let n = 0;
    for (const item of json.publishers) {
      if (!isPlainObject(item)) continue;
      if (
        typeof item.id !== 'string' ||
        typeof item.publicKeyB64 !== 'string'
      ) {
        continue;
      }
      try {
        registerTrustedPublisher({
          id: item.id,
          name: typeof item.name === 'string' ? item.name : item.id,
          publicKeyB64: item.publicKeyB64,
        });
        n += 1;
      } catch {
        // skip malformed entries
      }
    }
    return n;
  } catch {
    return 0;
  }
}

function decodeBase64(b64: string): Uint8Array | null {
  try {
    if (typeof atob === 'function') {
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
  } catch {
    // fall through
  }
  try {
    // Node / test runner
    const Buf = (globalThis as { Buffer?: { from: (s: string, e: string) => Uint8Array } })
      .Buffer;
    if (Buf) return new Uint8Array(Buf.from(b64, 'base64'));
  } catch {
    // ignore
  }
  return null;
}

/** Copy into a fresh ArrayBuffer-backed view (satisfies DOM BufferSource typing). */
function asBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function encodeBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
    return btoa(s);
  }
  const Buf = (globalThis as { Buffer?: { from: (b: Uint8Array) => { toString: (e: string) => string } } })
    .Buffer;
  if (Buf) return Buf.from(bytes).toString('base64');
  throw new Error('No base64 encoder available');
}

/** Drop signature and sort object keys recursively for stable signing. */
export function canonicalizeMarketplaceValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeMarketplaceValue);
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (key === 'signature') continue;
    out[key] = canonicalizeMarketplaceValue(value[key]);
  }
  return out;
}

export function marketplacePackSigningBytes(pack: MarketplacePack | Record<string, unknown>): Uint8Array {
  const canonical = JSON.stringify(canonicalizeMarketplaceValue(pack));
  return new TextEncoder().encode(canonical);
}

function spkiFromRawEd25519(raw: Uint8Array): Uint8Array {
  // SPKI prefix for Ed25519 SubjectPublicKeyInfo + 32-byte raw key
  const prefix = Uint8Array.from([
    0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
  ]);
  const out = new Uint8Array(prefix.length + raw.length);
  out.set(prefix, 0);
  out.set(raw, prefix.length);
  return out;
}

async function getSubtle(): Promise<SubtleCrypto> {
  const browser = globalThis.crypto?.subtle;
  if (browser) return browser;
  // Test / Node runner only (browser builds already have crypto.subtle).
  const nodeCrypto = (await import(
    /* @vite-ignore */ 'node:crypto'
  )) as { webcrypto?: { subtle?: SubtleCrypto } };
  const c = nodeCrypto.webcrypto?.subtle;
  if (!c) throw new Error('WebCrypto SubtleCrypto unavailable');
  return c;
}

export async function verifyMarketplacePackSignature(
  pack: MarketplacePack,
): Promise<MarketplaceVerifyResult> {
  if (!pack.publisherId) return { ok: false, error: 'Missing publisherId' };
  if (!pack.signature) return { ok: false, error: 'Missing signature' };
  const publisher = trustedPublishers.get(pack.publisherId);
  if (!publisher) {
    return { ok: false, error: `Unknown publisher: ${pack.publisherId}` };
  }
  const rawPub = decodeBase64(publisher.publicKeyB64);
  if (!rawPub || rawPub.byteLength !== 32) {
    return { ok: false, error: 'Invalid publisher public key' };
  }
  const sig = decodeBase64(pack.signature);
  if (!sig || sig.byteLength !== 64) {
    return { ok: false, error: 'Invalid signature encoding' };
  }
  try {
    const subtle = await getSubtle();
    const key = await subtle.importKey(
      'spki',
      asBufferSource(spkiFromRawEd25519(rawPub)),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    const ok = await subtle.verify(
      { name: 'Ed25519' },
      key,
      asBufferSource(sig),
      asBufferSource(marketplacePackSigningBytes(pack)),
    );
    if (!ok) return { ok: false, error: 'Signature mismatch' };
    return { ok: true, publisherId: pack.publisherId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Attach an Ed25519 signature (used by CLI / tests). Private key is PKCS8 base64
 * or raw 32-byte seed base64 — never ship private keys in the app bundle.
 */
export async function signMarketplacePack(
  pack: MarketplacePack,
  privateKeyPkcs8B64: string,
  publisherId: string,
): Promise<MarketplacePack> {
  const pkcs8 = decodeBase64(privateKeyPkcs8B64);
  if (!pkcs8) throw new Error('Invalid private key base64');
  const subtle = await getSubtle();
  const key = await subtle.importKey(
    'pkcs8',
    asBufferSource(pkcs8),
    { name: 'Ed25519' },
    false,
    ['sign'],
  );
  const unsigned: MarketplacePack = {
    ...pack,
    version: 2,
    publisherId,
  };
  delete (unsigned as { signature?: string }).signature;
  const sig = await subtle.sign(
    { name: 'Ed25519' },
    key,
    asBufferSource(marketplacePackSigningBytes(unsigned)),
  );
  return {
    ...unsigned,
    signature: encodeBase64(new Uint8Array(sig)),
  };
}

export function isAllowedMarketplaceUrl(urlString: string): boolean {
  try {
    if (urlString.startsWith('/marketplace/')) return true;
    const url = new URL(urlString);
    if (url.protocol !== 'https:') return false;
    if (!MARKETPLACE_ALLOWED_HOSTS.has(url.hostname)) return false;
    return MARKETPLACE_ALLOWED_PATH_PREFIXES.some(prefix =>
      url.pathname.startsWith(prefix),
    );
  } catch {
    return false;
  }
}

export async function fetchMarketplaceCatalog(
  url: string = DEFAULT_CATALOG_URL,
  timeoutMs = 8000,
): Promise<{ catalog: MarketplaceCatalog; remote: boolean }> {
  if (url !== DEFAULT_CATALOG_URL && !isAllowedMarketplaceUrl(url)) {
    return { catalog: BUNDLED_MARKETPLACE_CATALOG, remote: false };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: unknown = await res.json();
    if (!isMarketplaceCatalog(json)) throw new Error('Invalid marketplace catalog');
    return { catalog: json, remote: true };
  } catch {
    return { catalog: BUNDLED_MARKETPLACE_CATALOG, remote: false };
  } finally {
    clearTimeout(timer);
  }
}

export function resolveBundledPack(packId: string): MarketplacePack | null {
  return BUNDLED_MARKETPLACE_PACKS[packId] ?? null;
}

export async function fetchRemoteMarketplacePack(
  url: string,
  timeoutMs = 8000,
): Promise<MarketplaceParseResult> {
  if (!isAllowedMarketplaceUrl(url)) {
    return { ok: false, error: 'Pack URL host is not on the marketplace allowlist' };
  }
  if (url.startsWith('/marketplace/')) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return parseMarketplacePackJson(await res.text());
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return parseMarketplacePackJson(await res.text());
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export async function loadMarketplacePack(
  entry: MarketplaceCatalogEntry,
): Promise<MarketplaceParseResult> {
  let result: MarketplaceParseResult;

  if (entry.packUrl) {
    result = await fetchRemoteMarketplacePack(entry.packUrl);
  } else {
    const bundled = resolveBundledPack(entry.packId);
    if (bundled) {
      result = parseMarketplacePack(bundled);
    } else {
      result = await fetchRemoteMarketplacePack(`/marketplace/packs/${entry.packId}.json`);
    }
  }

  if (!result.ok) return result;

  const needsSig =
    entry.requireSignature === true ||
    (result.pack.version === 2 && !!entry.publisherId && !!result.pack.signature);

  if (entry.requireSignature) {
    const publisherId = entry.publisherId || result.pack.publisherId;
    if (!publisherId) {
      return { ok: false, error: 'Pack requires signature but publisherId is missing' };
    }
    if (result.pack.publisherId && result.pack.publisherId !== publisherId) {
      return { ok: false, error: 'Pack publisherId does not match catalog entry' };
    }
    const verified = await verifyMarketplacePackSignature({
      ...result.pack,
      publisherId,
    });
    if (!verified.ok) return { ok: false, error: verified.error };
  } else if (needsSig && result.pack.signature && result.pack.publisherId) {
    const verified = await verifyMarketplacePackSignature(result.pack);
    if (!verified.ok) return { ok: false, error: verified.error };
  }

  return result;
}
