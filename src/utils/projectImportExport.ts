/**
 * Single parser + v1 migration for .esp32studio / project JSON.
 * Import validates size, fields, and screen–widget–automation relations,
 * then returns a complete state snapshot for an atomic React commit.
 * Share export strips credentials; full export keeps them.
 */

import type {
  ActionType,
  ApiIntegrationsConfig,
  AutomationRule,
  BusType,
  DisplayConfig,
  DisplayModel,
  DisplayTheme,
  PetMood,
  Screen,
  SystemConfig,
  TouchControllerType,
  TriggerType,
  UIWidget,
  WidgetType,
} from '../types';
import {
  DEFAULT_API_CONFIG,
  DEFAULT_DISPLAY_CONFIG,
  DEFAULT_SYSTEM_CONFIG,
} from './presets';

export const PROJECT_FORMAT = 'esp32studio' as const;
export const PROJECT_FORMAT_VERSION = 1 as const;

/** Reject oversized paste / file before JSON.parse. */
export const MAX_PROJECT_BYTES = 1_500_000;
export const MAX_SCREENS = 32;
export const MAX_WIDGETS_PER_SCREEN = 48;
export const MAX_AUTOMATIONS = 64;
export const MAX_STRING = 512;
export const MAX_ID = 128;
export const MAX_DEPTH = 12;

export type ProjectExportMode = 'share' | 'full';

export interface ProjectDocumentV1 {
  format: typeof PROJECT_FORMAT;
  version: typeof PROJECT_FORMAT_VERSION;
  displayConfig: DisplayConfig;
  systemConfig: SystemConfig;
  apiConfig: ApiIntegrationsConfig;
  screens: Screen[];
  automations: AutomationRule[];
  activeScreenIndex?: number;
  exportedAt?: string;
  /** Present on share exports so importers know secrets were stripped. */
  credentialsIncluded?: boolean;
}

export interface ParsedProjectState {
  displayConfig: DisplayConfig;
  systemConfig: SystemConfig;
  apiConfig: ApiIntegrationsConfig;
  screens: Screen[];
  automations: AutomationRule[];
  activeScreenIndex: number;
}

export type ParseProjectResult =
  | { ok: true; project: ParsedProjectState }
  | { ok: false; error: string };

const DISPLAY_MODELS = new Set<DisplayModel>([
  'ssd1306_128x64',
  'ssd1306_128x32',
  'sh1106_128x64',
  'st7789_240x240',
  'st7789_135x240',
  'ili9341_320x240',
  'gc9a01_240x240_round',
]);

const BUS_TYPES = new Set<BusType>(['i2c', 'spi']);

const DISPLAY_THEMES = new Set<DisplayTheme>([
  'oled_neon_blue',
  'oled_pure_white',
  'crt_amber',
  'terminal_green',
  'cyberpunk_cyan_pink',
  'ips_rgb_full',
  'epaper_bw',
]);

const TOUCH_CONTROLLERS = new Set<TouchControllerType>([
  'none',
  'cst816s',
  'ft6236',
  'xpt2046',
  'gt911',
  'capacitive_gpio',
]);

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function isSafeString(v: unknown, max = MAX_STRING): v is string {
  return typeof v === 'string' && v.length <= max;
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
    const err = scanForbiddenKeys(v, depth + 1);
    if (err) return err;
  }
  return null;
}

function byteLengthUtf8(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  // Fallback for exotic hosts
  return unescape(encodeURIComponent(text)).length;
}

/** Strip Wi‑Fi / OTA passwords and weather API key for shareable exports. */
export function stripProjectCredentials(
  systemConfig: SystemConfig,
  apiConfig: ApiIntegrationsConfig
): { systemConfig: SystemConfig; apiConfig: ApiIntegrationsConfig } {
  return {
    systemConfig: {
      ...systemConfig,
      wifiPassword: '',
      otaPassword: '',
    },
    apiConfig: {
      ...apiConfig,
      weather: {
        ...apiConfig.weather,
        apiKey: '',
      },
    },
  };
}

