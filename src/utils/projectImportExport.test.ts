import {
  DEFAULT_API_CONFIG,
  DEFAULT_DISPLAY_CONFIG,
  DEFAULT_SYSTEM_CONFIG,
  PRESET_AUTOMATION_RULES,
  PRESET_CYBER_PET_SCREENS,
} from './presets';
import {
  MAX_PROJECT_BYTES,
  buildProjectExport,
  clampUsbSwitchScreenIndex,
  normalizeProjectRelations,
  parseProject,
  parseProjectJson,
  reconcileAutomationsForScreens,
  stripProjectCredentials,
} from './projectImportExport';
import type { AutomationRule } from '../types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function legalV1Payload() {
  return {
    format: 'esp32studio',
    version: 1,
    displayConfig: DEFAULT_DISPLAY_CONFIG,
    systemConfig: {
      ...DEFAULT_SYSTEM_CONFIG,
      wifiPassword: 'secret-wifi',
      otaPassword: 'secret-ota',
      usbSwitchScreenIndex: 0,
    },
    apiConfig: {
      ...DEFAULT_API_CONFIG,
      weather: { ...DEFAULT_API_CONFIG.weather, apiKey: 'owm-secret' },
    },
    screens: PRESET_CYBER_PET_SCREENS,
    automations: PRESET_AUTOMATION_RULES,
    activeScreenIndex: 1,
  };
}

// --- Legal v1 ---
{
  const raw = legalV1Payload();
  const result = parseProject(raw);
  assert(result.ok, 'legal v1 parses');
  if (result.ok) {
    assert(result.project.screens.length === PRESET_CYBER_PET_SCREENS.length, 'screens kept');
    assert(result.project.activeScreenIndex === 1, 'active screen from file');
    assert(result.project.systemConfig.wifiPassword === 'secret-wifi', 'wifi kept on import');
    assert(result.project.apiConfig.weather.apiKey === 'owm-secret', 'api key kept on import');
  }

  const jsonResult = parseProjectJson(JSON.stringify(raw));
  assert(jsonResult.ok, 'legal v1 JSON parses');
}

// Legacy shape without format/version migrates to v1
{
  const legacy = {
    screens: [
      {
        id: 's1',
        name: 'Only',
        widgets: [{ id: 'w1', type: 'text', x: 0, y: 0, width: 10, height: 10, label: 'Hi' }],
      },
    ],
    automations: [],
  };
  const result = parseProject(legacy);
  assert(result.ok, 'legacy migrates');
  if (result.ok) {
    assert(result.project.activeScreenIndex === 0, 'legacy active defaults to 0');
    assert(result.project.displayConfig.model === DEFAULT_DISPLAY_CONFIG.model, 'defaults merged');
  }
}

// --- Foreign versions / formats ---
{
  const badVersion = parseProject({ ...legalV1Payload(), version: 99 });
  assert(!badVersion.ok, 'rejects foreign version');
  assert(
    badVersion.ok === false && badVersion.error.includes('version'),
    'version error mentions version'
  );

  const badFormat = parseProject({ ...legalV1Payload(), format: 'otherstudio' });
  assert(!badFormat.ok, 'rejects foreign format');
  assert(
    badFormat.ok === false && badFormat.error.includes('format'),
    'format error mentions format'
  );
}

// --- Bad fields ---
{
  const badModel = parseProject({
    ...legalV1Payload(),
    displayConfig: { ...DEFAULT_DISPLAY_CONFIG, model: 'not_a_display' },
  });
  assert(!badModel.ok, 'rejects unknown display model');

  const badWidget = parseProject({
    format: 'esp32studio',
    version: 1,
    screens: [
      {
        id: 's1',
        name: 'Bad',
        widgets: [{ id: 'w1', type: 'malware', x: 0, y: 0, width: 1, height: 1 }],
      },
    ],
  });
  assert(!badWidget.ok, 'rejects unknown widget type');

  const badRelation = parseProject({
    format: 'esp32studio',
    version: 1,
    screens: [
      {
        id: 's1',
        name: 'Only',
        widgets: [{ id: 'w1', type: 'text', x: 0, y: 0, width: 10, height: 10 }],
      },
    ],
    automations: [
      {
        id: 'a1',
        name: 'Jump nowhere',
        enabled: true,
        trigger: { type: 'pir_motion' },
        action: { type: 'switch_screen', targetScreenId: 'missing_screen' },
      },
    ],
  });
  assert(!badRelation.ok, 'rejects automation targeting missing screen');
  assert(
    badRelation.ok === false && badRelation.error.includes('targetScreenId'),
    'relation error names targetScreenId'
  );

  const forbidden = parseProject({
    format: 'esp32studio',
    version: 1,
    screens: [
      {
        id: 's1',
        name: 'Evil',
        widgets: [
          {
            id: 'w1',
            type: 'text',
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            script: 'alert(1)',
          },
        ],
      },
    ],
  });
  assert(!forbidden.ok, 'rejects forbidden script key');
}

