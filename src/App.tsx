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
import { SettingsView } from './components/SettingsView';
import { CodeView } from './components/CodeView';
import { UsbDetectorView } from './components/UsbDetectorView';
import { ConnectedEsp32Info } from './types';
import { generateArduinoCppCode } from './utils/codeGenerator';
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
  Sparkles,
  Usb,
  FileCode,
  FolderArchive,
  ExternalLink,
  X,
  Copy,
  Type,
  RefreshCw,
  FileJson,
} from 'lucide-react';

export default function App() {
  const { t, updateChannel } = useLocale();
  const [activeTab, setActiveTab] = useState<
    'editor' | 'simulator' | 'usb' | 'automations' | 'integrations' | 'code' | 'settings'
  >('simulator');

  // UI Font Size Accessibility Scaling
  const [uiFontScale, setUiFontScale] = useState<'normal' | 'large' | 'xlarge'>(() => {
    return (localStorage.getItem('esp32_ui_font_scale') as any) || 'normal';
  });

  useEffect(() => {
    localStorage.setItem('esp32_ui_font_scale', uiFontScale);
    document.documentElement.setAttribute('data-ui-scale', uiFontScale);
  }, [uiFontScale]);

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
    ambientLux: 450,
    temperature: 21.5,
    humidity: 52,
    potAdc: 2048,
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
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [openFileNotice, setOpenFileNotice] = useState<OpenFilePayload | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Sync activeScreenIndex between app state and simState
  useEffect(() => {
    setSimState(prev => ({ ...prev, currentScreenIndex: activeScreenIndex }));
  }, [activeScreenIndex]);

  const applyProjectPayload = (json: Record<string, unknown>, sourceLabel: string) => {
    if (json.displayConfig) setDisplayConfig(json.displayConfig as typeof displayConfig);
    if (json.systemConfig) setSystemConfig(json.systemConfig as typeof systemConfig);
    if (json.apiConfig) setApiConfig(json.apiConfig as typeof apiConfig);
    if (json.screens) setScreens(json.screens as typeof screens);
    if (json.automations) setAutomations(json.automations as typeof automations);
    setImportNotice(`Zaimportowano projekt: ${sourceLabel}`);
    setTimeout(() => setImportNotice(null), 4000);
  };

  const handleExternalOpen = async (rawPaths: string[]) => {
    try {
      const { loadOpenTargets } = await import('./platform/deepLink');
      const files = await loadOpenTargets(rawPaths);
      for (const file of files) {
        if (file.kind === 'project' && file.content) {
          try {
            const json = JSON.parse(file.content) as Record<string, unknown>;
            applyProjectPayload(json, file.fileName);
            setActiveTab('simulator');
          } catch {
            setImportNotice(`Niepoprawny JSON projektu: ${file.fileName}`);
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

  // Export full project as .esp32studio (JSON) — Windows file association
  const handleExportProjectJson = () => {
    const projectData = {
      format: 'esp32studio',
      version: 1,
      displayConfig,
      systemConfig,
      apiConfig,
      screens,
      automations,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], {
      type: 'application/vnd.esp32studio+json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `esp32_project_${displayConfig.model}.esp32studio`;
    a.click();
    URL.revokeObjectURL(url);
    setProjectExported(true);
    setTimeout(() => setProjectExported(false), 2000);
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

  // Import project JSON / .esp32studio
  const handleImportProjectJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const json = JSON.parse(event.target?.result as string) as Record<string, unknown>;
        applyProjectPayload(json, file.name);
      } catch {
        setImportNotice('Błąd podczas parsowania pliku projektu');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 
        TOP BAR CONTRACT:
        Zone 1: Wordmark Brand
        Zone 2: 5 Clean Single-Line Navigation Links (No wrapping)
        Zone 3: 1 Primary Action Button
      */}
      <header className="flex items-center justify-between gap-4 xl:gap-8 px-4 sm:px-6 py-3 border-b border-slate-800 bg-slate-950/95 sticky top-0 z-50 backdrop-blur-md">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Cpu className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white font-mono block leading-tight">
              ESP32 Studio
            </span>
            <span className="text-[11px] text-slate-400 font-mono hidden sm:block">
              {t('brand.sub')}
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links with Consistent w-4 h-4 Icons & High Legibility */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-sm font-medium">
          {[
            { id: 'simulator', label: t('nav.simulator'), icon: Tv },
            { id: 'editor', label: t('nav.editor'), icon: Layers },
            { id: 'usb', label: t('nav.usb'), icon: Usb, badge: detectedChip },
            { id: 'automations', label: t('nav.automations'), icon: Zap },
            { id: 'integrations', label: t('nav.integrations'), icon: CloudSun },
            { id: 'code', label: t('nav.code'), icon: Code },
            { id: 'settings', label: t('nav.settings'), icon: Settings2 },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs xl:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 shadow-[inset_0_0_12px_rgba(6,182,212,0.15)] border border-cyan-500/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="ESP32 Wykryty" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Font Scale Accessibility & Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Global Font Scale Accessibility Controller */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl" title="Dostosuj wielkość czcionki w aplikacji (UI Accessibility)">
            <Type className="w-4 h-4 text-cyan-400 ml-1 shrink-0" />
            <span className="hidden xl:inline text-slate-400 text-xs font-medium mr-0.5">Tekst:</span>
            <div className="flex items-center gap-0.5">
              {[
                { key: 'normal', label: 'A', title: 'Standardowa wielkość (100%)' },
                { key: 'large', label: 'A+', title: 'Powiększona czcionka (115%)' },
                { key: 'xlarge', label: 'A++', title: 'Duża czcionka (130%)' },
              ].map(scale => (
                <button
                  key={scale.key}
                  type="button"
                  onClick={() => setUiFontScale(scale.key as any)}
                  className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    uiFontScale === scale.key
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
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
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() => void handleCheckUpdates()}
              disabled={updateBusy}
              title="Sprawdź aktualizacje aplikacji (Tauri)"
              className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs transition-colors flex items-center gap-1.5 px-2.5 font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${updateBusy ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
              <span className="hidden xl:inline text-xs font-mono">{t('action.update')}</span>
            </button>
            <label className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs cursor-pointer transition-colors flex items-center gap-1" title="Importuj projekt (.esp32studio / .json)">
              <Upload className="w-4 h-4" />
              <input type="file" accept=".esp32studio,.json,application/json" onChange={handleImportProjectJson} className="hidden" />
            </label>
            <button
              onClick={handleExportProjectJson}
              title="Zapisz projekt (.esp32studio) — skojarzony z aplikacją na Windows"
              className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs transition-colors flex items-center gap-1.5 px-2.5 font-medium"
            >
              {projectExported ? <Check className="w-4 h-4 text-emerald-400" /> : <FileJson className="w-4 h-4 text-slate-400" />}
              <span className="hidden xl:inline text-xs font-mono">{t('action.exportProject')}</span>
            </button>
          </div>

          {/* Primary Action: Download INO */}
          <button
            onClick={() => handleDownloadInoQuick()}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-bold rounded-xl text-xs xl:text-sm transition-all shadow-md shadow-cyan-500/20 whitespace-nowrap shrink-0 hover:scale-[1.02] active:scale-[0.98]"
            title="Pobierz gotowy szkic .ino do bezpośredniego wgrania przez Arduino IDE"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>Pobierz .INO</span>
          </button>
        </div>
      </header>

      {showUpdateBanner && updateResult && (
        <div className="border-b border-cyan-500/30 bg-cyan-950/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-cyan-100">
            {updateResult.status === 'available' && (
              <span>
                {t('update.available')} <strong className="font-mono">{updateResult.version}</strong>
                <span className="text-cyan-300/80"> ({updateChannel})</span>
                {updateResult.body ? ` — ${updateResult.body.slice(0, 120)}` : ''}
              </span>
            )}
            {updateResult.status === 'up-to-date' && <span>{t('update.upToDate')}</span>}
            {updateResult.status === 'error' && (
              <span>Update: {updateResult.message}</span>
            )}
            {updateResult.status === 'unavailable' && (
              <span>{t('update.unavailable')}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {updateResult.status === 'available' && (
              <button
                type="button"
                disabled={updateBusy}
                onClick={() => void handleInstallUpdate()}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold disabled:opacity-50"
              >
                {t('update.install')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowUpdateBanner(false)}
              className="p-1.5 rounded-lg text-cyan-300/80 hover:bg-cyan-900/50"
              title="Zamknij"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {importNotice && (
        <div className="border-b border-emerald-500/30 bg-emerald-950/30 px-4 py-2 text-xs text-emerald-100 flex items-center justify-between gap-3">
          <span>{importNotice}</span>
          <button type="button" onClick={() => setImportNotice(null)} className="p-1 rounded hover:bg-emerald-900/50">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {openFileNotice && (
        <div className="border-b border-amber-500/30 bg-amber-950/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-amber-100">
            {openFileNotice.kind === 'sketch' && (
              <span>
                Otwarto szkic <strong className="font-mono">{openFileNotice.fileName}</strong>
                {' '}({openFileNotice.path}). Studio nie nadpisuje .ino — użyj Generatora C++ / Flash helpera dla .bin.
              </span>
            )}
            {openFileNotice.kind === 'firmware' && (
              <span>
                Plik firmware <strong className="font-mono">{openFileNotice.fileName}</strong> — przejdź do USB → Flash helper i wskaż ten plik.
              </span>
            )}
            {openFileNotice.kind !== 'sketch' && openFileNotice.kind !== 'firmware' && (
              <span>
                Otwarto: <strong className="font-mono">{openFileNotice.fileName}</strong>
              </span>
            )}
          </div>
          <button type="button" onClick={() => setOpenFileNotice(null)} className="p-1.5 rounded-lg text-amber-200/80 hover:bg-amber-900/40">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Arduino IDE Quick Guide / Download Confirmation Modal */}
      {downloadInoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5 relative">
            <button
              onClick={() => setDownloadInoModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                <FileCode className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Pobrano Szkic Arduino IDE</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    .ino
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Plik: <span className="text-cyan-300 font-bold">{customSketchName}.ino</span>
                </p>
              </div>
            </div>

            {/* Step-by-Step Arduino IDE Instructions */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-3 text-xs">
              <div className="font-semibold text-slate-200 flex items-center gap-2 text-xs">
                <FolderArchive className="w-4 h-4 text-amber-400" />
                <span>Ważna zasada Arduino IDE:</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-xs">
                Arduino IDE wymaga, aby plik szkicu znajdował się w folderze o identycznej nazwie:
              </p>
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-xs font-mono text-cyan-300 select-all">
                📁 {customSketchName}/<br />
                &nbsp;&nbsp;&nbsp;└── 📄 {customSketchName}.ino
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                (Jeśli otworzysz plik bezpośrednio, Arduino IDE wyświetli okienko z zapytaniem i utworzy ten folder automatycznie).
              </p>
            </div>

            {/* Custom file name quick re-download */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-300 font-medium">
                Zmień nazwę pliku przed wgraniem (opcjonalnie):
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 focus-within:border-cyan-500">
                  <input
                    type="text"
                    value={customSketchName}
                    onChange={(e) => setCustomSketchName(e.target.value)}
                    className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none w-full"
                    placeholder="esp32_display_studio"
                  />
                  <span className="text-slate-500 text-xs font-mono select-none">.ino</span>
                </div>
                <button
                  onClick={() => handleDownloadInoQuick(customSketchName)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors shrink-0"
                >
                  Pobierz Ponownie
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={handleCopyInoToClipboard}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition-colors border border-slate-700 font-medium"
              >
                {copiedIno ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedIno ? 'Skopiowano!' : 'Kopiuj C++'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setDownloadInoModal(false);
                    setActiveTab('code');
                  }}
                  className="px-3 py-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  Zobacz cały kod i biblioteki &rarr;
                </button>
                <button
                  onClick={() => setDownloadInoModal(false)}
                  className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
                >
                  Gotowe
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Navigation Bar */}
      <div className="lg:hidden flex items-center overflow-x-auto gap-1.5 p-2 bg-slate-900 border-b border-slate-800 text-xs scrollbar-none">
        <button
          onClick={() => setActiveTab('simulator')}
          className={`px-3 py-2 rounded-lg whitespace-nowrap flex items-center gap-2 font-medium transition-colors ${
            activeTab === 'simulator' 
              ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm' 
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Tv className="w-4 h-4" />
          <span>Symulator</span>
        </button>
        <button
          onClick={() => setActiveTab('editor')}
          className={`px-3 py-2 rounded-lg whitespace-nowrap flex items-center gap-2 font-medium transition-colors ${
            activeTab === 'editor' 
              ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm' 
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Edytor UI</span>
        </button>
        <button
          onClick={() => setActiveTab('usb')}
          className={`px-3 py-2 rounded-lg whitespace-nowrap flex items-center gap-2 font-medium transition-colors ${
            activeTab === 'usb' 
              ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm' 
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Usb className="w-4 h-4" />
          <span>Wykryj USB</span>
        </button>
        <button
          onClick={() => setActiveTab('automations')}
          className={`px-3 py-2 rounded-lg whitespace-nowrap flex items-center gap-2 font-medium transition-colors ${
            activeTab === 'automations' 
              ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm' 
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Automatyzacje</span>
        </button>
        <button
          onClick={() => setActiveTab('integrations')}
          className={`px-3 py-2 rounded-lg whitespace-nowrap flex items-center gap-2 font-medium transition-colors ${
            activeTab === 'integrations' 
              ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm' 
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <CloudSun className="w-4 h-4" />
          <span>Integracje</span>
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={`px-3 py-2 rounded-lg whitespace-nowrap flex items-center gap-2 font-medium transition-colors ${
            activeTab === 'code' 
              ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm' 
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Code className="w-4 h-4" />
          <span>Kod C++</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3 py-2 rounded-lg whitespace-nowrap flex items-center gap-2 font-medium transition-colors ${
            activeTab === 'settings' 
              ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm' 
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          <span>Ustawienia</span>
        </button>
      </div>

      {/* Main Workspace Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
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
      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        ESP32 Display Studio &copy; 2026 · Kompatybilny z ESP32 WROOM / ESP32-S3 / ESP32-C3 · Adafruit_SSD1306, TFT_eSPI, U8g2
      </footer>
    </div>
  );
}