export function buildProjectExport(
  state: {
    displayConfig: DisplayConfig;
    systemConfig: SystemConfig;
    apiConfig: ApiIntegrationsConfig;
    screens: Screen[];
    automations: AutomationRule[];
    activeScreenIndex?: number;
  },
  mode: ProjectExportMode
): ProjectDocumentV1 {
  const secrets =
    mode === 'share'
      ? stripProjectCredentials(state.systemConfig, state.apiConfig)
      : { systemConfig: state.systemConfig, apiConfig: state.apiConfig };

  return {
    format: PROJECT_FORMAT,
    version: PROJECT_FORMAT_VERSION,
    displayConfig: state.displayConfig,
    systemConfig: secrets.systemConfig,
    apiConfig: secrets.apiConfig,
    screens: state.screens,
    automations: state.automations,
    activeScreenIndex:
      typeof state.activeScreenIndex === 'number' && state.activeScreenIndex >= 0
        ? state.activeScreenIndex
        : 0,
    exportedAt: new Date().toISOString(),
    credentialsIncluded: mode === 'full',
  };
}

function validateWidget(raw: unknown, screenIndex: number, widgetIndex: number): string | null {
  if (!isPlainObject(raw)) {
    return `screens[${screenIndex}].widgets[${widgetIndex}]: expected object`;
  }
  if (!isSafeString(raw.id, MAX_ID)) {
    return `screens[${screenIndex}].widgets[${widgetIndex}]: invalid id`;
  }
  if (typeof raw.type !== 'string' || !WIDGET_TYPES.has(raw.type as WidgetType)) {
    return `screens[${screenIndex}].widgets[${widgetIndex}]: unknown type`;
  }
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    if (!isFiniteNumber(raw[key])) {
      return `screens[${screenIndex}].widgets[${widgetIndex}]: invalid ${key}`;
    }
  }
  if (raw.label !== undefined && !isSafeString(raw.label)) {
    return `screens[${screenIndex}].widgets[${widgetIndex}]: label too long`;
  }
  if (
    raw.petMood !== undefined &&
    (typeof raw.petMood !== 'string' || !PET_MOODS.has(raw.petMood as PetMood))
  ) {
    return `screens[${screenIndex}].widgets[${widgetIndex}]: unknown petMood`;
  }
  return null;
}

function validateScreen(raw: unknown, index: number): string | null {
  if (!isPlainObject(raw)) return `screens[${index}]: expected object`;
  if (!isSafeString(raw.id, MAX_ID)) return `screens[${index}]: invalid id`;
  if (!isSafeString(raw.name)) return `screens[${index}]: invalid name`;
  if (!Array.isArray(raw.widgets)) return `screens[${index}]: widgets must be an array`;
  if (raw.widgets.length > MAX_WIDGETS_PER_SCREEN) {
    return `screens[${index}]: too many widgets (max ${MAX_WIDGETS_PER_SCREEN})`;
  }
  const widgetIds = new Set<string>();
  for (let i = 0; i < raw.widgets.length; i++) {
    const err = validateWidget(raw.widgets[i], index, i);
    if (err) return err;
    const id = (raw.widgets[i] as UIWidget).id;
    if (widgetIds.has(id)) {
      return `screens[${index}]: duplicate widget id "${id}"`;
    }
    widgetIds.add(id);
  }
  return null;
}

