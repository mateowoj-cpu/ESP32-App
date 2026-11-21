import React, { useState } from 'react';
import { 
  DisplayConfig, 
  SystemConfig, 
  ApiIntegrationsConfig, 
  Screen, 
  AutomationRule 
} from '../types';
import { 
  generateArduinoCppCode, 
  generatePlatformIoIni, 
  generatePythonPcAgentScript 
} from '../utils/codeGenerator';
import { useLocale } from '../i18n/LocaleContext';
import { 
  Copy, 
  Check, 
  Download, 
  Code, 
  FileText, 
  Layers, 
  Cpu, 
  BookOpen, 
  ExternalLink 
} from 'lucide-react';

interface CodeViewProps {
  display: DisplayConfig;
  system: SystemConfig;
  api: ApiIntegrationsConfig;
  screens: Screen[];
  automations: AutomationRule[];
}

export const CodeView: React.FC<CodeViewProps> = ({
  display,
  system,
  api,
  screens,
  automations,
}) => {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<'ino' | 'platformio' | 'pinout' | 'guide'>('ino');
  const [copied, setCopied] = useState(false);

  const cppCode = generateArduinoCppCode(display, system, api, screens, automations);
  const platformIoCode = generatePlatformIoIni(display, 'esp32', system);

  // Copy code to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [sketchName, setSketchName] = useState('esp32_display_studio');
  const [downloadSuccessModal, setDownloadSuccessModal] = useState(false);
  const [toolsMessage, setToolsMessage] = useState<string | null>(null);
  const [toolsBusy, setToolsBusy] = useState(false);

  // Clean filename helper
  const cleanSketchName = sketchName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'esp32_display_studio';

  const handleOpenArduinoIde = async () => {
    setToolsBusy(true);
    setToolsMessage(null);
    try {
      const { isTauri } = await import('@tauri-apps/api/core');
      if (!isTauri()) {
        setToolsMessage(t('code.toolsDesktopOnly'));
        return;
      }
      const { exportAndOpenArduinoIde } = await import('../platform/tools');
      const result = await exportAndOpenArduinoIde({
        sketchSource: cppCode,
        sketchName: cleanSketchName,
      });
      setToolsMessage(result.message);
    } catch (err) {
      setToolsMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setToolsBusy(false);
    }
  };

  const handleOpenWokwi = async () => {
    setToolsBusy(true);
    setToolsMessage(null);
    try {
      const { isTauri } = await import('@tauri-apps/api/core');
      if (!isTauri()) {
        window.open('https://wokwi.com/arduino/new?template=esp32', '_blank', 'noopener,noreferrer');
        setToolsMessage(t('code.toolsDesktopOnly'));
        return;
      }
      const { openWokwiSimulator } = await import('../platform/tools');
      const result = await openWokwiSimulator();
      setToolsMessage(result.message);
    } catch (err) {
      setToolsMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setToolsBusy(false);
    }
  };

  // Download .ino file
  const handleDownloadIno = (customName?: string) => {
    const filename = `${customName || cleanSketchName}.ino`;
    const blob = new Blob([cppCode], { type: 'text/x-arduino;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccessModal(true);
  };

  // Download platformio.ini
  const handleDownloadPlatformIo = () => {
    const blob = new Blob([platformIoCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'platformio.ini';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const lineCount = cppCode.split('\n').length;
  const approxSizeKb = (new Blob([cppCode]).size / 1024).toFixed(1);

  return (
    <div className="flex flex-col gap-6">
      {/* Hero .INO Download Card for Arduino IDE */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-500/30 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
              <Code className="ui-icon-lg" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="ui-type-title text-white tracking-tight">
                  {t('code.title')}
                </h2>
                <span className="px-2 py-0.5 rounded ui-type-micro font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                  {t('code.badge.arduinoIde')}
                </span>
                <span className="px-2 py-0.5 rounded ui-type-micro font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {t('code.meta.sizeKb')
                    .replace('{lines}', String(lineCount))
                    .replace('{kb}', approxSizeKb)}
                </span>
              </div>
              <p className="ui-type-caption text-slate-300 leading-relaxed max-w-prose">
                {t('code.desc')} ({display.model.toUpperCase()})
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 focus-within:border-cyan-500 transition-colors">
              <span className="text-slate-500 text-xs font-mono select-none">{t('code.name')}</span>
              <input
                type="text"
                value={sketchName}
                onChange={(e) => setSketchName(e.target.value)}
                placeholder="esp32_display_studio"
                className="bg-transparent text-xs font-mono text-cyan-300 focus:outline-none ui-focus-ring px-2 w-36"
              />
              <span className="text-slate-500 text-xs font-mono select-none">.ino</span>
            </div>

            <button
              onClick={() => handleDownloadIno()}
              className="flex items-center justify-center gap-2 min-h-10 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-bold rounded-xl ui-type-caption transition-transform active:scale-[0.98] ui-focus-ring"
            >
              <Download className="ui-icon-sm stroke-[2.5]" aria-hidden="true" />
              <span>{t('code.download')}</span>
            </button>
            <button
              type="button"
              disabled={toolsBusy}
              onClick={() => void handleOpenArduinoIde()}
              className="flex items-center justify-center gap-2 min-h-10 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 border border-slate-700 font-semibold rounded-xl ui-type-caption ui-focus-ring"
            >
              <ExternalLink className="ui-icon-sm" aria-hidden="true" />
              <span>{t('code.openArduinoIde')}</span>
            </button>
            <button
              type="button"
              disabled={toolsBusy}
              onClick={() => void handleOpenWokwi()}
              className="flex items-center justify-center gap-2 min-h-10 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 border border-slate-700 font-semibold rounded-xl ui-type-caption ui-focus-ring"
            >
              <ExternalLink className="ui-icon-sm" aria-hidden="true" />
              <span>{t('code.openWokwi')}</span>
            </button>
          </div>
        </div>
        {toolsMessage && (
          <p className="mt-3 ui-type-micro font-mono text-amber-200/90 relative z-10">{toolsMessage}</p>
        )}
      </div>

      {/* Download Success / Arduino IDE Instructions Modal */}
      {downloadSuccessModal && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Check className="ui-icon-sm" aria-hidden="true" />
            </div>
            <div className="text-xs">
              <p className="font-bold text-emerald-300">
                {t('code.downloaded')} <code className="font-mono bg-emerald-950 px-1 py-0.5 rounded">{cleanSketchName}.ino</code>
              </p>
              <p className="text-slate-300 mt-0.5 leading-relaxed">
                {t('code.arduinoTip')} <code className="font-mono text-cyan-300 bg-slate-950 px-1 rounded">{cleanSketchName}/{cleanSketchName}.ino</code>
              </p>
            </div>
          </div>
          <button
            onClick={() => setDownloadSuccessModal(false)}
            className="text-xs text-slate-400 hover:text-white px-3 py-1 bg-slate-900 border border-slate-700 rounded-lg shrink-0"
          >
            {t('code.dismiss')}
          </button>
        </div>
      )}

      {/* Sub Tabs Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('ino')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'ino' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="ui-icon-sm" aria-hidden="true" />
            <span>{t('code.tabIno')} ({cleanSketchName}.ino)</span>
          </button>
          <button
            onClick={() => setActiveTab('platformio')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'platformio' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="ui-icon-sm" aria-hidden="true" />
            <span>{t('code.tabPio')}</span>
          </button>
          <button
            onClick={() => setActiveTab('pinout')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'pinout' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="ui-icon-sm" aria-hidden="true" />
            <span>{t('code.tabPinout')}</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'guide' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="ui-icon-sm" aria-hidden="true" />
            <span>{t('code.tabGuide')}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCopy(activeTab === 'ino' ? cppCode : platformIoCode)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
          >
            {copied ? <Check className="ui-icon-sm text-emerald-400" aria-hidden="true" /> : <Copy className="ui-icon-sm" aria-hidden="true" />}
            <span>{copied ? t('action.copied') : t('code.copy')}</span>
          </button>

          {activeTab === 'ino' ? (
            <button
              onClick={() => handleDownloadIno()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-sm"
            >
              <Download className="ui-icon-sm" aria-hidden="true" />
              <span>{t('code.downloadIno').replace('{name}', cleanSketchName)}</span>
            </button>
          ) : (
            <button
              onClick={handleDownloadPlatformIo}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-sm"
            >
              <Download className="ui-icon-sm" aria-hidden="true" />
              <span>{t('code.downloadPio')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab: Arduino .INO */}
      {activeTab === 'ino' && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800 font-mono">
            <span>
              {t('code.ino.fileMeta')
                .replace('{name}', cleanSketchName)
                .replace('{lines}', String(lineCount))}
            </span>
            <span className="text-cyan-400">{t('code.ino.readyToCompile')}</span>
          </div>
          <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 overflow-x-auto max-h-[620px] overflow-y-auto leading-relaxed select-text">
            <code>{cppCode}</code>
          </pre>
        </div>
      )}

      {/* Tab: PlatformIO ini */}
      {activeTab === 'platformio' && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800 font-mono">
            <span>{t('code.tabPio')}</span>
            <span className="text-cyan-400">{t('code.pio.libDepsHint')}</span>
          </div>
          <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed select-text">
            <code>{platformIoCode}</code>
          </pre>
        </div>
      )}

      {/* Tab: Pinout Wiring Table */}
      {activeTab === 'pinout' && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-6">
          <div className="pb-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Cpu className="ui-icon-sm text-cyan-400" aria-hidden="true" />
              {t('code.wiring.title')}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {t('code.wiring.subtitle')}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase ui-type-micro">
                  <th className="py-2.5 px-3">{t('code.wiring.col.module')}</th>
                  <th className="py-2.5 px-3">{t('code.wiring.col.modulePin')}</th>
                  <th className="py-2.5 px-3">{t('code.wiring.col.espPin')}</th>
                  <th className="py-2.5 px-3">{t('code.wiring.col.notes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {display.bus === 'i2c' ? (
                  <>
                    <tr className="hover:bg-slate-950/40">
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{t('code.wiring.module.oled')}</td>
                      <td className="py-2.5 px-3 text-rose-400">VCC</td>
                      <td className="py-2.5 px-3 text-rose-400">3.3V</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.oledVcc')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40">
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{t('code.wiring.module.oled')}</td>
                      <td className="py-2.5 px-3 text-slate-400">GND</td>
                      <td className="py-2.5 px-3 text-slate-400">GND</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.oledGnd')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40">
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{t('code.wiring.module.oled')}</td>
                      <td className="py-2.5 px-3 text-amber-400">SCL</td>
                      <td className="py-2.5 px-3 text-amber-400 font-bold">GPIO {display.sclPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.oledScl')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40">
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{t('code.wiring.module.oled')}</td>
                      <td className="py-2.5 px-3 text-cyan-400">SDA</td>
                      <td className="py-2.5 px-3 text-cyan-400 font-bold">GPIO {display.sdaPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.oledSda')}</td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr className="hover:bg-slate-950/40 bg-indigo-950/10">
                      <td className="py-2.5 px-3 font-semibold text-indigo-300">{t('code.wiring.module.tft')}</td>
                      <td className="py-2.5 px-3 text-rose-400">VCC</td>
                      <td className="py-2.5 px-3 text-rose-400">3.3V</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.tftVcc')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-indigo-950/10">
                      <td className="py-2.5 px-3 font-semibold text-indigo-300">{t('code.wiring.module.tft')}</td>
                      <td className="py-2.5 px-3 text-slate-400">GND</td>
                      <td className="py-2.5 px-3 text-slate-400">GND</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.oledGnd')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-indigo-950/10">
                      <td className="py-2.5 px-3 font-semibold text-indigo-300">{t('code.wiring.module.tft')}</td>
                      <td className="py-2.5 px-3 text-indigo-400">MOSI / SDI</td>
                      <td className="py-2.5 px-3 text-indigo-400 font-bold">GPIO {display.mosiPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.tftMosi')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-indigo-950/10">
                      <td className="py-2.5 px-3 font-semibold text-indigo-300">{t('code.wiring.module.tft')}</td>
                      <td className="py-2.5 px-3 text-indigo-400">MISO / SDO</td>
                      <td className="py-2.5 px-3 text-indigo-400 font-bold">GPIO {display.misoPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.tftMiso')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-indigo-950/10">
                      <td className="py-2.5 px-3 font-semibold text-indigo-300">{t('code.wiring.module.tft')}</td>
                      <td className="py-2.5 px-3 text-indigo-400">SCK / SCL</td>
                      <td className="py-2.5 px-3 text-indigo-400 font-bold">GPIO {display.sckPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.tftSck')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-indigo-950/10">
                      <td className="py-2.5 px-3 font-semibold text-indigo-300">{t('code.wiring.module.tft')}</td>
                      <td className="py-2.5 px-3 text-indigo-400">CS</td>
                      <td className="py-2.5 px-3 text-indigo-400 font-bold">GPIO {display.csPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.tftCs')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-indigo-950/10">
                      <td className="py-2.5 px-3 font-semibold text-indigo-300">{t('code.wiring.module.tft')}</td>
                      <td className="py-2.5 px-3 text-purple-400">DC / RS</td>
                      <td className="py-2.5 px-3 text-purple-400 font-bold">GPIO {display.dcPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.tftDc')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-indigo-950/10">
                      <td className="py-2.5 px-3 font-semibold text-indigo-300">{t('code.wiring.module.tft')}</td>
                      <td className="py-2.5 px-3 text-purple-400">RST</td>
                      <td className="py-2.5 px-3 text-purple-400 font-bold">GPIO {display.rstPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.tftRst')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-indigo-950/10">
                      <td className="py-2.5 px-3 font-semibold text-indigo-300">{t('code.wiring.module.tft')}</td>
                      <td className="py-2.5 px-3 text-amber-400">LED / BL</td>
                      <td className="py-2.5 px-3 text-amber-400 font-bold">GPIO {display.backlightPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.tftBl')}</td>
                    </tr>
                  </>
                )}
                <tr className="hover:bg-slate-950/40">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">{t('code.wiring.module.pir')}</td>
                  <td className="py-2.5 px-3 text-emerald-400">OUT</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">GPIO {system.pirPin ?? 14}</td>
                  <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.pir')}</td>
                </tr>
                {system.hallPin != null && (
                  <>
                    <tr className="hover:bg-slate-950/40 bg-fuchsia-950/10">
                      <td className="py-2.5 px-3 font-semibold text-fuchsia-300">{t('code.wiring.module.hall')}</td>
                      <td className="py-2.5 px-3 text-rose-400">VCC</td>
                      <td className="py-2.5 px-3 text-rose-400 font-bold">3.3V</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.hallVcc')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-fuchsia-950/10">
                      <td className="py-2.5 px-3 font-semibold text-fuchsia-300">{t('code.wiring.module.hall')}</td>
                      <td className="py-2.5 px-3 text-slate-400">GND</td>
                      <td className="py-2.5 px-3 text-slate-400 font-bold">GND</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.hallGnd')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-fuchsia-950/10">
                      <td className="py-2.5 px-3 font-semibold text-fuchsia-300">{t('code.wiring.module.hall')}</td>
                      <td className="py-2.5 px-3 text-fuchsia-400">OUT / DO</td>
                      <td className="py-2.5 px-3 text-fuchsia-400 font-bold">GPIO {system.hallPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.hall')}</td>
                    </tr>
                  </>
                )}
                {system.dhtPin != null && (
                  <tr className="hover:bg-slate-950/40 bg-rose-950/10">
                    <td className="py-2.5 px-3 font-semibold text-rose-300">{t('code.wiring.module.dht')}</td>
                    <td className="py-2.5 px-3 text-rose-400">DATA</td>
                    <td className="py-2.5 px-3 text-rose-400 font-bold">GPIO {system.dhtPin}</td>
                    <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.dht')}</td>
                  </tr>
                )}
                {system.ds18b20Pin != null && (
                  <tr className="hover:bg-slate-950/40 bg-orange-950/10">
                    <td className="py-2.5 px-3 font-semibold text-orange-300">{t('code.wiring.module.ds18b20')}</td>
                    <td className="py-2.5 px-3 text-orange-400">DQ / DATA</td>
                    <td className="py-2.5 px-3 text-orange-400 font-bold">GPIO {system.ds18b20Pin}</td>
                    <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.ds18b20')}</td>
                  </tr>
                )}
                {system.ultrasonicTrigPin != null && (
                  <tr className="hover:bg-slate-950/40 bg-lime-950/10">
                    <td className="py-2.5 px-3 font-semibold text-lime-300">{t('code.wiring.module.hcsr04')}</td>
                    <td className="py-2.5 px-3 text-lime-400">TRIG</td>
                    <td className="py-2.5 px-3 text-lime-400 font-bold">GPIO {system.ultrasonicTrigPin}</td>
                    <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.ultraTrig')}</td>
                  </tr>
                )}
                {system.ultrasonicEchoPin != null && (
                  <tr className="hover:bg-slate-950/40 bg-lime-950/10">
                    <td className="py-2.5 px-3 font-semibold text-lime-300">{t('code.wiring.module.hcsr04')}</td>
                    <td className="py-2.5 px-3 text-lime-400">ECHO</td>
                    <td className="py-2.5 px-3 text-lime-400 font-bold">GPIO {system.ultrasonicEchoPin}</td>
                    <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.ultraEcho')}</td>
                  </tr>
                )}
                {system.servoPin != null && (
                  <tr className="hover:bg-slate-950/40 bg-violet-950/10">
                    <td className="py-2.5 px-3 font-semibold text-violet-300">{t('code.wiring.module.servo')}</td>
                    <td className="py-2.5 px-3 text-violet-400">SIG</td>
                    <td className="py-2.5 px-3 text-violet-400 font-bold">GPIO {system.servoPin}</td>
                    <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.servo')}</td>
                  </tr>
                )}
                {system.relayPin != null && (
                  <tr className="hover:bg-slate-950/40 bg-red-950/10">
                    <td className="py-2.5 px-3 font-semibold text-red-300">{t('code.wiring.module.relay')}</td>
                    <td className="py-2.5 px-3 text-red-400">IN</td>
                    <td className="py-2.5 px-3 text-red-400 font-bold">GPIO {system.relayPin}</td>
                    <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.relay')}</td>
                  </tr>
                )}
                {system.ws2812Pin != null && (
                  <tr className="hover:bg-slate-950/40 bg-pink-950/10">
                    <td className="py-2.5 px-3 font-semibold text-pink-300">{t('code.wiring.module.ws2812')}</td>
                    <td className="py-2.5 px-3 text-pink-400">DIN</td>
                    <td className="py-2.5 px-3 text-pink-400 font-bold">GPIO {system.ws2812Pin}</td>
                    <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.ws2812')}</td>
                  </tr>
                )}
                {system.l298nIn1Pin != null && (
                  <tr className="hover:bg-slate-950/40 bg-sky-950/10">
                    <td className="py-2.5 px-3 font-semibold text-sky-300">{t('code.wiring.module.l298n')}</td>
                    <td className="py-2.5 px-3 text-sky-400">IN1</td>
                    <td className="py-2.5 px-3 text-sky-400 font-bold">GPIO {system.l298nIn1Pin}</td>
                    <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.l298n')}</td>
                  </tr>
                )}
                {system.l298nIn2Pin != null && (
                  <tr className="hover:bg-slate-950/40 bg-sky-950/10">
                    <td className="py-2.5 px-3 font-semibold text-sky-300">{t('code.wiring.module.l298n')}</td>
                    <td className="py-2.5 px-3 text-sky-400">IN2</td>
                    <td className="py-2.5 px-3 text-sky-400 font-bold">GPIO {system.l298nIn2Pin}</td>
                    <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.l298n')}</td>
                  </tr>
                )}
                {system.l298nEnaPin != null && (
                  <tr className="hover:bg-slate-950/40 bg-sky-950/10">
                    <td className="py-2.5 px-3 font-semibold text-sky-300">{t('code.wiring.module.l298n')}</td>
                    <td className="py-2.5 px-3 text-sky-400">ENA</td>
                    <td className="py-2.5 px-3 text-sky-400 font-bold">GPIO {system.l298nEnaPin}</td>
                    <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.l298nEna')}</td>
                  </tr>
                )}
                {system.bme280Enabled && (
                  <>
                    <tr className="hover:bg-slate-950/40 bg-cyan-950/10">
                      <td className="py-2.5 px-3 font-semibold text-cyan-300">{t('code.wiring.module.bme280')}</td>
                      <td className="py-2.5 px-3 text-cyan-400">SDA</td>
                      <td className="py-2.5 px-3 text-cyan-400 font-bold">GPIO {display.sdaPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.bme280')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-cyan-950/10">
                      <td className="py-2.5 px-3 font-semibold text-cyan-300">{t('code.wiring.module.bme280')}</td>
                      <td className="py-2.5 px-3 text-cyan-400">SCL</td>
                      <td className="py-2.5 px-3 text-cyan-400 font-bold">GPIO {display.sclPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.bme280')}</td>
                    </tr>
                  </>
                )}
                {system.mpu6050Enabled && (
                  <>
                    <tr className="hover:bg-slate-950/40 bg-cyan-950/10">
                      <td className="py-2.5 px-3 font-semibold text-cyan-300">{t('code.wiring.module.mpu6050')}</td>
                      <td className="py-2.5 px-3 text-cyan-400">SDA</td>
                      <td className="py-2.5 px-3 text-cyan-400 font-bold">GPIO {display.sdaPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.mpu6050')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-cyan-950/10">
                      <td className="py-2.5 px-3 font-semibold text-cyan-300">{t('code.wiring.module.mpu6050')}</td>
                      <td className="py-2.5 px-3 text-cyan-400">SCL</td>
                      <td className="py-2.5 px-3 text-cyan-400 font-bold">GPIO {display.sclPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.mpu6050')}</td>
                    </tr>
                  </>
                )}
                <tr className="hover:bg-slate-950/40">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">{t('code.wiring.module.ldr')}</td>
                  <td className="py-2.5 px-3 text-yellow-400">SIG / ADC</td>
                  <td className="py-2.5 px-3 text-yellow-400 font-bold">GPIO {system.ldrPin ?? 36}</td>
                  <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.ldr')}</td>
                </tr>
                <tr className="hover:bg-slate-950/40">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">{t('code.wiring.module.pot')}</td>
                  <td className="py-2.5 px-3 text-yellow-400">SIG / ADC</td>
                  <td className="py-2.5 px-3 text-yellow-400 font-bold">GPIO {system.potPin ?? 34}</td>
                  <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.pot')}</td>
                </tr>
                <tr className="hover:bg-slate-950/40">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">{t('code.wiring.module.buzzer')}</td>
                  <td className="py-2.5 px-3 text-amber-400">PWM IN</td>
                  <td className="py-2.5 px-3 text-amber-400 font-bold">GPIO {system.buzzerPin ?? 18}</td>
                  <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.buzzer')}</td>
                </tr>
                <tr className="hover:bg-slate-950/40">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">{t('code.wiring.module.boot')}</td>
                  <td className="py-2.5 px-3 text-slate-300">{t('code.wiring.pin.builtin')}</td>
                  <td className="py-2.5 px-3 text-slate-300 font-bold">GPIO 0</td>
                  <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.boot')}</td>
                </tr>
                {display.touchEnabled && (
                  <>
                    <tr className="hover:bg-slate-950/40 bg-rose-950/10">
                      <td className="py-2.5 px-3 font-semibold text-rose-300">
                        {t('code.wiring.module.touch').replace('{controller}', display.touchController.toUpperCase())}
                      </td>
                      <td className="py-2.5 px-3 text-rose-400">Touch SDA / MOSI</td>
                      <td className="py-2.5 px-3 text-rose-400 font-bold">GPIO {display.touchSdaPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.touchSda')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-rose-950/10">
                      <td className="py-2.5 px-3 font-semibold text-rose-300">
                        {t('code.wiring.module.touch').replace('{controller}', display.touchController.toUpperCase())}
                      </td>
                      <td className="py-2.5 px-3 text-rose-400">Touch SCL / SCK</td>
                      <td className="py-2.5 px-3 text-rose-400 font-bold">GPIO {display.touchSclPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.touchScl')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-rose-950/10">
                      <td className="py-2.5 px-3 font-semibold text-rose-300">
                        {t('code.wiring.module.touch').replace('{controller}', display.touchController.toUpperCase())}
                      </td>
                      <td className="py-2.5 px-3 text-rose-300">Touch INT (IRQ)</td>
                      <td className="py-2.5 px-3 text-rose-300 font-bold">GPIO {display.touchIntPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.touchInt')}</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-rose-950/10">
                      <td className="py-2.5 px-3 font-semibold text-rose-300">
                        {t('code.wiring.module.touch').replace('{controller}', display.touchController.toUpperCase())}
                      </td>
                      <td className="py-2.5 px-3 text-rose-300">Touch RST</td>
                      <td className="py-2.5 px-3 text-rose-300 font-bold">GPIO {display.touchRstPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t('code.wiring.note.touchRst')}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Flashing Guide */}
      {activeTab === 'guide' && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-5">
          <div className="pb-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <BookOpen className="ui-icon-sm text-cyan-400" aria-hidden="true" />
              {t('code.guide.title')}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {t('code.guide.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center">1</span>
                <span>{t('code.guide.step1.title')}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t('code.guide.step1.body')}
              </p>
              <ul className="text-xs font-mono text-slate-300 space-y-1 list-disc list-inside">
                <li>{t('code.guide.step1.libSsd')}</li>
                <li>{t('code.guide.step1.libGfx')}</li>
                <li>{t('code.guide.step1.libJson')}</li>
              </ul>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center">2</span>
                <span>{t('code.guide.step2.title')}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t('code.guide.step2.body')}
              </p>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">3</span>
                <span>{t('code.guide.step3.title')}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t('code.guide.step3.body')}
              </p>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">4</span>
                <span>{t('code.guide.step4.title')}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t('code.guide.step4.body')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
