/**
 * Community marketplace — data-only sandbox (Faza 14 → 17).
 *
 * Safety rules:
 * - JSON catalog + import/export of widgets and automation rules only
 * - Schema validation against known enums / shapes
 * - NEVER eval, Function(), dynamic import of user code, or script fields
 * - Faza 15: manifest v2 + Ed25519 pack signatures + HTTPS host allowlist
 *   for remote fetches (still data-only — signatures authenticate JSON, not code)
 * - Faza 17: sandbox demo publisher public key + signed fixture pack
 *   (live private keys stay offline — never commit)
 */

import type {
  ActionType,
  AutomationRule,
  PetMood,
  TriggerType,
  UIWidget,
  WidgetType,
} from '../types';
import {
  acceptCommunityCatalog,
  applyCommunityCatalog,
  type CommunityBoardProfile,
} from './boardSync';

export type MarketplaceKind = 'widget_pack' | 'rule_pack' | 'board_pack' | 'github_addon';
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
  /** github_addon: curated https://github.com/owner/repo link (open only — never executed). */
  repoUrl?: string;
  /** Optional docs homepage (https). */
  homepageUrl?: string;
  /** Informational star count snapshot for curated listings. */
  stars?: number;
  /** board_pack: inline profiles (user-added or catalog-embedded). */
  profiles?: CommunityBoardProfile[];
  /** Local user-added option (persisted separately; merged into catalog at runtime). */
  userAdded?: boolean;
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
  /** When true, this is a disposable demo key — not a live community publisher. */
  sandbox?: boolean;
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

export interface MarketplaceBoardPack {
  format: 'esp32studio-marketplace';
  kind: 'board_pack';
  version: MarketplacePackVersion;
  id: string;
  title: string;
  description?: string;
  author?: string;
  publisherId?: string;
  signature?: string;
  profiles: CommunityBoardProfile[];
}

export type MarketplacePack =
  | MarketplaceWidgetPack
  | MarketplaceRulePack
  | MarketplaceBoardPack;

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
  'hall_magnetic',
  'light_lux_below',
  'temp_above',
  'ultrasonic_below',
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
  'toggle_relay',
  'set_servo_angle',
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
const MAX_PROFILES = 32;
const MAX_STRING = 512;
const MAX_DEPTH = 8;

const MARKETPLACE_KINDS = new Set<MarketplaceKind>([
  'widget_pack',
  'rule_pack',
  'board_pack',
  'github_addon',
]);

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

function validateBoardProfile(raw: unknown, index: number): string | null {
  if (!isPlainObject(raw)) return `profiles[${index}]: expected object`;
  for (const key of ['id', 'label', 'vid', 'pid', 'chip', 'offset', 'boardProfile'] as const) {
    if (!isSafeString(raw[key], key === 'label' ? MAX_STRING : 128)) {
      return `profiles[${index}]: invalid ${key}`;
    }
  }
  if (!isFiniteNumber(raw.baud) || raw.baud < 9600) {
    return `profiles[${index}]: invalid baud`;
  }
  return null;
}

function isCatalogEntryShape(e: MarketplaceCatalogEntry): boolean {
  if (
    !e ||
    typeof e.id !== 'string' ||
    !MARKETPLACE_KINDS.has(e.kind) ||
    typeof e.title !== 'string' ||
    typeof e.description !== 'string' ||
    typeof e.author !== 'string' ||
    !Array.isArray(e.tags) ||
    typeof e.packId !== 'string' ||
    (e.packUrl !== undefined && typeof e.packUrl !== 'string') ||
    (e.publisherId !== undefined && typeof e.publisherId !== 'string') ||
    (e.requireSignature !== undefined && typeof e.requireSignature !== 'boolean') ||
    (e.repoUrl !== undefined && typeof e.repoUrl !== 'string') ||
    (e.homepageUrl !== undefined && typeof e.homepageUrl !== 'string') ||
    (e.stars !== undefined && typeof e.stars !== 'number') ||
    (e.userAdded !== undefined && typeof e.userAdded !== 'boolean')
  ) {
    return false;
  }
  if (e.kind === 'github_addon' && typeof e.repoUrl !== 'string') return false;
  if (e.profiles !== undefined) {
    if (!Array.isArray(e.profiles)) return false;
  }
  return true;
}