function validateAutomation(
  raw: unknown,
  index: number,
  screenIds: Set<string>
): string | null {
  if (!isPlainObject(raw)) return `automations[${index}]: expected object`;
  if (!isSafeString(raw.id, MAX_ID)) return `automations[${index}]: invalid id`;
  if (!isSafeString(raw.name)) return `automations[${index}]: invalid name`;
  if (typeof raw.enabled !== 'boolean') {
    return `automations[${index}]: enabled must be boolean`;
  }
  if (!isPlainObject(raw.trigger)) return `automations[${index}]: missing trigger`;
  if (
    typeof raw.trigger.type !== 'string' ||
    !TRIGGER_TYPES.has(raw.trigger.type as TriggerType)
  ) {
    return `automations[${index}]: unknown trigger type`;
  }
  if (!isPlainObject(raw.action)) return `automations[${index}]: missing action`;
  if (
    typeof raw.action.type !== 'string' ||
    !ACTION_TYPES.has(raw.action.type as ActionType)
  ) {
    return `automations[${index}]: unknown action type`;
  }
  if (
    raw.action.petMood !== undefined &&
    (typeof raw.action.petMood !== 'string' ||
      !PET_MOODS.has(raw.action.petMood as PetMood))
  ) {
    return `automations[${index}]: unknown petMood`;
  }
  if (raw.action.type === 'switch_screen') {
    const target = raw.action.targetScreenId;
    if (target !== undefined) {
      if (!isSafeString(target, MAX_ID)) {
        return `automations[${index}]: invalid targetScreenId`;
      }
      if (!screenIds.has(target)) {
        return `automations[${index}]: targetScreenId "${target}" does not match any screen`;
      }
    }
  }
  return null;
}

function validateDisplayConfig(raw: unknown): string | null {
  if (!isPlainObject(raw)) return 'displayConfig: expected object';
  if (typeof raw.model !== 'string' || !DISPLAY_MODELS.has(raw.model as DisplayModel)) {
    return 'displayConfig: unknown model';
  }
  if (typeof raw.bus !== 'string' || !BUS_TYPES.has(raw.bus as BusType)) {
    return 'displayConfig: unknown bus';
  }
  if (typeof raw.theme !== 'string' || !DISPLAY_THEMES.has(raw.theme as DisplayTheme)) {
    return 'displayConfig: unknown theme';
  }
  for (const key of ['width', 'height'] as const) {
    if (!isFiniteNumber(raw[key]) || (raw[key] as number) <= 0) {
      return `displayConfig: invalid ${key}`;
    }
  }
  if (raw.touchController !== undefined) {
    if (
      typeof raw.touchController !== 'string' ||
      !TOUCH_CONTROLLERS.has(raw.touchController as TouchControllerType)
    ) {
      return 'displayConfig: unknown touchController';
    }
  }
  return null;
}

function validateSystemConfig(raw: unknown, screenCount: number): string | null {
  if (!isPlainObject(raw)) return 'systemConfig: expected object';
  if (raw.wifiSsid !== undefined && !isSafeString(raw.wifiSsid)) {
    return 'systemConfig: wifiSsid too long';
  }
  if (raw.wifiPassword !== undefined && !isSafeString(raw.wifiPassword)) {
    return 'systemConfig: wifiPassword too long';
  }
  if (raw.otaPassword !== undefined && !isSafeString(raw.otaPassword)) {
    return 'systemConfig: otaPassword too long';
  }
  if (raw.mdnsName !== undefined && !isSafeString(raw.mdnsName, MAX_ID)) {
    return 'systemConfig: invalid mdnsName';
  }
  if (
    raw.usbSwitchScreenIndex !== undefined &&
    (!isFiniteNumber(raw.usbSwitchScreenIndex) ||
      raw.usbSwitchScreenIndex < 0 ||
      raw.usbSwitchScreenIndex >= screenCount)
  ) {
    return 'systemConfig: usbSwitchScreenIndex out of range';
  }
  return null;
}

