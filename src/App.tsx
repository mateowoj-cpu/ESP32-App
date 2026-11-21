import React, { useState, useEffect } from 'react';
import { 
  DisplayConfig, 
  SystemConfig, 
  ApiIntegrationsConfig, 
  Screen, 
  AutomationRule, 
  HardwareSimState, 
  PetMood 
} from './types';
import { 
  DEFAULT_DISPLAY_CONFIG, 
  DEFAULT_SYSTEM_CONFIG, 
  DEFAULT_API_CONFIG, 
  PRESET_CYBER_PET_SCREENS, 
  PRESET_AUTOMATION_RULES 
} from './utils/presets';
import { HardwareSimulator } from './components/HardwareSimulator';
import { VisualEditor } from './components/VisualEditor';
import { AutomationStudio } from './components/AutomationStudio';
import { IntegrationsView } from './components/IntegrationsView';
import { MarketplaceView } from './components/MarketplaceView';
import { SettingsView } from './components/SettingsView';
import { CodeView } from './components/CodeView';
import { UsbDetectorView } from './components/UsbDetectorView';
import { ConnectedEsp32Info } from './types';
import {
  generateArduinoCppCode,
  generatePlatformIoIni,
  resolvePioBoardProfile,
} from './utils/codeGenerator';
import {
  buildProjectExport,
  parseProjectJson,
  type ProjectExportMode,
} from './utils/projectImportExport';
import type { UpdateCheckResult } from './platform/updater';
import type { OpenFilePayload } from './platform/flash';
import { useLocale } from './i18n/LocaleContext';
import { 
  Tv, 
  Layers, 
  Cpu, 
  Zap, 
  CloudSun, 
  Code, 
  Settings2, 
  Download, 
  Upload, 
  Check, 
  Usb,
  FileCode,
  FolderArchive,
  ExternalLink,
  X,
  Copy,
  Type,
  RefreshCw,
  FileJson,
  Store,
  PanelRightOpen,
  PanelRightClose,
  ChevronDown,
} from 'lucide-react';

