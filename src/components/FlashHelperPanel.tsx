import React, { useEffect, useRef, useState } from 'react';
import { ConnectedEsp32Info } from '../types';
import { getSerialAdapter, type SerialPortInfo } from '../platform';
import type { EsptoolInfo } from '../platform/flash';
import type { BuildResult, ToolchainInfo } from '../platform/firmwareBuild';
import { useLocale } from '../i18n/LocaleContext';
import { loadBoardPreset, saveBoardPreset } from '../platform/boardCache';
import { appendDiagnosticsLog } from '../platform/diagnostics';
import {
  Zap,
  RefreshCw,
  FolderOpen,
  AlertCircle,
  CheckCircle2,
  Terminal,
  Hammer,
  Play,
} from 'lucide-react';

export interface SketchBuildSources {
  sketchSource: string;
  platformioIni: string;
  boardProfile: string;
  sketchName?: string;
}

interface FlashHelperPanelProps {
  detectedChip: ConnectedEsp32Info | null;
  buildSources?: () => SketchBuildSources;
}

export const FlashHelperPanel: React.FC<FlashHelperPanelProps> = ({
  detectedChip,
  buildSources,
}) => {
  const { t } = useLocale();
  const [isTauri, setIsTauri] = useState(false);
  const [esptool, setEsptool] = useState<EsptoolInfo | null>(null);
  const [toolchain, setToolchain] = useState<ToolchainInfo | null>(null);
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [portId, setPortId] = useState('');
  const [baud, setBaud] = useState(460800);
  const [chip, setChip] = useState('auto');
  const [offset, setOffset] = useState('0x1000');
  const [firmwarePath, setFirmwarePath] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [lastBuild, setLastBuild] = useState<BuildResult | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (detectedChip?.portName) {
      setPortId(detectedChip.portName);
    }
    const cached = loadBoardPreset(
      detectedChip?.usbVendorId,
      detectedChip?.usbProductId,
      detectedChip?.portName,
    );
    if (cached) {
      setChip(cached.chip);
      setOffset(cached.offset);
      setBaud(cached.baud);
      return;
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
      const { getFirmwareToolchainInfo, listenBuildLog } = await import('../platform/firmwareBuild');
      setEsptool(await getEsptoolInfo());
      setToolchain(await getFirmwareToolchainInfo());
      const adapter = getSerialAdapter();
      if (adapter.listPorts) {
        const listed = await adapter.listPorts();
        setPorts(listed);
        if (!portId && listed[0]) setPortId(listed[0].id || listed[0].label);
      }
      const unFlash = await listenFlashLog(line => {
        setLogs(prev => [...prev.slice(-300), `[flash] ${line}`]);
      });
      const unBuild = await listenBuildLog(line => {
        setLogs(prev => [...prev.slice(-300), `[build] ${line}`]);
      });
      return () => {
        unFlash();
        unBuild();
      };
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

  const handleBuild = async (): Promise<string | null> => {
    if (!buildSources) {
      setStatus('Brak generatora szkicu — otwórz projekt w Studio.');
      return null;
    }
    setBusy(true);
    setStatus(null);
    setLogs(prev => [...prev, '--- start build ---']);
    try {
      const sources = buildSources();
      const { buildFirmwareFromSketch } = await import('../platform/firmwareBuild');
      const result = await buildFirmwareFromSketch({
        sketchSource: sources.sketchSource,
        platformioIni: sources.platformioIni,
        boardProfile: sources.boardProfile || chip,
        sketchName: sources.sketchName,
      });
      setLastBuild(result);
      setStatus(result.message);
      void appendDiagnosticsLog(result.message, 'build');
      if (result.ok && result.firmwarePath) {
        setFirmwarePath(result.firmwarePath);
        saveBoardPreset(detectedChip?.usbVendorId, detectedChip?.usbProductId, portId, {
          chip,
          offset,
          baud,
          boardProfile: sources.boardProfile || chip,
        });
        return result.firmwarePath;
      }
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(msg);
      void appendDiagnosticsLog(msg, 'build');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleFlash = async (pathOverride?: string) => {
    const path = pathOverride || firmwarePath;
    if (!portId || !path) {
      setStatus('Wybierz port COM i plik .bin (lub zbuduj firmware).');
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
        firmwarePath: path,
        flashOffset: offset,
      });
      setStatus(result.message);
      void appendDiagnosticsLog(
        `${result.message} port=${portId} chip=${chip} offset=${offset}`,
        'flash',
      );
      if (result.ok) {
        saveBoardPreset(detectedChip?.usbVendorId, detectedChip?.usbProductId, portId, {
          chip,
          offset,
          baud,
          boardProfile: chip,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(msg);
      void appendDiagnosticsLog(msg, 'flash');
    } finally {
      setBusy(false);
    }
  };

  const handleBuildAndFlash = async () => {
    const built = await handleBuild();
    if (built) {
      await handleFlash(built);
    }
  };

  if (!isTauri) {
    return (
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-3">
        <h3 className="ui-type-title text-slate-100 flex items-center gap-2">
          <Zap className="ui-icon-sm text-amber-400" aria-hidden="true" />
          {t('flash.titleBrowser')}
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">{t('flash.browserHint')}</p>
        <p className="ui-type-micro font-mono text-slate-500">
          pip install platformio && pio run · pip install esptool
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <h3 className="ui-type-title text-slate-100 flex items-center gap-2">
          <Zap className="ui-icon-sm text-amber-400" aria-hidden="true" />
          {t('flash.title')}
        </h3>
        <button
          type="button"
          onClick={() => void refresh()}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          title="Odśwież toolchain / porty"
        >
          <RefreshCw className="ui-icon-sm" aria-hidden="true" />
        </button>
      </div>

      <div
        className={`ui-type-micro font-mono px-2.5 py-1.5 rounded-lg border ${
          toolchain?.available
            ? 'text-emerald-300 bg-emerald-950/40 border-emerald-800/60'
            : 'text-amber-200 bg-amber-950/40 border-amber-800/60'
        }`}
      >
        {toolchain?.hint || t('flash.checkingToolchain')}
      </div>

      <div
        className={`ui-type-micro font-mono px-2.5 py-1.5 rounded-lg border ${
          esptool?.available
            ? 'text-emerald-300 bg-emerald-950/40 border-emerald-800/60'
            : 'text-amber-200 bg-amber-950/40 border-amber-800/60'
        }`}
      >
        {esptool?.hint || t('flash.checkingEsptool')}
      </div>

      {!toolchain?.available && (
        <p className="text-xs text-slate-400 flex gap-2 items-start">
          <AlertCircle className="ui-icon-sm text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          {t('flash.installToolchain')}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-slate-400">{t('flash.port')}</span>
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
          <span className="text-slate-400">{t('flash.chip')}</span>
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
          <span className="text-slate-400">{t('flash.baud')}</span>
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
          <span className="text-slate-400">{t('flash.offset')}</span>
          <input
            value={offset}
            onChange={e => setOffset(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="ui-type-micro text-slate-400">{t('flash.firmware')}</span>
        <div className="flex gap-2">
          <input
            value={firmwarePath}
            onChange={e => setFirmwarePath(e.target.value)}
            placeholder=".bin"
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono"
          />
          <button
            type="button"
            onClick={() => void handlePickFirmware()}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs flex items-center gap-1.5"
          >
            <FolderOpen className="ui-icon-sm" aria-hidden="true" />
            {t('flash.pick')}
          </button>
        </div>
        {lastBuild?.projectDir && (
          <p className="ui-type-micro text-slate-500 font-mono truncate" title={lastBuild.projectDir}>
            Projekt: {lastBuild.projectDir}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          disabled={busy || !toolchain?.available || !buildSources}
          onClick={() => void handleBuild()}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 border border-slate-700 font-semibold rounded-xl text-xs transition-colors"
        >
          <Hammer className={`ui-icon-sm ${busy ? 'animate-pulse' : ''}`} aria-hidden="true" />
          {t('flash.build')}
        </button>
        <button
          type="button"
          disabled={busy || !esptool?.available}
          onClick={() => void handleFlash()}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 text-amber-200 border border-amber-500/40 font-semibold rounded-xl text-xs transition-colors"
        >
          <Zap className="ui-icon-sm" aria-hidden="true" />
          {t('flash.flash')}
        </button>
        <button
          type="button"
          disabled={busy || !toolchain?.available || !esptool?.available || !buildSources}
          onClick={() => void handleBuildAndFlash()}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl text-xs transition-colors"
        >
          <Play className={`ui-icon-sm ${busy ? 'animate-pulse' : ''}`} aria-hidden="true" />
          {t('flash.buildFlash')}
        </button>
      </div>

      {status && (
        <div className="flex items-start gap-2 text-xs text-slate-200">
          {status.toLowerCase().includes('zbudowano') ||
          status.toLowerCase().includes('wgrany') ||
          status.toLowerCase().includes('sukces') ? (
            <CheckCircle2 className="ui-icon-sm text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <AlertCircle className="ui-icon-sm text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <span>{status}</span>
        </div>
      )}

      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-48 overflow-y-auto">
        <div className="flex items-center gap-1.5 ui-type-micro uppercase font-mono text-slate-500 mb-2">
          <Terminal className="ui-icon-sm" aria-hidden="true" />
          {t('flash.log')}
        </div>
        {logs.length === 0 ? (
          <p className="ui-type-micro text-slate-600 font-mono">{t('flash.noLogs')}</p>
        ) : (
          logs.map((line, i) => (
            <div
              key={`${i}-${line.slice(0, 16)}`}
              className="ui-type-micro font-mono text-slate-300 whitespace-pre-wrap"
            >
              {line}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};