function validateApiConfig(raw: unknown): string | null {
  if (!isPlainObject(raw)) return 'apiConfig: expected object';
  if (raw.weather !== undefined) {
    if (!isPlainObject(raw.weather)) return 'apiConfig.weather: expected object';
    if (raw.weather.apiKey !== undefined && !isSafeString(raw.weather.apiKey)) {
      return 'apiConfig.weather: apiKey too long';
    }
    if (raw.weather.city !== undefined && !isSafeString(raw.weather.city)) {
      return 'apiConfig.weather: city too long';
    }
  }
  if (raw.pcMonitor !== undefined && !isPlainObject(raw.pcMonitor)) {
    return 'apiConfig.pcMonitor: expected object';
  }
  if (raw.notifications !== undefined && !isPlainObject(raw.notifications)) {
    return 'apiConfig.notifications: expected object';
  }
  return null;
}

function mergeDisplayConfig(raw: Record<string, unknown>): DisplayConfig {
  return {
    ...DEFAULT_DISPLAY_CONFIG,
    ...(raw as unknown as DisplayConfig),
  };
}

function mergeSystemConfig(raw: Record<string, unknown>): SystemConfig {
  return {
    ...DEFAULT_SYSTEM_CONFIG,
    ...(raw as unknown as SystemConfig),
    customPinFunctions: {
      ...DEFAULT_SYSTEM_CONFIG.customPinFunctions,
      ...((raw.customPinFunctions as SystemConfig['customPinFunctions']) || {}),
    },
  };
}

function mergeApiConfig(raw: Record<string, unknown>): ApiIntegrationsConfig {
  const weather = isPlainObject(raw.weather) ? raw.weather : {};
  const pcMonitor = isPlainObject(raw.pcMonitor) ? raw.pcMonitor : {};
  const notifications = isPlainObject(raw.notifications) ? raw.notifications : {};
  const weatherData = isPlainObject(weather.data) ? weather.data : {};
  const pcData = isPlainObject(pcMonitor.data) ? pcMonitor.data : {};
  return {
    weather: {
      ...DEFAULT_API_CONFIG.weather,
      ...(weather as unknown as ApiIntegrationsConfig['weather']),
      data: {
        ...DEFAULT_API_CONFIG.weather.data,
        ...(weatherData as unknown as ApiIntegrationsConfig['weather']['data']),
      },
    },
    pcMonitor: {
      ...DEFAULT_API_CONFIG.pcMonitor,
      ...(pcMonitor as unknown as ApiIntegrationsConfig['pcMonitor']),
      data: {
        ...DEFAULT_API_CONFIG.pcMonitor.data,
        ...(pcData as unknown as ApiIntegrationsConfig['pcMonitor']['data']),
      },
    },
    notifications: {
      ...DEFAULT_API_CONFIG.notifications,
      ...(notifications as unknown as ApiIntegrationsConfig['notifications']),
      list: Array.isArray(notifications.list)
        ? (notifications.list as ApiIntegrationsConfig['notifications']['list'])
        : DEFAULT_API_CONFIG.notifications.list,
    },
  };
}

function resolveActiveScreenIndex(
  requested: unknown,
  screenCount: number
): number {
  if (
    isFiniteNumber(requested) &&
    Number.isInteger(requested) &&
    requested >= 0 &&
    requested < screenCount
  ) {
    return requested;
  }
  return 0;
}

/**
 * Migrate legacy / v1 payloads into a validated ParsedProjectState.
 * Rejects foreign format names and unsupported version numbers.
 */