// --- Empty screens ---
{
  const empty = parseProject({
    format: 'esp32studio',
    version: 1,
    screens: [],
    automations: [],
  });
  assert(!empty.ok, 'rejects empty screens');
  assert(empty.ok === false && empty.error.includes('empty'), 'empty screens message');
}

// --- Size limit ---
{
  const huge = 'x'.repeat(MAX_PROJECT_BYTES + 10);
  const result = parseProjectJson(`{"format":"esp32studio","version":1,"screens":[],"pad":"${huge}"}`);
  assert(!result.ok, 'rejects oversized payload');
  assert(result.ok === false && result.error.includes('large'), 'size error');
}

// --- Export modes ---
{
  const state = {
    displayConfig: DEFAULT_DISPLAY_CONFIG,
    systemConfig: {
      ...DEFAULT_SYSTEM_CONFIG,
      wifiPassword: 'keep-me-wifi',
      otaPassword: 'keep-me-ota',
    },
    apiConfig: {
      ...DEFAULT_API_CONFIG,
      weather: { ...DEFAULT_API_CONFIG.weather, apiKey: 'keep-me-key' },
    },
    screens: PRESET_CYBER_PET_SCREENS,
    automations: PRESET_AUTOMATION_RULES,
    activeScreenIndex: 0,
  };

  const share = buildProjectExport(state, 'share');
  assert(share.format === 'esp32studio', 'share format');
  assert(share.version === 1, 'share version');
  assert(share.credentialsIncluded === false, 'share marks credentials stripped');
  assert(share.systemConfig.wifiPassword === '', 'share strips wifi');
  assert(share.systemConfig.otaPassword === '', 'share strips ota');
  assert(share.apiConfig.weather.apiKey === '', 'share strips weather key');
  assert(state.systemConfig.wifiPassword === 'keep-me-wifi', 'share does not mutate source');

  const full = buildProjectExport(state, 'full');
  assert(full.credentialsIncluded === true, 'full marks credentials included');
  assert(full.systemConfig.wifiPassword === 'keep-me-wifi', 'full keeps wifi');
  assert(full.systemConfig.otaPassword === 'keep-me-ota', 'full keeps ota');
  assert(full.apiConfig.weather.apiKey === 'keep-me-key', 'full keeps weather key');

  const stripped = stripProjectCredentials(state.systemConfig, state.apiConfig);
  assert(stripped.systemConfig.wifiPassword === '', 'helper strips wifi');
  assert(stripped.apiConfig.weather.apiKey === '', 'helper strips api key');
}

// Round-trip: share export re-imports cleanly
{
  const exported = buildProjectExport(
    {
      displayConfig: DEFAULT_DISPLAY_CONFIG,
      systemConfig: { ...DEFAULT_SYSTEM_CONFIG, usbSwitchScreenIndex: 0 },
      apiConfig: DEFAULT_API_CONFIG,
      screens: PRESET_CYBER_PET_SCREENS.slice(0, 1),
      automations: [],
      activeScreenIndex: 0,
    },
    'share'
  );
  const again = parseProjectJson(JSON.stringify(exported));
  assert(again.ok, 'share export round-trips');
}

// --- Codex P2: reconcile dangling automation targets on export ---
{
  const screens = PRESET_CYBER_PET_SCREENS.slice(0, 1);
  const dangling: AutomationRule[] = [
    {
      id: 'a-dangle',
      name: 'Jump deleted',
      enabled: false,
      trigger: { type: 'pir_motion' },
      action: { type: 'switch_screen', targetScreenId: 'screen_gone' },
    },
    {
      id: 'a-ok',
      name: 'Stay',
      enabled: true,
      trigger: { type: 'boot_button_pressed' },
      action: { type: 'switch_screen', targetScreenId: screens[0].id },
    },
  ];
  const cleaned = reconcileAutomationsForScreens(dangling, screens);
  assert(cleaned[0].action.targetScreenId === undefined, 'dangling target cleared');
  assert(cleaned[0].enabled === false, 'disabled rule preserved');
  assert(cleaned[1].action.targetScreenId === screens[0].id, 'valid target kept');

  const exported = buildProjectExport(
    {
      displayConfig: DEFAULT_DISPLAY_CONFIG,
      systemConfig: { ...DEFAULT_SYSTEM_CONFIG, usbSwitchScreenIndex: 0 },
      apiConfig: DEFAULT_API_CONFIG,
      screens,
      automations: dangling,
      activeScreenIndex: 0,
    },
    'share'
  );
  const reimport = parseProject(exported);
  assert(reimport.ok, 'export with previously-dangling targets reimports');
}

