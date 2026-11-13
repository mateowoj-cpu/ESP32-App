/**
 * Community marketplace — data-only sandbox (Faza 14).
 *
 * Safety rules:
 * - JSON catalog + import/export of widgets and automation rules only
 * - Schema validation against known enums / shapes
 * - NEVER eval, Function(), dynamic import of user code, or script fields
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
}

export interface MarketplaceCatalog {
  version: number;
  updatedAt: string;
  source?: string;
  entries: MarketplaceCatalogEntry[];
}

export interface MarketplaceWidgetPack {
  format: 'esp32studio-marketplace';
  kind: 'widget_pack';
  version: 1;
  id: string;
  title: string;
  description?: string;
  author?: string;
  widgets: UIWidget[];
}

export interface MarketplaceRulePack {
  format: 'esp32studio-marketplace';
  kind: 'rule_pack';
  version: 1;
  id: string;
  title: string;
  description?: string;
  author?: string;
  rules: AutomationRule[];
}

export type MarketplacePack = MarketplaceWidgetPack | MarketplaceRulePack;

export type MarketplaceParseResult =
  | { ok: true; pack: MarketplacePack }
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
        typeof e.packId === 'string',
    )
  );
}

export function parseMarketplacePack(raw: unknown): MarketplaceParseResult {
  const forbidden = scanForbiddenKeys(raw);
  if (forbidden) return { ok: false, error: forbidden };

  if (!isPlainObject(raw)) return { ok: false, error: 'Pack must be a JSON object' };
  if (raw.format !== 'esp32studio-marketplace') {
    return { ok: false, error: 'format must be esp32studio-marketplace' };
  }
  if (raw.version !== 1) return { ok: false, error: 'Unsupported pack version' };
  if (!isSafeString(raw.id, 128)) return { ok: false, error: 'Invalid pack id' };
  if (!isSafeString(raw.title)) return { ok: false, error: 'Invalid pack title' };

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
        version: 1,
        id: raw.id,
        title: raw.title,
        description: isSafeString(raw.description) ? raw.description : undefined,
        author: isSafeString(raw.author) ? raw.author : undefined,
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
        version: 1,
        id: raw.id,
        title: raw.title,
        description: isSafeString(raw.description) ? raw.description : undefined,
        author: isSafeString(raw.author) ? raw.author : undefined,
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
  meta: { id: string; title: string; description?: string; author?: string },
): MarketplaceWidgetPack {
  return {
    format: 'esp32studio-marketplace',
    kind: 'widget_pack',
    version: 1,
    id: meta.id,
    title: meta.title,
    description: meta.description,
    author: meta.author,
    widgets: widgets.map(w => ({ ...w })),
  };
}

export function exportRulePack(
  rules: AutomationRule[],
  meta: { id: string; title: string; description?: string; author?: string },
): MarketplaceRulePack {
  return {
    format: 'esp32studio-marketplace',
    kind: 'rule_pack',
    version: 1,
    id: meta.id,
    title: meta.title,
    description: meta.description,
    author: meta.author,
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
  version: 1,
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

export async function fetchMarketplaceCatalog(
  url: string = DEFAULT_CATALOG_URL,
  timeoutMs = 8000,
): Promise<{ catalog: MarketplaceCatalog; remote: boolean }> {
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

export async function loadMarketplacePack(
  entry: MarketplaceCatalogEntry,
): Promise<MarketplaceParseResult> {
  const bundled = resolveBundledPack(entry.packId);
  if (bundled) return parseMarketplacePack(bundled);

  try {
    const res = await fetch(`/marketplace/packs/${entry.packId}.json`, {
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const text = await res.text();
    return parseMarketplacePackJson(text);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
