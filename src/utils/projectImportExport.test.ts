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
  parseProject,
  parseProjectJson,
  stripProjectCredentials,
} from './projectImportExport';

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

console.log('projectImportExport.test.ts: ok');