export default function App() {
  const { t, updateChannel, diagnosticsEnabled } = useLocale();
  const [activeTab, setActiveTab] = useState<
    | 'editor'
    | 'simulator'
    | 'usb'
    | 'automations'
    | 'marketplace'
    | 'integrations'
    | 'code'
    | 'settings'
  >('simulator');

  // UI Font Size Accessibility Scaling
  const [uiFontScale, setUiFontScale] = useState<'normal' | 'large' | 'xlarge'>(() => {
    return (localStorage.getItem('esp32_ui_font_scale') as any) || 'normal';
  });

  useEffect(() => {
    localStorage.setItem('esp32_ui_font_scale', uiFontScale);
    document.documentElement.setAttribute('data-ui-scale', uiFontScale);
  }, [uiFontScale]);

  // Collapsible right-side app menu (desktop). Default open; remember preference.
  const [navSidebarOpen, setNavSidebarOpen] = useState(() => {
    const raw = localStorage.getItem('esp32_nav_sidebar_open');
    return raw === null ? true : raw === '1';
  });

  useEffect(() => {
    localStorage.setItem('esp32_nav_sidebar_open', navSidebarOpen ? '1' : '0');
  }, [navSidebarOpen]);

  // Keep the workspace scrolled to the top when switching views so a tall
  // previous tab cannot leave the next view partially off-screen / clipped.
  useEffect(() => {
    const workspace = document.getElementById('app-workspace');
    if (!workspace) return;
    workspace.scrollTop = 0;
    const raf = requestAnimationFrame(() => {
      workspace.scrollTop = 0;
    });
    return () => cancelAnimationFrame(raf);
  }, [activeTab]);

  // Application Global States
  const [displayConfig, setDisplayConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [apiConfig, setApiConfig] = useState<ApiIntegrationsConfig>(DEFAULT_API_CONFIG);
  const [screens, setScreens] = useState<Screen[]>(PRESET_CYBER_PET_SCREENS);
  const [automations, setAutomations] = useState<AutomationRule[]>(PRESET_AUTOMATION_RULES);
  const [activeScreenIndex, setActiveScreenIndex] = useState<number>(0);
  const [detectedChip, setDetectedChip] = useState<ConnectedEsp32Info | null>(null);

  // Hardware Simulation State
  const [simState, setSimState] = useState<HardwareSimState>({
    pirActive: false,
    hallActive: false,
    ambientLux: 450,
    temperature: 21.5,
    humidity: 52,
    potAdc: 2048,
    distanceCm: 42,
    relayOn: false,
    servoAngle: 90,
    ws2812Hue: 180,
    bootPressed: false,
    userBtn1Pressed: false,
    userBtn2Pressed: false,
    encoderVal: 0,
    encoderPressed: false,
    simulatedTime: '12:00:00',
    simulatedDate: '2026-11-12',
    isDisplayAwake: true,
    currentScreenIndex: 0,
    activePetMood: 'neutral',
    lastTriggerFired: null,
    touchActive: false,
    touchX: 64,
    touchY: 32,
    touchGesture: 'none',
    usbConnected: false,
    bluetoothConnected: false,
  });

  const [projectExported, setProjectExported] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [openFileNotice, setOpenFileNotice] = useState<OpenFilePayload | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Sync activeScreenIndex between app state and simState
  useEffect(() => {
    setSimState(prev => ({ ...prev, currentScreenIndex: activeScreenIndex }));
  }, [activeScreenIndex]);

  /** Commit a fully validated project in one shot — never partially overwrite. */
  const applyParsedProject = (
    project: {
      displayConfig: DisplayConfig;
      systemConfig: SystemConfig;
      apiConfig: ApiIntegrationsConfig;
      screens: Screen[];
      automations: AutomationRule[];
      activeScreenIndex: number;
    },
    sourceLabel: string
  ) => {
    setDisplayConfig(project.displayConfig);
    setSystemConfig(project.systemConfig);
    setApiConfig(project.apiConfig);
    setScreens(project.screens);
    setAutomations(project.automations);
    setActiveScreenIndex(project.activeScreenIndex);
    setImportNotice(t('import.ok').replace('{name}', sourceLabel));
    setTimeout(() => setImportNotice(null), 4000);
  };

  const importProjectText = (text: string, sourceLabel: string): boolean => {
    const result = parseProjectJson(text);
    if (!result.ok) {
      setImportNotice(
        t('import.rejected')
          .replace('{name}', sourceLabel)
          .replace('{reason}', result.error)
      );
      setTimeout(() => setImportNotice(null), 6000);
      return false;
    }
    applyParsedProject(result.project, sourceLabel);
    return true;
  };

  const handleExternalOpen = async (rawPaths: string[]) => {
    try {
      const { loadOpenTargets } = await import('./platform/deepLink');
      const files = await loadOpenTargets(rawPaths);
      for (const file of files) {
        if (file.kind === 'project' && file.content) {
          if (importProjectText(file.content, file.fileName)) {
            setActiveTab('simulator');
          }
        } else if (file.kind === 'sketch') {
          setOpenFileNotice(file);
          setActiveTab('code');
        } else if (file.kind === 'firmware') {
          setOpenFileNotice(file);
          setActiveTab('usb');
        } else {
          setOpenFileNotice(file);
        }
      }
    } catch (err) {
      setImportNotice(err instanceof Error ? err.message : String(err));
    }
  };

  // Sync diagnostics preference into native shell
  useEffect(() => {
    void import('./platform/diagnostics')
      .then(m => m.setDiagnosticsEnabledNative(diagnosticsEnabled))
      .catch(() => undefined);
  }, [diagnosticsEnabled]);

  // Auto-check updates + deep-link / file association listeners (Tauri)
  useEffect(() => {
    let cancelled = false;
    let unlistenOpen: (() => void) | undefined;
    (async () => {
      try {
        const { isTauri } = await import('@tauri-apps/api/core');
        if (!isTauri()) return;
        const { checkForAppUpdate } = await import('./platform/updater');
        const result = await checkForAppUpdate(updateChannel);
        if (cancelled) return;
        setUpdateResult(result);
        if (result.status === 'available') {
          setShowUpdateBanner(true);
        }

        const { listenAppOpenPaths } = await import('./platform/deepLink');
        unlistenOpen = await listenAppOpenPaths(paths => {
          void handleExternalOpen(paths);
        });
      } catch {
        // browser / updater unavailable
      }
    })();
    return () => {
      cancelled = true;
      unlistenOpen?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateChannel]);

  // Real-time ticking clock in simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setSimState(prev => {
        // Parse time and increment seconds
        const parts = prev.simulatedTime.split(':').map(Number);
        let h = parts[0] || 0;
        let m = parts[1] || 0;
        let s = (parts[2] || 0) + 1;
        if (s >= 60) {
          s = 0;
          m += 1;
          if (m >= 60) {
            m = 0;
            h = (h + 1) % 24;
          }
        }
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

        // Check time-based automation triggers (e.g. 23:00 sleep)
        let nextMood = prev.activePetMood;
        if (h === 23 && m === 0 && s === 0) {
          nextMood = 'sleep';
        }

        return {
          ...prev,
          simulatedTime: timeStr,
          activePetMood: nextMood,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Natural Pet blink & glance animation timer
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setSimState(prev => {
        if (!prev.isDisplayAwake || prev.activePetMood === 'sleep' || prev.activePetMood === 'angry') {
          return prev;
        }

        // Random action: blink or glance
        const rand = Math.random();
        if (rand < 0.6) {
          // Blink
          setTimeout(() => {
            setSimState(p => ({
              ...p,
              activePetMood: p.activePetMood === 'blink' ? 'neutral' : p.activePetMood,
            }));
          }, 180);
          return { ...prev, activePetMood: 'blink' };
        }
        return prev;
      });
    }, 4000);

    return () => clearInterval(blinkInterval);
  }, []);

  // Handle triggered actions from simulator buttons/sensors
  const handleTriggerAction = (ruleName: string, mood?: PetMood, screenIdx?: number) => {
    setSimState(prev => ({
      ...prev,
      lastTriggerFired: ruleName,
      activePetMood: mood || prev.activePetMood,
      currentScreenIndex: screenIdx !== undefined ? screenIdx : prev.currentScreenIndex,
      isDisplayAwake: true,
    }));
  };

  const handleCheckUpdates = async () => {
    setUpdateBusy(true);
    try {
      const { checkForAppUpdate } = await import('./platform/updater');
      const result = await checkForAppUpdate(updateChannel);
      setUpdateResult(result);
      setShowUpdateBanner(result.status === 'available' || result.status === 'error');
    } catch (err) {
      setUpdateResult({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
      setShowUpdateBanner(true);
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleInstallUpdate = async () => {
    setUpdateBusy(true);
    try {
      const { downloadAndInstallUpdate } = await import('./platform/updater');
      const result = await downloadAndInstallUpdate(updateChannel);
      if (result.status === 'error') {
        setUpdateResult({ status: 'error', message: result.message });
        setShowUpdateBanner(true);
      }
    } catch (err) {
      setUpdateResult({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
      setShowUpdateBanner(true);
    } finally {
      setUpdateBusy(false);
    }
  };

  // Export project as .esp32studio — share (default) strips credentials; full is opt-in
  const handleExportProjectJson = (mode: ProjectExportMode) => {
    const projectData = buildProjectExport(
      {
        displayConfig,
        systemConfig,
        apiConfig,
        screens,
        automations,
        activeScreenIndex,
      },
      mode
    );
    const blob = new Blob([JSON.stringify(projectData, null, 2)], {
      type: 'application/vnd.esp32studio+json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = mode === 'full' ? '_full' : '_share';
    a.download = `esp32_project_${displayConfig.model}${suffix}.esp32studio`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
    setProjectExported(true);
    setTimeout(() => setProjectExported(false), 2000);
  };

  const handleExportFullWithConfirm = () => {
    if (window.confirm(t('export.fullConfirm'))) {
      handleExportProjectJson('full');
    } else {
      setExportMenuOpen(false);
    }
  };

  // Quick .INO download handler
  const [downloadInoModal, setDownloadInoModal] = useState(false);
  const [customSketchName, setCustomSketchName] = useState('esp32_display_studio');
  const [copiedIno, setCopiedIno] = useState(false);

  const handleDownloadInoQuick = (name?: string) => {
    const rawName = name || customSketchName || 'esp32_display_studio';
    const cleanName = rawName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'esp32_display_studio';
    const cppCode = generateArduinoCppCode(displayConfig, systemConfig, apiConfig, screens, automations);
    const blob = new Blob([cppCode], { type: 'text/x-arduino;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanName}.ino`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setCustomSketchName(cleanName);
    setDownloadInoModal(true);
  };

  const handleCopyInoToClipboard = () => {
    const cppCode = generateArduinoCppCode(displayConfig, systemConfig, apiConfig, screens, automations);
    navigator.clipboard.writeText(cppCode);
    setCopiedIno(true);
    setTimeout(() => setCopiedIno(false), 2000);
  };

  // Import project JSON / .esp32studio — validate fully before touching open project
  const handleImportProjectJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      const text = typeof event.target?.result === 'string' ? event.target.result : '';
      if (!text) {
        setImportNotice(t('import.parseError'));
        return;
      }
      importProjectText(text, file.name);
    };
    reader.onerror = () => {
      setImportNotice(t('import.parseError'));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const desktopNavTabs = [
    {
      id: 'simulator' as const,
      label: t('nav.simulator'),
      shortLabel: t('nav.mobile.simulator'),
      icon: Tv,
      badge: false,
    },
    {
      id: 'editor' as const,
      label: t('nav.editor'),
      shortLabel: t('nav.mobile.editor'),
      icon: Layers,
      badge: false,
    },
    {
      id: 'usb' as const,
      label: t('nav.usb'),
      shortLabel: t('nav.mobile.usb'),
      icon: Usb,
      badge: Boolean(detectedChip),
    },
    {
      id: 'automations' as const,
      label: t('nav.automations'),
      shortLabel: t('nav.mobile.automations'),
      icon: Zap,
      badge: false,
    },
    {
      id: 'marketplace' as const,
      label: t('nav.marketplace'),
      shortLabel: t('nav.mobile.marketplace'),
      icon: Store,
      badge: false,
    },
    {
      id: 'integrations' as const,
      label: t('nav.integrations'),
      shortLabel: t('nav.mobile.integrations'),
      icon: CloudSun,
      badge: false,
    },
    {
      id: 'code' as const,
      label: t('nav.code'),
      shortLabel: t('nav.mobile.code'),
      icon: Code,
      badge: false,
    },
    {
      id: 'settings' as const,
      label: t('nav.settings'),
      shortLabel: t('nav.mobile.settings'),
      icon: Settings2,
      badge: false,
    },
  ];

  return (
    <div className="h-dvh max-h-dvh max-w-full overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans ui-type-body">
      <a href="#main-workspace" className="ui-skip-link">
        {t('a11y.skipToContent')}
      </a>
      {/*
        TOP BAR CONTRACT:
        Zone 1: Wordmark Brand
        Zone 2: Primary actions (font scale, update, import/export, INO)
        Zone 3: Toggle for collapsible right-side app menu (desktop)
        Primary nav lives in the right sidebar (lg+) / mobile bar (<lg).
      */}
      <header className="shrink-0 flex items-center justify-between gap-3 xl:gap-6 px-4 sm:px-6 py-3 border-b border-slate-800 bg-slate-950/95 z-50 backdrop-blur-md min-w-0">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400" aria-hidden="true">
            <Cpu className="ui-icon-md text-cyan-400" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="ui-type-title tracking-tight text-white font-mono block">
              ESP32 Studio
            </span>
            <span className="ui-type-micro text-slate-400 font-mono hidden xl:block">
              {t('brand.sub')}
            </span>
          </div>
        </div>

        {/* Zone 2 + 3: Font Scale, Actions, Sidebar Toggle */}
        <div className="ui-cluster shrink-0 gap-1.5 xl:gap-2.5 ml-auto">
          {/* Global Font Scale Accessibility Controller */}
          <div
            className="ui-cluster gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl"
            role="group"
            aria-label={t('a11y.fontScale')}
            title={t('a11y.fontScaleHint')}
          >
            <Type className="ui-icon-sm text-cyan-400 ml-1 shrink-0" aria-hidden="true" />
            <span className="hidden xl:inline text-slate-400 ui-type-micro font-medium mr-0.5">{t('a11y.fontLabel')}</span>
            <div className="ui-cluster gap-1">
              {[
                { key: 'normal', label: 'A', title: t('a11y.fontNormal') },
                { key: 'large', label: 'A+', title: t('a11y.fontLarge') },
                { key: 'xlarge', label: 'A++', title: t('a11y.fontXLarge') },
              ].map(scale => (
                <button
                  key={scale.key}
                  type="button"
                  onClick={() => setUiFontScale(scale.key as any)}
                  aria-pressed={uiFontScale === scale.key}
                  className={`min-h-8 min-w-8 px-2 py-1 rounded-lg ui-type-micro font-mono font-bold transition-colors ui-focus-ring ${
                    uiFontScale === scale.key
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title={scale.title}
                >
                  {scale.label}
                </button>
              ))}
            </div>
          </div>

          {/* Import / Export JSON Buttons */}
          <div className="ui-cluster gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() => void handleCheckUpdates()}
              disabled={updateBusy}
              title={t('a11y.checkUpdates')}
              aria-label={t('action.update')}
              className="ui-btn-icon hover:bg-slate-800 text-slate-300 hover:text-white ui-type-micro font-medium disabled:opacity-50 gap-1.5 px-2.5"
            >
              <RefreshCw className={`ui-icon-sm ${updateBusy ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} aria-hidden="true" />
              <span className="hidden xl:inline font-mono">{t('action.update')}</span>
            </button>
            <label
              className="ui-btn-icon hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              title={t('a11y.importProject')}
              aria-label={t('a11y.importProject')}
            >
              <Upload className="ui-icon-sm" aria-hidden="true" />
              <input type="file" accept=".esp32studio,.json,application/json" onChange={handleImportProjectJson} className="hidden" />
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportMenuOpen(open => !open)}
                title={t('a11y.exportProject')}
                aria-label={t('action.exportProject')}
                aria-expanded={exportMenuOpen}
                aria-haspopup="menu"
                className="ui-btn-icon hover:bg-slate-800 text-slate-300 hover:text-white ui-type-micro font-medium gap-1.5 px-2.5"
              >
                {projectExported ? (
                  <Check className="ui-icon-sm text-emerald-400" aria-hidden="true" />
                ) : (
                  <FileJson className="ui-icon-sm text-slate-400" aria-hidden="true" />
                )}
                <span className="hidden xl:inline font-mono">{t('action.exportProject')}</span>
                <ChevronDown className="ui-icon-sm text-slate-500" aria-hidden="true" />
              </button>
              {exportMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-1 min-w-[14rem] rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full rounded-lg px-3 py-2 text-left ui-type-micro text-slate-200 hover:bg-slate-800"
                    onClick={() => handleExportProjectJson('share')}
                  >
                    {t('export.share')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full rounded-lg px-3 py-2 text-left ui-type-micro text-amber-200 hover:bg-slate-800"
                    onClick={handleExportFullWithConfirm}
                  >
                    {t('export.full')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Primary Action: Download INO */}
          <button
            type="button"
            onClick={() => handleDownloadInoQuick()}
            className="ui-cluster gap-2 min-h-10 px-2.5 xl:px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-bold rounded-xl ui-type-caption transition-transform whitespace-nowrap shrink-0 active:scale-[0.98] ui-focus-ring"
            title={t('action.downloadIno')}
            aria-label={t('action.downloadIno')}
          >
            <Download className="ui-icon-sm" aria-hidden="true" />
            <span className="hidden xl:inline">{t('action.downloadIno')}</span>
          </button>

          {/* Desktop: collapse / expand right-side app menu */}
          <button
            type="button"
            className="hidden lg:inline-flex ui-btn-icon hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 bg-slate-900 rounded-xl"
            onClick={() => setNavSidebarOpen(open => !open)}
            aria-expanded={navSidebarOpen}
            aria-controls="app-nav-sidebar"
            aria-label={t('a11y.toggleNavSidebar')}
            title={navSidebarOpen ? t('nav.sidebar.close') : t('nav.sidebar.open')}
          >
            {navSidebarOpen ? (
              <PanelRightClose className="ui-icon-sm text-cyan-400" aria-hidden="true" />
            ) : (
              <PanelRightOpen className="ui-icon-sm text-cyan-400" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {showUpdateBanner && updateResult && (
        <div
          className="shrink-0 border-b border-cyan-500/30 bg-cyan-950/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3"
          role="status"
          aria-live="polite"
        >
          <div className="ui-type-caption text-cyan-100 min-w-0 ui-token">
            {updateResult.status === 'available' && (
              <span>
                {t('update.available')} <strong className="font-mono ui-token">{updateResult.version}</strong>
                <span className="text-cyan-300/80"> ({updateChannel})</span>
                {updateResult.body ? ` — ${updateResult.body.slice(0, 120)}` : ''}
              </span>
            )}
            {updateResult.status === 'up-to-date' && <span>{t('update.upToDate')}</span>}
            {updateResult.status === 'error' && (
              <span>{t('action.update')}: {updateResult.message}</span>
            )}
            {updateResult.status === 'unavailable' && (
              <span>{t('update.unavailable')}</span>
            )}
          </div>
          <div className="ui-cluster gap-2">
            {updateResult.status === 'available' && (
              <button
                type="button"
                disabled={updateBusy}
                onClick={() => void handleInstallUpdate()}
                className="min-h-9 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 ui-type-caption font-bold disabled:opacity-50 ui-focus-ring"
              >
                {t('update.install')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowUpdateBanner(false)}
              className="ui-btn-icon text-cyan-300/80 hover:bg-cyan-900/50"
              title={t('common.close')}
              aria-label={t('a11y.closeUpdateBanner')}
            >
              <X className="ui-icon-sm" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {importNotice && (
        <div
          className="shrink-0 border-b border-emerald-500/30 bg-emerald-950/30 px-4 py-2 ui-type-caption text-emerald-100 flex items-center justify-between gap-3"
          role="status"
          aria-live="polite"
        >
          <span className="min-w-0 ui-token">{importNotice}</span>
          <button
            type="button"
            onClick={() => setImportNotice(null)}
            className="ui-btn-icon hover:bg-emerald-900/50"
            aria-label={t('a11y.closeNotice')}
          >
            <X className="ui-icon-sm" aria-hidden="true" />
          </button>
        </div>
      )}

      {openFileNotice && (
        <div className="shrink-0 border-b border-amber-500/30 bg-amber-950/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3" role="status">
          <div className="ui-type-caption text-amber-100 min-w-0">
            {openFileNotice.kind === 'sketch' && (
              <span>
                {t('openFile.sketch')
                  .replace('{name}', openFileNotice.fileName)
                  .replace('{path}', openFileNotice.path)}
              </span>
            )}
            {openFileNotice.kind === 'firmware' && (
              <span>
                {t('openFile.firmware').replace('{name}', openFileNotice.fileName)}
              </span>
            )}
            {openFileNotice.kind !== 'sketch' && openFileNotice.kind !== 'firmware' && (
              <span>
                {t('openFile.generic').replace('{name}', openFileNotice.fileName)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpenFileNotice(null)}
            className="ui-btn-icon text-amber-200/80 hover:bg-amber-900/40"
            aria-label={t('a11y.closeFileNotice')}
          >
            <X className="ui-icon-sm" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Arduino IDE Quick Guide / Download Confirmation Modal */}
      {downloadInoModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="ino-download-title">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl max-w-lg w-full p-6 flex flex-col gap-5 relative">
            <button
              type="button"
              onClick={() => setDownloadInoModal(false)}
              className="absolute top-4 right-4 ui-btn-icon text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label={t('common.close')}
            >
              <X className="ui-icon-sm" aria-hidden="true" />
            </button>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0" aria-hidden="true">
                <FileCode className="ui-icon-md" aria-hidden="true" />
              </div>
              <div className="ui-stack gap-1 min-w-0">
                <h3 id="ino-download-title" className="ui-type-title text-white flex flex-wrap items-center gap-2">
                  <span>{t('ino.modalTitle')}</span>
                  <span className="px-2 py-0.5 rounded ui-type-micro font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    .ino
                  </span>
                </h3>
                <p className="ui-type-caption text-slate-400 font-mono">
                  {t('ino.modalFile')} <span className="text-cyan-300 font-bold ui-token">{customSketchName}.ino</span>
                </p>
              </div>
            </div>

            {/* Step-by-Step Arduino IDE Instructions */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl ui-stack gap-3 ui-type-caption">
              <div className="font-semibold text-slate-200 ui-cluster gap-2">
                <FolderArchive className="ui-icon-sm text-amber-400" aria-hidden="true" />
                <span>{t('ino.modalRule')}</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                {t('ino.modalRuleBody')}
              </p>
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 font-mono text-cyan-300 select-all ui-token">
                <div className="ui-cluster gap-2">
                  <FolderArchive className="ui-icon-sm text-slate-500" aria-hidden="true" />
                  <span>{customSketchName}/</span>
                </div>
                <div className="pl-6 ui-cluster gap-2 mt-1">
                  <span className="text-slate-600" aria-hidden="true">└──</span>
                  <FileCode className="ui-icon-sm text-slate-500" aria-hidden="true" />
                  <span>{customSketchName}.ino</span>
                </div>
              </div>
              <p className="text-slate-400 leading-relaxed">
                {t('ino.modalHint')}
              </p>
            </div>

            {/* Custom file name quick re-download */}
            <div className="ui-stack gap-1.5">
              <label htmlFor="sketch-name-input" className="ui-type-caption text-slate-300 font-medium">
                {t('ino.modalRename')}
              </label>
              <div className="ui-cluster gap-2">
                <div className="flex-1 flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 focus-within:border-cyan-500 min-w-0">
                  <input
                    id="sketch-name-input"
                    type="text"
                    value={customSketchName}
                    onChange={(e) => setCustomSketchName(e.target.value)}
                    className="bg-transparent ui-type-caption font-mono text-slate-200 focus:outline-none w-full ui-focus-ring rounded"
                    placeholder="esp32_display_studio"
                  />
                  <span className="text-slate-500 ui-type-caption font-mono select-none">.ino</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadInoQuick(customSketchName)}
                  className="min-h-10 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg ui-type-caption font-medium border border-slate-700 transition-colors shrink-0 ui-focus-ring"
                >
                  {t('ino.modalRedownload')}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleCopyInoToClipboard}
                className="ui-cluster gap-2 min-h-10 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg ui-type-caption border border-slate-700 font-medium ui-focus-ring"
              >
                {copiedIno ? (
                  <Check className="ui-icon-sm text-emerald-400" aria-hidden="true" />
                ) : (
                  <Copy className="ui-icon-sm" aria-hidden="true" />
                )}
                <span>{copiedIno ? t('action.copied') : t('action.copyCpp')}</span>
              </button>

              <div className="ui-cluster gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDownloadInoModal(false);
                    setActiveTab('code');
                  }}
                  className="min-h-10 px-3 py-2 ui-type-caption text-cyan-400 hover:text-cyan-300 font-medium ui-focus-ring rounded-lg"
                >
                  {t('ino.modalViewCode')}
                </button>
                <button
                  type="button"
                  onClick={() => setDownloadInoModal(false)}
                  className="min-h-10 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg ui-type-caption transition-colors ui-focus-ring"
                >
                  {t('action.done')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Navigation Bar — horizontal scroll stays inside the bar */}
      <nav
        className="ui-nav-scroll shrink-0 lg:hidden flex items-center gap-2 p-2 bg-slate-900 border-b border-slate-800"
        aria-label={t('a11y.mobileNav')}
      >
        {desktopNavTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              title={tab.label}
              className={`ui-nav-item shrink-0 ${
                isActive
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="ui-icon-sm" aria-hidden="true" />
              <span>{tab.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        {/*
          Workspace column scrolls independently of the right nav.
          Avoid root overflow-x-hidden + sticky sidebar (pairs overflow-y to auto
          and clips content when switching tabs / toggling the panel).
        */}
        <div
          id="app-workspace"
          className="flex flex-col flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain"
        >
          {/* Main Workspace Stage */}
          <main
            id="main-workspace"
            className="flex-1 min-w-0 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 ui-section ui-section-gap"
          >
            {activeTab === 'simulator' && (
              <HardwareSimulator
                display={displayConfig}
                setDisplay={setDisplayConfig}
                system={systemConfig}
                setSystem={setSystemConfig}
                simState={simState}
                setSimState={setSimState}
                screens={screens}
                apiConfig={apiConfig}
                automations={automations}
                onTriggerAction={handleTriggerAction}
              />
            )}

            {activeTab === 'editor' && (
              <VisualEditor
                screens={screens}
                setScreens={setScreens}
                display={displayConfig}
                activeScreenIndex={activeScreenIndex}
                setActiveScreenIndex={setActiveScreenIndex}
                simState={simState}
                setSimState={setSimState}
                automations={automations}
                setAutomations={setAutomations}
                system={systemConfig}
                setSystem={setSystemConfig}
              />
            )}

            {activeTab === 'usb' && (
              <UsbDetectorView
                detectedChip={detectedChip}
                setDetectedChip={setDetectedChip}
                display={displayConfig}
                setDisplay={setDisplayConfig}
                system={systemConfig}
                setSystem={setSystemConfig}
                buildSources={() => {
                  const boardProfile = resolvePioBoardProfile(
                    detectedChip?.chipFamily || detectedChip?.chipModel,
                  );
                  return {
                    sketchSource: generateArduinoCppCode(
                      displayConfig,
                      systemConfig,
                      apiConfig,
                      screens,
                      automations,
                    ),
                    platformioIni: generatePlatformIoIni(displayConfig, boardProfile, systemConfig),
                    boardProfile,
                    sketchName: 'esp32_display_studio',
                  };
                }}
              />
            )}

            {activeTab === 'automations' && (
              <AutomationStudio
                automations={automations}
                setAutomations={setAutomations}
                screens={screens}
                simState={simState}
                setSimState={setSimState}
              />
            )}

            {activeTab === 'marketplace' && (
              <MarketplaceView
                screens={screens}
                setScreens={setScreens}
                activeScreenIndex={activeScreenIndex}
                automations={automations}
                setAutomations={setAutomations}
              />
            )}

            {activeTab === 'integrations' && (
              <IntegrationsView
                apiConfig={apiConfig}
                setApiConfig={setApiConfig}
                simState={simState}
                setSimState={setSimState}
              />
            )}

            {activeTab === 'code' && (
              <CodeView
                display={displayConfig}
                system={systemConfig}
                api={apiConfig}
                screens={screens}
                automations={automations}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                display={displayConfig}
                setDisplay={setDisplayConfig}
                system={systemConfig}
                setSystem={setSystemConfig}
                screens={screens}
              />
            )}
          </main>

          {/* Footer Strip */}
          <footer className="border-t border-slate-900 py-4 px-6 text-center ui-type-micro text-slate-500 font-mono">
            {t('footer.copy')}
          </footer>
        </div>

        {/* Desktop right-side collapsible app menu */}
        <aside
          id="app-nav-sidebar"
          className="ui-nav-sidebar"
          data-open={navSidebarOpen ? 'true' : 'false'}
          aria-label={t('nav.sidebar.title')}
        >
          <div className="flex items-center justify-between gap-2 px-2 pt-2 pb-1 border-b border-slate-800/80 shrink-0">
            {navSidebarOpen && (
              <span className="ui-type-micro text-slate-400 font-mono px-1 truncate">
                {t('nav.sidebar.title')}
              </span>
            )}
            <button
              type="button"
              className={`ui-btn-icon hover:bg-slate-800 text-slate-300 hover:text-white ${
                navSidebarOpen ? '' : 'mx-auto'
              }`}
              onClick={() => setNavSidebarOpen(open => !open)}
              aria-expanded={navSidebarOpen}
              aria-controls="app-nav-sidebar"
              aria-label={t('a11y.toggleNavSidebar')}
              title={navSidebarOpen ? t('nav.sidebar.close') : t('nav.sidebar.open')}
            >
              {navSidebarOpen ? (
                <PanelRightClose className="ui-icon-sm text-cyan-400" aria-hidden="true" />
              ) : (
                <PanelRightOpen className="ui-icon-sm text-cyan-400" aria-hidden="true" />
              )}
            </button>
          </div>
          <nav className="ui-nav-sidebar-scroll" aria-label={t('a11y.mainNav')}>
            {desktopNavTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  title={tab.label}
                  className={`ui-nav-item ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Icon
                    className={`ui-icon-sm shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`}
                    aria-hidden="true"
                  />
                  <span className="ui-nav-item-label truncate">{tab.label}</span>
                  {tab.badge && (
                    <span
                      className="ui-status-dot ml-auto shrink-0"
                      title={t('a11y.chipDetected')}
                      aria-label={t('a11y.chipDetected')}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </aside>
      </div>
    </div>
  );
}
