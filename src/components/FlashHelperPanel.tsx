import React, { useEffect, useRef, useState } from 'react';
import { ConnectedEsp32Info } from '../types';
import { getSerialAdapter, type SerialPortInfo } from '../platform';
import type { EsptoolInfo } from '../platform/flash';
import {
  Zap,
  RefreshCw,
  FolderOpen,
  AlertCircle,
  CheckCircle2,
  Terminal,
} from 'lucide-react';

interface FlashHelperPanelProps {
  detectedChip: ConnectedEsp32Info | null;
}

export const FlashHelperPanel: React.FC<FlashHelperPanelProps> = ({ detectedChip }) => {
  const [isTauri, setIsTauri] = useState(false);
  const [esptool, setEsptool] = useState<EsptoolInfo | null>(null);
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [portId, setPortId] = useState('');
  const [baud, setBaud] = useState(460800);
  const [chip, setChip] = useState('auto');
  const [offset, setOffset] = useState('0x1000');
  const [firmwarePath, setFirmwarePath] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (detectedChip?.portName) {
      setPortId(detectedChip.portName);
    }
    if (detectedChip?.chipFamily) {
      const family = detectedChip.chipFamily.toLowerCase();
      if (family.includes('c3')) setChip('esp32c3');
      else if (family.includes('s3')) setChip('esp32s3');
      else if (family.includes('s2')) setChip('esp32s2');
      else if (family.includes('c6')) setChip('esp32c6');
      else if (family.includes('esp32')) setChip('esp32');
    }
  }, [detectedChip]);

  const refresh = async () => {
    try {
      const { isTauri: check } = await import('@tauri-apps/api/core');
      if (!check()) {
        setIsTauri(false);
        return;
      }
      setIsTauri(true);
      const { getEsptoolInfo, listenFlashLog } = await import('../platform/flash');
      setEsptool(await getEsptoolInfo());
      const adapter = getSerialAdapter();
      if (adapter.listPorts) {
        const listed = await adapter.listPorts();
        setPorts(listed);
        if (!portId && listed[0]) setPortId(listed[0].id || listed[0].label);
      }
      return listenFlashLog(line => {
        setLogs(prev => [...prev.slice(-200), line]);
      });
    } catch {
      setIsTauri(false);
    }
  };

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await refresh();
    })();
    return () => {
      unlisten?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePickFirmware = async () => {
    try {
      const { pickFirmwareFile } = await import('../platform/flash');
      const path = await pickFirmwareFile();
      if (path) setFirmwarePath(path);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  };

  const handleFlash = async () => {
    if (!portId || !firmwarePath) {
      setStatus('Wybierz port COM i plik .bin.');
      return;
    }
    setBusy(true);
    setStatus(null);
    setLogs(prev => [...prev, '--- start flash ---']);
    try {
      const { flashWriteFirmware } = await import('../platform/flash');
      const result = await flashWriteFirmware({
        port: portId,
        baud,
        chip,
        firmwarePath,
        flashOffset: offset,
      });
      setStatus(result.message);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!isTauri) {
    return (
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Flash helper (esptool)
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Wgrywanie firmware dostępne w aplikacji desktop (Tauri). W przeglądarce pobierz{' '}
          <code className="text-cyan-400">.ino</code>, zbuduj binarkę w Arduino/PlatformIO i użyj
          esptool ręcznie.
        </p>
        <p className="text-[11px] font-mono text-slate-500">
          pip install esptool && esptool.py --port COMx write_flash 0x1000 firmware.bin
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Flash helper (esptool)
        </h3>
        <button
          type="button"
          onClick={() => void refresh()}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          title="Odśwież esptool / porty"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div
        className={`text-[11px] font-mono px-2.5 py-1.5 rounded-lg border ${
          esptool?.available
            ? 'text-emerald-300 bg-emerald-950/40 border-emerald-800/60'
            : 'text-amber-200 bg-amber-950/40 border-amber-800/60'
        }`}
      >
        {esptool?.hint || 'Sprawdzanie esptool…'}
      </div>

      {!esptool?.available && (
        <p className="text-xs text-slate-400 flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          Zainstaluj: <code className="text-cyan-400">pip install esptool</code> i upewnij się, że
          Python jest w PATH.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-slate-400">Port COM</span>
          {ports.length > 0 ? (
            <select
              value={portId}
              onChange={e => setPortId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono"
            >
              {ports.map(p => (
                <option key={p.id || p.label} value={p.id || p.label}>
                  {p.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={portId}
              onChange={e => setPortId(e.target.value)}
              placeholder="COM3"
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono"
            />
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-400">Chip</span>
          <select
            value={chip}
            onChange={e => setChip(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono"
          >
            <option value="auto">auto</option>
            <option value="esp32">esp32</option>
            <option value="esp32s2">esp32s2</option>
            <option value="esp32s3">esp32s3</option>
            <option value="esp32c3">esp32c3</option>
            <option value="esp32c6">esp32c6</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-400">Baud</span>
          <select
            value={baud}
            onChange={e => setBaud(Number(e.target.value))}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono"
          >
            <option value={115200}>115200</option>
            <option value={230400}>230400</option>
            <option value={460800}>460800</option>
            <option value={921600}>921600</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-400">Offset flash</span>
          <input
            value={offset}
            onChange={e => setOffset(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] text-slate-400">Plik firmware (.bin)</span>
        <div className="flex gap-2">
          <input
            value={firmwarePath}
            onChange={e => setFirmwarePath(e.target.value)}
            placeholder="C:\build\firmware.bin"
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono"
          />
          <button
            type="button"
            onClick={() => void handlePickFirmware()}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs flex items-center gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Wybierz
          </button>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Najpierw zbuduj firmware w Arduino IDE / PlatformIO (Studio generuje .ino). esptool
          wgrywa gotowy .bin — nie kompiluje szkicu.
        </p>
      </div>

      <button
        type="button"
        disabled={busy || !esptool?.available}
        onClick={() => void handleFlash()}
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl text-xs transition-colors"
      >
        <Zap className={`w-4 h-4 ${busy ? 'animate-pulse' : ''}`} />
        {busy ? 'Wgrywanie…' : 'Wgraj firmware (write_flash)'}
      </button>

      {status && (
        <div className="flex items-start gap-2 text-xs text-slate-200">
          {status.toLowerCase().includes('sukces') || status.toLowerCase().includes('wgrany') ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <span>{status}</span>
        </div>
      )}

      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-40 overflow-y-auto">
        <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono text-slate-500 mb-2">
          <Terminal className="w-3 h-3" />
          Log esptool
        </div>
        {logs.length === 0 ? (
          <p className="text-[11px] text-slate-600 font-mono">Brak logów.</p>
        ) : (
          logs.map((line, i) => (
            <div key={`${i}-${line.slice(0, 12)}`} className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
              {line}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};