// --- Codex P2: customPinFunctions is complete replacement ---
{
  const freed = {
    format: 'esp32studio',
    version: 1,
    displayConfig: DEFAULT_DISPLAY_CONFIG,
    systemConfig: {
      ...DEFAULT_SYSTEM_CONFIG,
      usbSwitchScreenIndex: 0,
      // GPIO 23 deliberately freed (GPIO_FREE deletes the key)
      customPinFunctions: {
        21: 'I2C_SDA',
        22: 'I2C_SCL',
      },
    },
    screens: [
      {
        id: 's1',
        name: 'Only',
        widgets: [{ id: 'w1', type: 'text', x: 0, y: 0, width: 10, height: 10 }],
      },
    ],
    automations: [],
  };
  const result = parseProject(freed);
  assert(result.ok, 'freed pins parse');
  if (result.ok) {
    const pins = result.project.systemConfig.customPinFunctions || {};
    assert(pins[23] === undefined, 'GPIO 23 stays free (not restored to SPI_MOSI)');
    assert(pins[21] === 'I2C_SDA', 'kept assignment preserved');
    assert(
      Object.keys(pins).length === 2,
      'defaults not merged back over explicit map'
    );
  }

  const omittedPins = parseProject({
    format: 'esp32studio',
    version: 1,
    screens: [
      {
        id: 's1',
        name: 'Only',
        widgets: [{ id: 'w1', type: 'text', x: 0, y: 0, width: 10, height: 10 }],
      },
    ],
  });
  assert(omittedPins.ok, 'omitted pin map uses defaults');
  if (omittedPins.ok) {
    assert(
      omittedPins.project.systemConfig.customPinFunctions?.[23] === 'SPI_MOSI',
      'defaults applied when customPinFunctions omitted'
    );
  }
}

// --- Codex P2: stale usbSwitchScreenIndex clamped (import + export) ---
{
  assert(clampUsbSwitchScreenIndex(2, 2) === 1, 'clamp 2→1 for 2 screens');
  assert(clampUsbSwitchScreenIndex(2, 1) === 0, 'clamp 2→0 for 1 screen');

  const staleUsb = parseProject({
    format: 'esp32studio',
    version: 1,
    systemConfig: {
      ...DEFAULT_SYSTEM_CONFIG,
      usbSwitchScreenIndex: 2,
    },
    screens: [
      {
        id: 's1',
        name: 'Only',
        widgets: [{ id: 'w1', type: 'text', x: 0, y: 0, width: 10, height: 10 }],
      },
    ],
    automations: [],
  });
  assert(staleUsb.ok, 'stale usb index imports via clamp');
  if (staleUsb.ok) {
    assert(
      staleUsb.project.systemConfig.usbSwitchScreenIndex === 0,
      'usb index clamped to 0'
    );
  }

  const exported = buildProjectExport(
    {
      displayConfig: DEFAULT_DISPLAY_CONFIG,
      systemConfig: { ...DEFAULT_SYSTEM_CONFIG, usbSwitchScreenIndex: 2 },
      apiConfig: DEFAULT_API_CONFIG,
      screens: PRESET_CYBER_PET_SCREENS.slice(0, 2),
      automations: [],
      activeScreenIndex: 0,
    },
    'full'
  );
  assert(exported.systemConfig.usbSwitchScreenIndex === 1, 'export clamps usb index');
  const again = parseProject(exported);
  assert(again.ok, 'clamped export reimports');

  const normalized = normalizeProjectRelations({
    systemConfig: { ...DEFAULT_SYSTEM_CONFIG, usbSwitchScreenIndex: 9 },
    screens: PRESET_CYBER_PET_SCREENS.slice(0, 2),
    automations: [],
    activeScreenIndex: 5,
  });
  assert(normalized.systemConfig.usbSwitchScreenIndex === 1, 'normalize clamps usb');
  assert(normalized.activeScreenIndex === 0, 'normalize clamps active screen');
}

console.log('projectImportExport.test.ts: ok');