export function isMarketplaceCatalog(value: unknown): value is MarketplaceCatalog {
  if (!isPlainObject(value)) return false;
  const c = value as unknown as MarketplaceCatalog;
  return (
    typeof c.version === 'number' &&
    Array.isArray(c.entries) &&
    c.entries.every(e => isCatalogEntryShape(e as MarketplaceCatalogEntry))
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

  if (raw.kind === 'board_pack') {
    if (!Array.isArray(raw.profiles)) return { ok: false, error: 'profiles must be an array' };
    if (raw.profiles.length === 0 || raw.profiles.length > MAX_PROFILES) {
      return { ok: false, error: `profiles length must be 1–${MAX_PROFILES}` };
    }
    for (let i = 0; i < raw.profiles.length; i++) {
      const err = validateBoardProfile(raw.profiles[i], i);
      if (err) return { ok: false, error: err };
    }
    const accepted = acceptCommunityCatalog({
      version: 1,
      updatedAt: new Date().toISOString(),
      source: 'marketplace-board-pack',
      profiles: raw.profiles,
    });
    if (!accepted.accepted) {
      return {
        ok: false,
        error: accepted.reason || 'Board pack failed community catalog validation',
      };
    }
    return {
      ok: true,
      pack: {
        format: 'esp32studio-marketplace',
        kind: 'board_pack',
        version: meta.version,
        id: raw.id,
        title: raw.title,
        description: isSafeString(raw.description) ? raw.description : undefined,
        author: isSafeString(raw.author) ? raw.author : undefined,
        publisherId: meta.publisherId,
        signature: meta.signature,
        profiles: accepted.catalog.profiles,
      },
    };
  }

  return {
    ok: false,
    error: 'kind must be widget_pack, rule_pack, or board_pack',
  };
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

export function exportBoardPack(
  profiles: CommunityBoardProfile[],
  meta: {
    id: string;
    title: string;
    description?: string;
    author?: string;
    publisherId?: string;
    version?: MarketplacePackVersion;
  },
): MarketplaceBoardPack {
  return {
    format: 'esp32studio-marketplace',
    kind: 'board_pack',
    version: meta.version ?? 1,
    id: meta.id,
    title: meta.title,
    description: meta.description,
    author: meta.author,
    publisherId: meta.publisherId,
    profiles: profiles.map(p => ({ ...p })),
  };
}

/** Apply a board pack into the local VID:PID flash preset cache (same as community sync). */
export function applyMarketplaceBoardPack(pack: MarketplaceBoardPack): number {
  return applyCommunityCatalog({
    version: 1,
    updatedAt: new Date().toISOString(),
    source: `marketplace:${pack.id}`,
    profiles: pack.profiles,
  });
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
  version: 3,
  updatedAt: '2026-11-17T00:00:00.000Z',
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
      id: 'pack-status-strip-signed',
      kind: 'widget_pack',
      title: 'Pasek statusu (podpis sandbox)',
      titleEn: 'Status strip (sandbox signed)',
      description:
        'Ta sama zawartość co pasek statusu, podpisana kluczem studio-sandbox (demo — nie live).',
      descriptionEn:
        'Same content as status strip, signed with the studio-sandbox demo key (not live).',
      author: 'ESP32 Display Studio',
      tags: ['oled', 'clock', 'status', 'signed', 'sandbox'],
      packId: 'status-strip-signed',
      publisherId: 'studio-sandbox',
      requireSignature: true,
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
    {
      id: 'pack-oled-pet-dash',
      kind: 'widget_pack',
      title: 'OLED: zwierzak + temperatura',
      titleEn: 'OLED: pet + temperature',
      description:
        'Cyber-zwierzak, gauge temperatury i pasek baterii/Wi‑Fi pod 128×64 — inspirowane stackiem SSD1306/U8g2.',
      descriptionEn:
        'Cyber-pet, temperature gauge, and battery/Wi‑Fi strip for 128×64 — inspired by SSD1306/U8g2 stacks.',
      author: 'ESP32 Display Studio',
      tags: ['oled', 'pet', 'gauge', 'ssd1306'],
      packId: 'oled-pet-dash',
      requireSignature: false,
    },
    {
      id: 'pack-usb-bridges',
      kind: 'board_pack',
      title: 'Mostki USB (CH340 / CP210x / CH9102)',
      titleEn: 'USB bridges (CH340 / CP210x / CH9102)',
      description:
        'Profile flash VID:PID dla popularnych mostków UART — ten sam schemat co community board catalog.',
      descriptionEn:
        'Flash VID:PID presets for popular UART bridges — same schema as the community board catalog.',
      author: 'ESP32 Display Studio',
      tags: ['board', 'usb', 'ch340', 'cp210x'],
      packId: 'usb-bridges',
      requireSignature: false,
    },
    {
      id: 'addon-u8g2',
      kind: 'github_addon',
      title: 'U8g2 (monochrome OLED)',
      titleEn: 'U8g2 (monochrome OLED)',
      description:
        'Biblioteka U8g2 dla wyświetlaczy monochromatycznych — naturalny fit dla generatora OLED w Studio.',
      descriptionEn:
        'U8g2 monochrome display library — natural fit for Studio’s OLED generator.',
      author: 'olikraus',
      tags: ['github', 'oled', 'library'],
      packId: 'addon-u8g2',
      repoUrl: 'https://github.com/olikraus/u8g2',
      stars: 6763,
      requireSignature: false,
    },
    {
      id: 'addon-thingpulse-ssd1306',
      kind: 'github_addon',
      title: 'ThingPulse SSD1306/SH1106',
      titleEn: 'ThingPulse SSD1306/SH1106',
      description:
        'Sterownik OLED 128×64 / 128×32 (SSD1306, SH1106) — klasyczny stack pod ESP8266/ESP32.',
      descriptionEn:
        'OLED driver for 128×64 / 128×32 (SSD1306, SH1106) — classic ESP8266/ESP32 stack.',
      author: 'ThingPulse',
      tags: ['github', 'oled', 'ssd1306'],
      packId: 'addon-thingpulse-ssd1306',
      repoUrl: 'https://github.com/ThingPulse/esp8266-oled-ssd1306',
      stars: 2184,
      requireSignature: false,
    },
    {
      id: 'addon-lvgl',
      kind: 'github_addon',
      title: 'LVGL',
      titleEn: 'LVGL',
      description:
        'Pełne embedded UI — inspiracja layoutów widgetów; Studio pozostaje przy data-only packs.',
      descriptionEn:
        'Full embedded UI toolkit — layout inspiration; Studio stays data-only for packs.',
      author: 'lvgl',
      tags: ['github', 'ui', 'graphics'],
      packId: 'addon-lvgl',
      repoUrl: 'https://github.com/lvgl/lvgl',
      stars: 25188,
      requireSignature: false,
    },
    {
      id: 'addon-tft-espi',
      kind: 'github_addon',
      title: 'TFT_eSPI',
      titleEn: 'TFT_eSPI',
      description: 'Biblioteka TFT (Arduino/PlatformIO) — przydatna przy przejściu z OLED na kolorowe panele.',
      descriptionEn:
        'TFT library (Arduino/PlatformIO) — useful when moving from OLED to color panels.',
      author: 'Bodmer',
      tags: ['github', 'tft', 'display'],
      packId: 'addon-tft-espi',
      repoUrl: 'https://github.com/Bodmer/TFT_eSPI',
      stars: 4979,
      requireSignature: false,
    },
    {
      id: 'addon-espasyncwebserver',
      kind: 'github_addon',
      title: 'ESPAsyncWebServer',
      titleEn: 'ESPAsyncWebServer',
      description: 'Async HTTP dla ESP32 — uzupełnienie ścieżek OTA / lokalnego UI urządzenia.',
      descriptionEn: 'Async HTTP for ESP32 — complements OTA / on-device local UI paths.',
      author: 'me-no-dev',
      tags: ['github', 'network', 'ota'],
      packId: 'addon-espasyncwebserver',
      repoUrl: 'https://github.com/me-no-dev/ESPAsyncWebServer',
      stars: 4041,
      requireSignature: false,
    },
    {
      id: 'addon-arduinojson',
      kind: 'github_addon',
      title: 'ArduinoJson',
      titleEn: 'ArduinoJson',
      description: 'JSON na urządzeniu — ten sam model danych co paczki marketplace w Studio.',
      descriptionEn: 'On-device JSON — same data model spirit as Studio marketplace packs.',
      author: 'bblanchon',
      tags: ['github', 'json', 'library'],
      packId: 'addon-arduinojson',
      repoUrl: 'https://github.com/bblanchon/ArduinoJson',
      stars: 7246,
      requireSignature: false,
    },
    {
      id: 'addon-fastled',
      kind: 'github_addon',
      title: 'FastLED',
      titleEn: 'FastLED',
      description: 'Animacje LED — wizualny companion dla widgetów sparkline / status.',
      descriptionEn: 'LED animations — visual companion for sparkline / status widgets.',
      author: 'FastLED',
      tags: ['github', 'led', 'graphics'],
      packId: 'addon-fastled',
      repoUrl: 'https://github.com/FastLED/FastLED',
      stars: 7536,
      requireSignature: false,
    },
    {
      id: 'addon-ble-keyboard',
      kind: 'github_addon',
      title: 'ESP32 BLE Keyboard',
      titleEn: 'ESP32 BLE Keyboard',
      description: 'Biblioteka HID klawiatury BLE — pasuje do ścieżki Bluetooth w Studio.',
      descriptionEn: 'BLE HID keyboard library — fits Studio’s Bluetooth path.',
      author: 'T-vK',
      tags: ['github', 'bluetooth', 'ble'],
      packId: 'addon-ble-keyboard',
      repoUrl: 'https://github.com/T-vK/ESP32-BLE-Keyboard',
      stars: 3201,
      requireSignature: false,
    },
    {
      id: 'addon-awesome-esp',
      kind: 'github_addon',
      title: 'awesome-esp',
      titleEn: 'awesome-esp',
      description: 'Kuratorska lista projektów ESP8266/ESP32 — punkt startowy do dalszych add-onów.',
      descriptionEn: 'Curated ESP8266/ESP32 project list — starting point for more add-ons.',
      author: 'agucova',
      tags: ['github', 'awesome', 'meta'],
      packId: 'addon-awesome-esp',
      repoUrl: 'https://github.com/agucova/awesome-esp',
      stars: 2816,
      requireSignature: false,
    },
  ],
};

/** Public keys mirrored from public/marketplace/publishers.json (public only). */
export const BUNDLED_MARKETPLACE_PUBLISHERS: MarketplacePublisher[] = [
  {
    id: 'studio-sandbox',
    name: 'ESP32 Display Studio (sandbox demo)',
    sandbox: true,
    publicKeyB64: 'Bhw2FJmZy0hF0C61NXHfkhvv6Qv4tkjp76UREuNl4Zc=',
  },
];

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
  'status-strip-signed': {
    format: 'esp32studio-marketplace',
    kind: 'widget_pack',
    version: 2,
    id: 'status-strip-signed',
    title: 'Status strip (sandbox signed)',
    author: 'ESP32 Display Studio',
    description:
      'SANDBOX demo — signed with studio-sandbox disposable key. Not a live publisher.',
    publisherId: 'studio-sandbox',
    signature:
      'NkAhqZiCrzbMdKpEHr93cDe4ZFIorDzYOh/viRTiu5K+N4tKJTg2SdwP9L4zoepF//4ObaQqJeLuGG6NEIezBg==',
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
  'oled-pet-dash': {
    format: 'esp32studio-marketplace',
    kind: 'widget_pack',
    version: 1,
    id: 'oled-pet-dash',
    title: 'OLED pet + temperature',
    author: 'ESP32 Display Studio',
    description: '128×64 pet dashboard inspired by SSD1306/U8g2 community stacks.',
    widgets: [
      {
        id: 'm_pet',
        type: 'cyber_pet',
        x: 4,
        y: 4,
        width: 56,
        height: 40,
      },
      {
        id: 'm_temp',
        type: 'gauge',
        x: 64,
        y: 4,
        width: 60,
        height: 40,
        label: 'Temp',
        binding: 'temp',
        minVal: 0,
        maxVal: 40,
        unit: '°C',
        showNumericValue: true,
      },
      {
        id: 'm_batt_wifi_dash',
        type: 'battery_wifi',
        x: 4,
        y: 46,
        width: 120,
        height: 16,
      },
    ],
  },
  'usb-bridges': {
    format: 'esp32studio-marketplace',
    kind: 'board_pack',
    version: 1,
    id: 'usb-bridges',
    title: 'USB bridges',
    author: 'ESP32 Display Studio',
    description: 'CH340 / CP210x / CH9102 flash presets (community board-catalog schema).',
    profiles: [
      {
        id: 'cp210x-generic-esp32',
        label: 'Generic ESP32 (CP210x)',
        vid: '10c4',
        pid: 'ea60',
        chip: 'esp32',
        offset: '0x1000',
        baud: 921600,
        boardProfile: 'esp32',
      },
      {
        id: 'ch340-generic-esp32',
        label: 'Generic ESP32 (CH340)',
        vid: '1a86',
        pid: '7523',
        chip: 'esp32',
        offset: '0x1000',
        baud: 921600,
        boardProfile: 'esp32',
      },
      {
        id: 'ch9102-generic-esp32',
        label: 'Generic ESP32 (CH9102)',
        vid: '1a86',
        pid: '55d4',
        chip: 'esp32',
        offset: '0x1000',
        baud: 921600,
        boardProfile: 'esp32',
      },
      {
        id: 'cp210x-esp32-s3-bridge',
        label: 'ESP32-S3 via CP210x UART bridge',
        vid: '10c4',
        pid: 'ea60',
        chip: 'esp32s3',
        offset: '0x0',
        baud: 921600,
        boardProfile: 'esp32s3',
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
 * Humans add live keys after `scripts/marketplace/sign-pack.mjs --generate`.
 * Never commit private keys. Sandbox demo public key is bundled for fixtures.
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
    sandbox: !!publisher.sandbox,
  });
}

/** Register bundled sandbox / fixture publisher public keys (no network). */
export function registerBundledMarketplacePublishers(): number {
  let n = 0;
  for (const p of BUNDLED_MARKETPLACE_PUBLISHERS) {
    try {
      registerTrustedPublisher(p);
      n += 1;
    } catch {
      // skip malformed bundled entries
    }
  }
  return n;
}

function registerPublishersFromDocument(json: unknown): number {
  if (!isPlainObject(json) || !Array.isArray(json.publishers)) return 0;
  let n = 0;
  for (const item of json.publishers) {
    if (!isPlainObject(item)) continue;
    if (typeof item.id !== 'string' || typeof item.publicKeyB64 !== 'string') {
      continue;
    }
    try {
      registerTrustedPublisher({
        id: item.id,
        name: typeof item.name === 'string' ? item.name : item.id,
        publicKeyB64: item.publicKeyB64,
        sandbox: item.sandbox === true,
      });
      n += 1;
    } catch {
      // skip malformed entries
    }
  }
  return n;
}

export async function loadTrustedPublishersFromJson(
  url = '/marketplace/publishers.json',
): Promise<number> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return registerBundledMarketplacePublishers();
    const json: unknown = await res.json();
    const n = registerPublishersFromDocument(json);
    if (n === 0) return registerBundledMarketplacePublishers();
    return n;
  } catch {
    return registerBundledMarketplacePublishers();
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
  if (entry.kind === 'github_addon') {
    return {
      ok: false,
      error: 'github_addon entries open a repository link — they are not installable packs',
    };
  }

  let result: MarketplaceParseResult;

  if (entry.kind === 'board_pack' && entry.profiles && entry.profiles.length > 0) {
    result = parseMarketplacePack({
      format: 'esp32studio-marketplace',
      kind: 'board_pack',
      version: 1,
      id: entry.packId || entry.id,
      title: entry.title,
      description: entry.description,
      author: entry.author,
      profiles: entry.profiles,
    });
  } else if (entry.packUrl) {
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
