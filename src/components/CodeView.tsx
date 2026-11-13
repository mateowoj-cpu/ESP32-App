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
  const platformIoCode = generatePlatformIoIni(display);

  // Copy code to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [sketchName, setSketchName] = useState('esp32_display_studio');
  const [downloadSuccessModal, setDownloadSuccessModal] = useState(false);

  // Clean filename helper
  const cleanSketchName = sketchName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'esp32_display_studio';

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
                  Arduino IDE 1.8 & 2.x
                </span>
                <span className="px-2 py-0.5 rounded ui-type-micro font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {lineCount} {t('common.lines')} · ~{approxSizeKb} KB
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
          </div>
        </div>
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
            <span>{copied ? 'Skopiowano!' : 'Kopiuj Kod'}</span>
          </button>

          {activeTab === 'ino' ? (
            <button
              onClick={() => handleDownloadIno()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-sm"
            >
              <Download className="ui-icon-sm" aria-hidden="true" />
              <span>Pobierz {cleanSketchName}.ino</span>
            </button>
          ) : (
            <button
              onClick={handleDownloadPlatformIo}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-sm"
            >
              <Download className="ui-icon-sm" aria-hidden="true" />
              <span>Pobierz platformio.ini</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab: Arduino .INO */}
      {activeTab === 'ino' && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800 font-mono">
            <span>esp32_display_studio.ino ({cppCode.split('\n').length} linii kodu)</span>
            <span className="text-cyan-400">Gotowy do skompilowania w Arduino IDE</span>
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
            <span>platformio.ini</span>
            <span className="text-cyan-400">Automatyczne pobieranie bibliotek lib_deps</span>
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
              Schemat Podłączenia Fizycznych Elementów do Płytki ESP32
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Podłącz przewody zgodnie z poniższą tabelą pinów GPIO:
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase ui-type-micro">
                  <th className="py-2.5 px-3">Moduł / Element</th>
                  <th className="py-2.5 px-3">Pin Modułu</th>
                  <th className="py-2.5 px-3">Pin ESP32</th>
                  <th className="py-2.5 px-3">Opis i Uwagi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                <tr className="hover:bg-slate-950/40">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">Wyświetlacz OLED</td>
                  <td className="py-2.5 px-3 text-rose-400">VCC</td>
                  <td className="py-2.5 px-3 text-rose-400">3.3V</td>
                  <td className="py-2.5 px-3 text-slate-400">Zasilanie 3.3V (nie podłączaj do 5V!)</td>
                </tr>
                <tr className="hover:bg-slate-950/40">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">Wyświetlacz OLED</td>
                  <td className="py-2.5 px-3 text-slate-400">GND</td>
                  <td className="py-2.5 px-3 text-slate-400">GND</td>
                  <td className="py-2.5 px-3 text-slate-400">Masa układu</td>
                </tr>
                <tr className="hover:bg-slate-950/40">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">Wyświetlacz OLED</td>
                  <td className="py-2.5 px-3 text-amber-400">SCL</td>
                  <td className="py-2.5 px-3 text-amber-400 font-bold">GPIO {display.sclPin}</td>
                  <td className="py-2.5 px-3 text-slate-400">Zegar magistrali I2C</td>
                </tr>
                <tr className="hover:bg-slate-950/40">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">Wyświetlacz OLED</td>
                  <td className="py-2.5 px-3 text-cyan-400">SDA</td>
                  <td className="py-2.5 px-3 text-cyan-400 font-bold">GPIO {display.sdaPin}</td>
                  <td className="py-2.5 px-3 text-slate-400">Linia danych magistrali I2C</td>
                </tr>
                <tr className="hover:bg-slate-950/40">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">Czujnik Ruchu PIR</td>
                  <td className="py-2.5 px-3 text-emerald-400">OUT</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">GPIO {system.pirPin ?? 14}</td>
                  <td className="py-2.5 px-3 text-slate-400">Sygnał cyfrowy (HIGH po wykryciu ruchu)</td>
                </tr>
                <tr className="hover:bg-slate-950/40">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">Fotorezystor LDR</td>
                  <td className="py-2.5 px-3 text-yellow-400">SIG / ADC</td>
                  <td className="py-2.5 px-3 text-yellow-400 font-bold">GPIO {system.ldrPin ?? 36}</td>
                  <td className="py-2.5 px-3 text-slate-400">Wejście analogowe ADC1 (pomiar natężenia światła)</td>
                </tr>
                <tr className="hover:bg-slate-950/40">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">Potencjometr Analogowy</td>
                  <td className="py-2.5 px-3 text-yellow-400">SIG / ADC</td>
                  <td className="py-2.5 px-3 text-yellow-400 font-bold">GPIO {system.potPin ?? 34}</td>
                  <td className="py-2.5 px-3 text-slate-400">Wejście analogowe ADC1 (0 - 4095)</td>
                </tr>
                <tr className="hover:bg-slate-950/40">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">PWM Buzzer / Sygnalizator</td>
                  <td className="py-2.5 px-3 text-amber-400">PWM IN</td>
                  <td className="py-2.5 px-3 text-amber-400 font-bold">GPIO {system.buzzerPin ?? 18}</td>
                  <td className="py-2.5 px-3 text-slate-400">Sprzętowy kanał PWM LEDC (tony, powiadomienia)</td>
                </tr>
                <tr className="hover:bg-slate-950/40">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">Przycisk BOOT</td>
                  <td className="py-2.5 px-3 text-slate-300">Wbudowany</td>
                  <td className="py-2.5 px-3 text-slate-300 font-bold">GPIO 0</td>
                  <td className="py-2.5 px-3 text-slate-400">Przycisk na płytce ESP32 (przełącza ekrany)</td>
                </tr>
                {display.touchEnabled && (
                  <>
                    <tr className="hover:bg-slate-950/40 bg-rose-950/10">
                      <td className="py-2.5 px-3 font-semibold text-rose-300">Ekran Dotykowy ({display.touchController.toUpperCase()})</td>
                      <td className="py-2.5 px-3 text-rose-400">Touch SDA / MOSI</td>
                      <td className="py-2.5 px-3 text-rose-400 font-bold">GPIO {display.touchSdaPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">Linia danych magistrali dotyku I2C/SPI</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-rose-950/10">
                      <td className="py-2.5 px-3 font-semibold text-rose-300">Ekran Dotykowy ({display.touchController.toUpperCase()})</td>
                      <td className="py-2.5 px-3 text-rose-400">Touch SCL / SCK</td>
                      <td className="py-2.5 px-3 text-rose-400 font-bold">GPIO {display.touchSclPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">Zegar magistrali dotyku I2C/SPI</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-rose-950/10">
                      <td className="py-2.5 px-3 font-semibold text-rose-300">Ekran Dotykowy ({display.touchController.toUpperCase()})</td>
                      <td className="py-2.5 px-3 text-rose-300">Touch INT (IRQ)</td>
                      <td className="py-2.5 px-3 text-rose-300 font-bold">GPIO {display.touchIntPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">Sygnał przerwania dotknięcia (Input Pullup)</td>
                    </tr>
                    <tr className="hover:bg-slate-950/40 bg-rose-950/10">
                      <td className="py-2.5 px-3 font-semibold text-rose-300">Ekran Dotykowy ({display.touchController.toUpperCase()})</td>
                      <td className="py-2.5 px-3 text-rose-300">Touch RST</td>
                      <td className="py-2.5 px-3 text-rose-300 font-bold">GPIO {display.touchRstPin}</td>
                      <td className="py-2.5 px-3 text-slate-400">Linia resetu kontrolera dotykowego</td>
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
              Instrukcja Wgrania Programu Krok po Kroku
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Jak szybko skompilować i wgrać ten kod na ESP32 za pomocą Arduino IDE lub PlatformIO.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center">1</span>
                <span>Zainstaluj Biblioteki w Arduino IDE</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                W menu Arduino IDE wybierz <strong>Sketch -&gt; Include Library -&gt; Manage Libraries...</strong> i wyszukaj:
              </p>
              <ul className="text-xs font-mono text-slate-300 space-y-1 list-disc list-inside">
                <li><code>Adafruit SSD1306</code> (kliknij "Install All" z zależnościami)</li>
                <li><code>Adafruit GFX Library</code></li>
                <li><code>ArduinoJson</code> (autor: Benoit Blanchon)</li>
              </ul>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center">2</span>
                <span>Wybierz Płytkę i Port COM</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                W menu <strong>Tools -&gt; Board</strong> wybierz <strong>ESP32 Arduino -&gt; ESP32 Dev Module</strong>.
                Następnie w <strong>Tools -&gt; Port</strong> wybierz port szeregowy przypisany do Twojego kabla USB.
              </p>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">3</span>
                <span>Wgraj Kod (Upload)</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Kliknij strzałkę <strong>Upload (Wgraj)</strong>. Jeśli w konsoli pojawi się <code>Connecting.......____</code>, przytrzymaj na 1 sekundę przycisk <strong>BOOT</strong> na płytce ESP32.
              </p>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">4</span>
                <span>Otwórz Monitor Szeregowy</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ustaw prędkość monitora na <strong>115200 baud</strong>. Zobaczysz komunikat o przydzielonym adresie IP Wi-Fi, inicjalizacji serwera HTTP oraz odczyty z sensorów!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