export function parseProject(raw: unknown): ParseProjectResult {
  const forbidden = scanForbiddenKeys(raw);
  if (forbidden) return { ok: false, error: forbidden };

  if (!isPlainObject(raw)) {
    return { ok: false, error: 'Project must be a JSON object' };
  }

  // Foreign / future formats
  if (raw.format !== undefined && raw.format !== PROJECT_FORMAT) {
    return {
      ok: false,
      error: `Unsupported project format "${String(raw.format)}" (want ${PROJECT_FORMAT})`,
    };
  }
  if (raw.version !== undefined) {
    if (!isFiniteNumber(raw.version) || raw.version !== PROJECT_FORMAT_VERSION) {
      return {
        ok: false,
        error: `Unsupported project version ${String(raw.version)} (want ${PROJECT_FORMAT_VERSION})`,
      };
    }
  }

  // Minimal shape for migration into v1
  if (!Array.isArray(raw.screens)) {
    return { ok: false, error: 'screens must be an array' };
  }
  if (raw.screens.length === 0) {
    return { ok: false, error: 'screens must not be empty' };
  }
  if (raw.screens.length > MAX_SCREENS) {
    return { ok: false, error: `Too many screens (max ${MAX_SCREENS})` };
  }

  const screenIds = new Set<string>();
  for (let i = 0; i < raw.screens.length; i++) {
    const err = validateScreen(raw.screens[i], i);
    if (err) return { ok: false, error: err };
    const id = (raw.screens[i] as Screen).id;
    if (screenIds.has(id)) {
      return { ok: false, error: `Duplicate screen id "${id}"` };
    }
    screenIds.add(id);
  }

  const automationsRaw = raw.automations === undefined ? [] : raw.automations;
  if (!Array.isArray(automationsRaw)) {
    return { ok: false, error: 'automations must be an array' };
  }
  if (automationsRaw.length > MAX_AUTOMATIONS) {
    return { ok: false, error: `Too many automations (max ${MAX_AUTOMATIONS})` };
  }
  const automationIds = new Set<string>();
  for (let i = 0; i < automationsRaw.length; i++) {
    const err = validateAutomation(automationsRaw[i], i, screenIds);
    if (err) return { ok: false, error: err };
    const id = (automationsRaw[i] as AutomationRule).id;
    if (automationIds.has(id)) {
      return { ok: false, error: `Duplicate automation id "${id}"` };
    }
    automationIds.add(id);
  }

  // Allow omitted displayConfig (migrate from defaults); reject bad present config
  if (raw.displayConfig !== undefined) {
    const err = validateDisplayConfig(raw.displayConfig);
    if (err) return { ok: false, error: err };
  }

  if (raw.systemConfig !== undefined) {
    const err = validateSystemConfig(raw.systemConfig, raw.screens.length);
    if (err) return { ok: false, error: err };
  }

  if (raw.apiConfig !== undefined) {
    const err = validateApiConfig(raw.apiConfig);
    if (err) return { ok: false, error: err };
  }

  const displayConfig = mergeDisplayConfig(
    isPlainObject(raw.displayConfig) ? raw.displayConfig : {}
  );
  let systemConfig = mergeSystemConfig(
    isPlainObject(raw.systemConfig) ? raw.systemConfig : {}
  );
  // Clamp USB switch index after merge if still out of range (defaults may exceed)
  if (
    systemConfig.usbSwitchScreenIndex < 0 ||
    systemConfig.usbSwitchScreenIndex >= raw.screens.length
  ) {
    systemConfig = { ...systemConfig, usbSwitchScreenIndex: 0 };
  }

  const apiConfig = mergeApiConfig(
    isPlainObject(raw.apiConfig) ? raw.apiConfig : {}
  );

  const activeScreenIndex = resolveActiveScreenIndex(
    raw.activeScreenIndex,
    raw.screens.length
  );

  return {
    ok: true,
    project: {
      displayConfig,
      systemConfig,
      apiConfig,
      screens: raw.screens as Screen[],
      automations: automationsRaw as AutomationRule[],
      activeScreenIndex,
    },
  };
}

export function parseProjectJson(text: string): ParseProjectResult {
  if (typeof text !== 'string') {
    return { ok: false, error: 'Project payload must be text' };
  }
  if (byteLengthUtf8(text) > MAX_PROJECT_BYTES) {
    return {
      ok: false,
      error: `Project file too large (max ${MAX_PROJECT_BYTES} bytes)`,
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
  return parseProject(raw);
}
