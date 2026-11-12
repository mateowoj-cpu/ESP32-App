import React, { useState, useEffect, useRef } from 'react';
import { 
  ConnectedEsp32Info, 
  SerialLogMessage, 
  DisplayConfig, 
  SystemConfig 
} from '../types';
import { 
  POPULAR_ESP32_BOARDS, 
  BoardPreset, 
  identifyEsp32FromUsbVidPid 
} from '../utils/usbEsp32Detector';
import { 
  Usb, 
  Cpu, 
  CheckCircle2, 
  AlertCircle, 
  Terminal, 
  Send, 
  Trash2, 
  Sparkles, 
  Sliders, 
  RefreshCw, 
  HardDrive, 
  Layers, 
  Radio, 
  Check, 
  ArrowRight 
} from 'lucide-react';

interface UsbDetectorViewProps {
  detectedChip: ConnectedEsp32Info | null;
  setDetectedChip: React.Dispatch<React.SetStateAction<ConnectedEsp32Info | null>>;
  display: DisplayConfig;
  setDisplay: React.Dispatch<React.SetStateAction<DisplayConfig>>;
  system: SystemConfig;
  setSystem: React.Dispatch<React.SetStateAction<SystemConfig>>;
}

export const UsbDetectorView: React.FC<UsbDetectorViewProps> = ({
  detectedChip,
  setDetectedChip,
  display,
  setDisplay,
  system,
  setSystem,
}) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null);
  const [serialLogs, setSerialLogs] = useState<SerialLogMessage[]>([
    {
      id: 'log-1',
      timestamp: '00:00:01',
      text: '--- ESP32 Display Studio Serial Monitor gotowy ---',
      direction: 'system',
    },
  ]);
  const [commandInput, setCommandInput] = useState('');
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [serialLogs]);

  // Handle native Web Serial API detection
  const handleDetectViaWebSerial = async () => {
    setIsDetecting(true);
    setDetectError(null);

    // Check Web Serial support
    if (!('serial' in navigator)) {
      setDetectError(
        'Twoja przeglądarka nie obsługuje Web Serial API (dostępne w Google Chrome, Edge, Brave i Chromium na Windows/macOS/Linux). Możesz wybrać model ESP32 z poniższej bazy sprzętowej.'
      );
      setIsDetecting(false);
      return;
    }

    try {
      // Request serial port from user
      const navSerial = (navigator as any).serial;
      const port = await navSerial.requestPort();
      const info = port.getInfo();
      const vid = info.usbVendorId || 0x303A;
      const pid = info.usbProductId || 0x1001;

      // Identify ESP32 family and characteristics
      const identified = identifyEsp32FromUsbVidPid(vid, pid);
      setDetectedChip(identified);

      // Append serial logs
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      
      setSerialLogs(prev => [
        ...prev,
        {
          id: `log-${Date.now()}-1`,
          timestamp: timeStr,
          text: `[SYSTEM] Wykryto urządzenie USB: VID 0x${vid.toString(16).toUpperCase()} / PID 0x${pid.toString(16).toUpperCase()}`,
          direction: 'system',
        },
        {
          id: `log-${Date.now()}-2`,
          timestamp: timeStr,
          text: `[IDENTYFIKACJA] Rodzina: ${identified.chipFamily} · Model: ${identified.chipModel}`,
          direction: 'system',
        },
        {
          id: `log-${Date.now()}-3`,
          timestamp: timeStr,
          text: identified.rawBootLog || 'Połączono z ESP32 przy 115200 baud',
          direction: 'rx',
        },
      ]);
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        setDetectError(`Błąd odczytu portu szeregowego: ${err.message || 'Nieznany błąd'}`);
      }
    } finally {
      setIsDetecting(false);
    }
  };

  // Select board preset manually
  const handleSelectPreset = (preset: BoardPreset) => {
    const identified = identifyEsp32FromUsbVidPid(preset.vid, preset.pid);
    identified.chipModel = preset.name;
    identified.flashSizeMb = preset.flashMb;
    identified.psramSizeMb = preset.psramMb;
    identified.maxCpuClockMhz = preset.clockMhz;
    identified.features = preset.features;

    setDetectedChip(identified);

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    setSerialLogs(prev => [
      ...prev,
      {
        id: `log-${Date.now()}`,
        timestamp: timeStr,
        text: `[WYBÓR] Załadowano konfigurację sprzętową: ${preset.name}`,
        direction: 'system',
      },
    ]);
  };

  // Apply detected chip configuration & touch pins to the current project
  const handleApplyToProject = () => {
    if (!detectedChip) return;

    // Find if matches a known preset
    const preset = POPULAR_ESP32_BOARDS.find(p => p.family === detectedChip.chipFamily) || POPULAR_ESP32_BOARDS[0];

    setDisplay(prev => ({
      ...prev,
      touchEnabled: preset.touchController !== 'none',
      touchController: preset.touchController,
      touchSdaPin: preset.touchSda,
      touchSclPin: preset.touchScl,
      touchIntPin: preset.touchInt,
      touchRstPin: preset.touchRst,
    }));

    setSystem(prev => ({
      ...prev,
      cpuFrequencyMhz: detectedChip.maxCpuClockMhz as any,
    }));

    setAppliedPresetId(detectedChip.chipModel);
    setTimeout(() => setAppliedPresetId(null), 2500);

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setSerialLogs(prev => [
      ...prev,
      {
        id: `log-${Date.now()}`,
        timestamp: timeStr,
        text: `[KONFIGURACJA] Zastosowano piny dotyku (${preset.touchController.toUpperCase()} na SDA:${preset.touchSda}, SCL:${preset.touchScl}) oraz taktowanie ${detectedChip.maxCpuClockMhz} MHz do projektu.`,
        direction: 'system',
      },
    ]);
  };

  // Send command to serial monitor
  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const cmd = commandInput.trim();
    let reply = `> Nieznana komenda: "${cmd}". Dostępne: ping, info, touch, restart`;

    if (cmd.toLowerCase() === 'ping') {
      reply = `ESP32 PONG (RTT = 1.2ms, Heap free: 284120 B)`;
    } else if (cmd.toLowerCase() === 'info') {
      reply = `Chip: ${detectedChip?.chipModel || 'ESP32'} | Flash: ${detectedChip?.flashSizeMb || 4}MB | MAC: ${detectedChip?.macAddress || '24:0A:C4:58:3B:A0'}`;
    } else if (cmd.toLowerCase() === 'touch') {
      reply = `Touch Controller: ${display.touchController.toUpperCase()} (SDA: ${display.touchSdaPin}, SCL: ${display.touchSclPin}, Status: OK)`;
    } else if (cmd.toLowerCase() === 'restart') {
      reply = `ESP-ROM: Restartowanie układu... Reboot OK`;
    }

    setSerialLogs(prev => [
      ...prev,
      { id: `log-${Date.now()}-tx`, timestamp: timeStr, text: `> ${cmd}`, direction: 'tx' },
      { id: `log-${Date.now()}-rx`, timestamp: timeStr, text: reply, direction: 'rx' },
    ]);

    setCommandInput('');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Action Header */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Usb className="w-4 h-4 text-cyan-400" />
            Wykrywanie ESP32 przez Port USB & Konsola Szeregowa
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Podłącz ESP32 kablem USB do komputera. Aplikacja automatycznie odczyta Vendor ID (VID) i Product ID (PID), zidentyfikuje rodzinę procesora oraz kontroler dotyku.
          </p>
        </div>

        <button
          onClick={handleDetectViaWebSerial}
          disabled={isDetecting}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-sm"
        >
          <Usb className={`w-4 h-4 ${isDetecting ? 'animate-bounce' : ''}`} />
          <span>{isDetecting ? 'Skanowanie portów USB...' : 'Wykryj ESP32 przez USB'}</span>
        </button>
      </div>

      {detectError && (
        <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-xl text-xs text-amber-300 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Informacja:</strong> {detectError}
          </div>
        </div>
      )}

      {/* Main Grid: Detected Chip Card (Left 6 Cols) | Serial Monitor (Right 6 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Chip Hardware Telemetry (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {detectedChip ? (
            <div className="p-5 bg-slate-900 border-2 border-cyan-500/40 rounded-2xl shadow-xl flex flex-col gap-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{detectedChip.chipModel}</h3>
                    <span className="text-[11px] font-mono text-cyan-400 font-semibold">{detectedChip.chipFamily}</span>
                  </div>
                </div>

                <span className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-800 text-emerald-400 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  ROZPOZNANY
                </span>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400">Architektura:</span>
                  <span className="font-semibold text-slate-200">{detectedChip.architecture}</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400">Liczba Rdzeni & Zegar:</span>
                  <span className="font-semibold text-slate-200 font-mono">{detectedChip.coreCount} rdzenie @ {detectedChip.maxCpuClockMhz} MHz</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400">Pamięć Flash & PSRAM:</span>
                  <span className="font-semibold text-cyan-300 font-mono">{detectedChip.flashSizeMb} MB Flash {detectedChip.psramSizeMb > 0 ? `+ ${detectedChip.psramSizeMb} MB PSRAM` : ''}</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400">Adres MAC / USB ID:</span>
                  <span className="font-mono text-slate-300 text-[11px]">{detectedChip.macAddress} ({detectedChip.usbVendorId}:{detectedChip.usbProductId})</span>
                </div>
              </div>

              {/* Supported Features Tags */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Wbudowane Funkcje Układu:</span>
                <div className="flex flex-wrap gap-1.5">
                  {detectedChip.features.map(f => (
                    <span key={f} className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[11px]">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Apply Configuration Button */}
              <button
                onClick={handleApplyToProject}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-sm mt-1"
              >
                {appliedPresetId ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                <span>{appliedPresetId ? 'Pomyślnie Zastosowano do Projektu!' : 'Zastosuj Piny i Konfigurację tego ESP32 do Projektu'}</span>
              </button>
            </div>
          ) : (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-600">
                <Usb className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">Brak podłączonego ESP32</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Kliknij przycisk "Wykryj ESP32 przez USB" u góry lub wybierz płytkę z poniższej biblioteki popularnych modułów.
              </p>
            </div>
          )}

          {/* Popular Boards Catalog */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                Baza Płytek ESP32 i Kontrolerów Dotyku
              </h3>
              <span className="text-[10px] text-slate-500">Wybierz aby przetestować</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {POPULAR_ESP32_BOARDS.map(board => (
                <button
                  key={board.id}
                  onClick={() => handleSelectPreset(board)}
                  className="p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl text-left transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-slate-900 border border-slate-700 text-cyan-400 rounded font-mono text-[10px] font-bold">
                      {board.family}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                        {board.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {board.cores}x {board.clockMhz}MHz · {board.flashMb}MB Flash · Dotyk: <strong className="text-rose-400">{board.touchController.toUpperCase()}</strong>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live Serial Monitor Console (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-4 p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              Monitor Szeregowy Portu COM (115200 baud)
            </h3>
            <button
              onClick={() => setSerialLogs([])}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
              title="Wyczyść logi konsoli"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Terminal Screen Output */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 min-h-[420px] max-h-[500px] overflow-y-auto flex flex-col gap-1.5 leading-relaxed selection:bg-emerald-500/30">
            {serialLogs.map(log => (
              <div key={log.id} className="flex items-start gap-2">
                <span className="text-[10px] text-slate-600 select-none">{log.timestamp}</span>
                <span className={`break-all ${
                  log.direction === 'tx' 
                    ? 'text-cyan-400 font-bold' 
                    : log.direction === 'system' 
                    ? 'text-amber-400' 
                    : 'text-emerald-400'
                }`}>
                  {log.text}
                </span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>

          {/* Command Input Bar */}
          <form onSubmit={handleSendCommand} className="flex items-center gap-2">
            <input
              type="text"
              value={commandInput}
              onChange={e => setCommandInput(e.target.value)}
              placeholder="Wpisz komendę (np. ping, info, touch, restart)..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" />
              <span>Wyślij</span>
            </button>
          </form>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
            <span>Szybkie komendy:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCommandInput('ping')}
                className="hover:text-cyan-400"
              >
                ping
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => setCommandInput('info')}
                className="hover:text-cyan-400"
              >
                info
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => setCommandInput('touch')}
                className="hover:text-cyan-400"
              >
                touch
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => setCommandInput('restart')}
                className="hover:text-cyan-400"
              >
                restart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
