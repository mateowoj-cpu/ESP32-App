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
  boardNameKey,
  identifyEsp32FromUsbVidPid 
} from '../utils/usbEsp32Detector';
import {
  getSerialAdapter,
  isSerialRequestCancelled,
  SerialRequestCancelledError,
  type OpenSerialPort,
  type SerialBackendKind,
  type SerialPortInfo,
} from '../platform';
import {
  WINDOWS_DRIVERS_DOC_URL,
  WINDOWS_USB_DRIVER_HINTS,
  dismissWindowsDriverTip,
  isWindowsDriverTipDismissed,
  looksLikeWindowsHost,
} from '../platform/windowsDrivers';
import { FlashHelperPanel, type SketchBuildSources } from './FlashHelperPanel';
import { useLocale } from '../i18n/LocaleContext';
import { 
  Usb, 
  Cpu, 
  AlertCircle, 
  Terminal, 
  Send, 
  Trash2, 
  Check, 
  ArrowRight,
  RefreshCw,
  ExternalLink,
  BookOpen,
  X,
} from 'lucide-react';

interface UsbDetectorViewProps {
  detectedChip: ConnectedEsp32Info | null;
  setDetectedChip: React.Dispatch<React.SetStateAction<ConnectedEsp32Info | null>>;
  display: DisplayConfig;
  setDisplay: React.Dispatch<React.SetStateAction<DisplayConfig>>;
  system: SystemConfig;
  setSystem: React.Dispatch<React.SetStateAction<SystemConfig>>;
  buildSources?: () => SketchBuildSources;
}

function formatClockTimestamp(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}

export const UsbDetectorView: React.FC<UsbDetectorViewProps> = ({
  detectedChip,
  setDetectedChip,
  display,
  setDisplay,
  system,
  setSystem,
  buildSources,
}) => {
  const { t } = useLocale();
  const backendLabel = (kind: SerialBackendKind): string => {
    switch (kind) {
      case 'web':
        return 'Web Serial';
      case 'mock':
        return 'Mock';
      case 'native':
        return 'Native COM';
      default:
        return t('usb.backend.unavailable');
    }
  };
  const serialAdapter = getSerialAdapter();
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null);
  const [serialBackend] = useState<SerialBackendKind>(() => serialAdapter.kind);
  const [portConnected, setPortConnected] = useState(false);
  const [serialLogs, setSerialLogs] = useState<SerialLogMessage[]>([
    {
      id: 'log-1',
      timestamp: '00:00:01',
      text: t('usb.log.ready').replace('{backend}', backendLabel(serialAdapter.kind)),
      direction: 'system',
    },
  ]);
  const [commandInput, setCommandInput] = useState('');
  const [availablePorts, setAvailablePorts] = useState<SerialPortInfo[]>([]);
  const [showPortPicker, setShowPortPicker] = useState(false);
  const [showDriverHelp, setShowDriverHelp] = useState(() => {
    if (isWindowsDriverTipDismissed()) return false;
    return serialAdapter.kind === 'native' || looksLikeWindowsHost();
  });
  const [noPortsFound, setNoPortsFound] = useState(false);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const openPortRef = useRef<OpenSerialPort | null>(null);
  const rxBufferRef = useRef('');

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [serialLogs]);

  // Close open port when leaving the view
  useEffect(() => {
    return () => {
      void openPortRef.current?.close();
      openPortRef.current = null;
    };
  }, []);

  const appendLogs = (entries: Omit<SerialLogMessage, 'id'>[]) => {
    const stamp = Date.now();
    setSerialLogs(prev => [
      ...prev,
      ...entries.map((entry, index) => ({
        ...entry,
        id: `log-${stamp}-${index}`,
      })),
    ]);
  };

  const attachOpenPort = (port: OpenSerialPort) => {
    void openPortRef.current?.close();
    openPortRef.current = port;
    setPortConnected(true);
    rxBufferRef.current = '';

    port.onData(chunk => {
      rxBufferRef.current += chunk;
      const parts = rxBufferRef.current.split(/\r?\n/);
      rxBufferRef.current = parts.pop() ?? '';
      const lines = parts.map(line => line.trimEnd()).filter(Boolean);
      if (lines.length === 0) return;
      const timestamp = formatClockTimestamp();
      appendLogs(lines.map(text => ({ timestamp, text, direction: 'rx' as const })));
    });

    port.onDisconnect(() => {
      if (openPortRef.current === port) {
        openPortRef.current = null;
        setPortConnected(false);
        appendLogs([
          {
            timestamp: formatClockTimestamp(),
            text: t('usb.log.disconnected'),
            direction: 'system',
          },
        ]);
      }
    });
  };

  const connectOpenedPort = (port: OpenSerialPort) => {
    const vid = port.info.usbVendorId || 0x303a;
    const pid = port.info.usbProductId || 0x1001;

    const identified = identifyEsp32FromUsbVidPid(vid, pid);
    identified.portName = port.info.label;
    identified.baudRate = 115200;
    if (identified.featureKeys?.length) {
      identified.features = identified.featureKeys.map(key => t(key));
    }
    setDetectedChip(identified);
    attachOpenPort(port);
    setShowPortPicker(false);

    const timeStr = formatClockTimestamp();
    appendLogs([
      {
        timestamp: timeStr,
        text: t('usb.log.detected')
          .replace('{backend}', backendLabel(serialAdapter.kind))
          .replace('{vid}', `0x${vid.toString(16).toUpperCase().padStart(4, '0')}`)
          .replace('{pid}', `0x${pid.toString(16).toUpperCase().padStart(4, '0')}`)
          .replace('{label}', port.info.label),
        direction: 'system',
      },
      {
        timestamp: timeStr,
        text: t('usb.log.identified')
          .replace('{family}', identified.chipFamily)
          .replace('{model}', identified.chipModel),
        direction: 'system',
      },
      {
        timestamp: timeStr,
        text: identified.rawBootLog || t('usb.log.connected'),
        direction: 'rx',
      },
    ]);
  };

  const openPortById = async (portId?: string) => {
    const port = await serialAdapter.requestPort({
      baudRate: 115200,
      portId,
    });
    connectOpenedPort(port);
  };

  // Detect ESP32 through the platform serial adapter (Web Serial / Native COM)
  const handleDetectViaSerial = async () => {
    setIsDetecting(true);
    setDetectError(null);

    if (!serialAdapter.isAvailable()) {
      setDetectError(
        serialAdapter.unavailableReason() ||
          t('usb.err.unavailable')
      );
      setIsDetecting(false);
      return;
    }

    try {
      if (serialAdapter.kind === 'native') {
        const ports = await serialAdapter.listPorts();
        setAvailablePorts(ports);
        if (ports.length === 0) {
          setDetectError(
            t('usb.err.noPorts')
          );
          setShowPortPicker(false);
          setNoPortsFound(true);
          setShowDriverHelp(true);
          return;
        }
        setNoPortsFound(false);
        if (ports.length > 1) {
          setShowPortPicker(true);
          setDetectError(t('usb.err.manyPorts'));
          appendLogs([
            {
              timestamp: formatClockTimestamp(),
              text: `[SYSTEM] Dostępne porty: ${ports.map(p => p.label).join(' | ')}`,
              direction: 'system',
            },
          ]);
          return;
        }
        await openPortById(ports[0].id);
        return;
      }

      await openPortById();
    } catch (err: unknown) {
      if (err instanceof SerialRequestCancelledError || isSerialRequestCancelled(err)) {
        const message = err instanceof Error ? err.message : t('usb.err.cancelled');
        if (message.includes('Wybierz port') || message.includes('wiele')) {
          try {
            const ports = await serialAdapter.listPorts();
            setAvailablePorts(ports);
            setShowPortPicker(ports.length > 0);
          } catch {
            // ignore refresh errors
          }
          setDetectError(message);
        }
        // User dismissed browser picker — silent.
      } else {
        const message = err instanceof Error ? err.message : t('usb.err.unknown');
        setDetectError(t('usb.err.read').replace('{message}', message));
      }
    } finally {
      setIsDetecting(false);
    }
  };

  const handlePickNativePort = async (portId: string) => {
    setIsDetecting(true);
    setDetectError(null);
    try {
      await openPortById(portId);
    } catch (err: unknown) {
      if (!isSerialRequestCancelled(err)) {
        const message = err instanceof Error ? err.message : t('usb.err.unknown');
        setDetectError(t('usb.err.open').replace('{message}', message));
      }
    } finally {
      setIsDetecting(false);
    }
  };

  const handleRefreshNativePorts = async () => {
    try {
      const ports = await serialAdapter.listPorts();
      setAvailablePorts(ports);
      setShowPortPicker(true);
      setNoPortsFound(ports.length === 0);
      if (ports.length === 0) {
        setShowDriverHelp(true);
        setDetectError(t('usb.err.noPortsRefresh'));
      } else {
        setDetectError(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('usb.err.unknown');
      setDetectError(t('usb.err.refresh').replace('{message}', message));
    }
  };

  const handleDismissDriverHelp = () => {
    dismissWindowsDriverTip();
    setShowDriverHelp(false);
  };

  // Select board preset manually
  const handleSelectPreset = (preset: BoardPreset) => {
    const identified = identifyEsp32FromUsbVidPid(preset.vid, preset.pid);
    const localizedName = t(boardNameKey(preset.id));
    identified.chipModel = localizedName;
    identified.flashSizeMb = preset.flashMb;
    identified.psramSizeMb = preset.psramMb;
    identified.maxCpuClockMhz = preset.clockMhz;
    identified.features = preset.featureKeys.map(key => t(key));

    setDetectedChip(identified);

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    setSerialLogs(prev => [
      ...prev,
      {
        id: `log-${Date.now()}`,
        timestamp: timeStr,
        text: `[SELECT] ${localizedName}`,
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

  // Send command to serial monitor (live port when open; otherwise local simulation)
  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    const timeStr = formatClockTimestamp();
    const cmd = commandInput.trim();
    setCommandInput('');

    appendLogs([{ timestamp: timeStr, text: `> ${cmd}`, direction: 'tx' }]);

    const openPort = openPortRef.current;
    if (openPort) {
      try {
        await openPort.write(`${cmd}\n`);
        // Live / mock RX arrives via onData subscribers.
        return;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Nieznany błąd zapisu';
        appendLogs([
          {
            timestamp: formatClockTimestamp(),
            text: `[SYSTEM] Błąd zapisu na port: ${message}`,
            direction: 'system',
          },
        ]);
        return;
      }
    }

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

    appendLogs([{ timestamp: timeStr, text: reply, direction: 'rx' }]);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Action Header */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="ui-type-title text-slate-100 flex items-center gap-2">
            <Usb className="ui-icon-md text-cyan-400" aria-hidden="true" />
            {t('usb.title')}
          </h2>
          <p className="ui-type-caption text-slate-400 mt-1 max-w-prose leading-relaxed">
            {t('usb.noDeviceHint')}
          </p>
          <p className="ui-type-micro text-slate-500 mt-1 font-mono">
            Backend: {backendLabel(serialBackend)}
            {portConnected ? ` · ${t('usb.portOpen')}` : ` · ${t('usb.portClosed')}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {serialBackend === 'native' && (
            <button
              type="button"
              onClick={() => void handleRefreshNativePorts()}
              disabled={isDetecting}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl text-xs transition-colors border border-slate-700"
              title={t('usb.ports')}
            >
              <RefreshCw className="ui-icon-sm" aria-hidden="true" />
              <span>{t('usb.ports')}</span>
            </button>
          )}
          <button
            onClick={() => void handleDetectViaSerial()}
            disabled={isDetecting}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-sm"
          >
            <Usb className={`ui-icon-sm ${isDetecting ? 'animate-bounce' : ''}`} aria-hidden="true" />
            <span>{isDetecting ? t('usb.scanning') : t('usb.detect')}</span>
          </button>
        </div>
      </div>

      {detectError && (
        <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-xl text-xs text-amber-300 flex items-start gap-3">
          <AlertCircle className="ui-icon-sm text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="leading-relaxed">
            <strong>{t('usb.info')}:</strong> {detectError}
          </div>
        </div>
      )}

      {showPortPicker && availablePorts.length > 0 && (
        <div className="p-4 bg-slate-900 border border-cyan-500/30 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              {t('usb.pickPort')}
            </h3>
            <span className="ui-type-micro text-slate-500 font-mono">{availablePorts.length} {t('usb.available')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availablePorts.map(port => (
              <button
                key={port.id}
                type="button"
                disabled={isDetecting}
                onClick={() => void handlePickNativePort(port.id)}
                className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded-xl text-left transition-all"
              >
                <div className="text-xs font-semibold text-slate-100 font-mono">{port.label}</div>
                <div className="ui-type-micro text-slate-500 mt-1 font-mono">
                  {port.usbVendorId != null
                    ? `VID 0x${port.usbVendorId.toString(16).toUpperCase().padStart(4, '0')}`
                    : 'VID ?'}
                  {' / '}
                  {port.usbProductId != null
                    ? `PID 0x${port.usbProductId.toString(16).toUpperCase().padStart(4, '0')}`
                    : 'PID ?'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {(showDriverHelp || noPortsFound) && (
        <div className="p-5 bg-slate-900 border border-amber-500/30 rounded-2xl flex flex-col gap-4 relative">
          <button
            type="button"
            onClick={handleDismissDriverHelp}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={t('usb.driversDismiss')}
           aria-label={t('usb.driversDismiss')}>
            <X className="ui-icon-sm" aria-hidden="true" />
          </button>
          <div className="flex items-start gap-3 pr-8">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
              <BookOpen className="ui-icon-sm" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-slate-100">
                {t('usb.driversTitle')}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {noPortsFound ? t('usb.driversHintEmpty') : t('usb.driversHint')}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {WINDOWS_USB_DRIVER_HINTS.map(driver => (
              <a
                key={driver.id}
                href={driver.installUrl}
                target="_blank"
                rel="noreferrer"
                className="p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/40 rounded-xl transition-colors group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-100 group-hover:text-amber-200">
                    {driver.name}
                  </span>
                  <ExternalLink className="ui-icon-sm text-slate-500 group-hover:text-amber-400 shrink-0" aria-hidden="true" />
                </div>
                <div className="ui-type-micro font-mono text-cyan-400/90 mt-1">VID {driver.vidHex}</div>
                <div className="ui-type-micro text-slate-500 mt-1 leading-relaxed">
                  {driver.typicalBoards}. {driver.notes}
                </div>
              </a>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 ui-type-micro">
            <a
              href={WINDOWS_DRIVERS_DOC_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-medium"
            >
              <BookOpen className="ui-icon-sm" aria-hidden="true" />
              {t('usb.drivers')}
            </a>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500 font-mono">
              {t('usb.driversAfter')}
            </span>
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
                    <Cpu className="ui-icon-md" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{detectedChip.chipModel}</h3>
                    <span className="ui-type-micro font-mono text-cyan-400 font-semibold">{detectedChip.chipFamily}</span>
                  </div>
                </div>

                <span className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-800 text-emerald-400 rounded-full ui-type-micro font-mono font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {t('usb.recognized')}
                </span>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-1">
                  <span className="ui-type-micro uppercase font-mono text-slate-400">{t('usb.spec.arch')}</span>
                  <span className="font-semibold text-slate-200">{detectedChip.architecture}</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-1">
                  <span className="ui-type-micro uppercase font-mono text-slate-400">{t('usb.spec.cores')}</span>
                  <span className="font-semibold text-slate-200 font-mono">{t('usb.spec.coresValue').replace('{cores}', String(detectedChip.coreCount)).replace('{mhz}', String(detectedChip.maxCpuClockMhz))}</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-1">
                  <span className="ui-type-micro uppercase font-mono text-slate-400">{t('usb.spec.memory')}</span>
                  <span className="font-semibold text-cyan-300 font-mono">{detectedChip.flashSizeMb} MB Flash {detectedChip.psramSizeMb > 0 ? `+ ${detectedChip.psramSizeMb} MB PSRAM` : ''}</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-1">
                  <span className="ui-type-micro uppercase font-mono text-slate-400">{t('usb.spec.mac')}</span>
                  <span className="font-mono text-slate-300 ui-type-micro">{detectedChip.macAddress} ({detectedChip.usbVendorId}:{detectedChip.usbProductId})</span>
                </div>
              </div>

              {/* Supported Features Tags */}
              <div className="flex flex-col gap-2">
                <span className="ui-type-micro font-mono text-slate-400 uppercase">{t('usb.spec.features')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {detectedChip.features.map(f => (
                    <span key={f} className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-300 rounded ui-type-micro">
                      {f.startsWith('usb.board.') ? t(f) : f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Apply Configuration Button */}
              <button
                onClick={handleApplyToProject}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-sm mt-1"
              >
                {appliedPresetId ? <Check className="ui-icon-sm" aria-hidden="true" /> : <ArrowRight className="ui-icon-sm" aria-hidden="true" />}
                <span>{appliedPresetId ? t('usb.applied') : t('usb.apply')}</span>
              </button>
            </div>
          ) : (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-600">
                <Usb className="w-8 h-8" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">{t('usb.noDevice')}</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                {t('usb.noDeviceHint')}
              </p>
            </div>
          )}

          <FlashHelperPanel detectedChip={detectedChip} buildSources={buildSources} preferredMdnsName={system.mdnsName} />

          {/* Popular Boards Catalog */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                {t('usb.catalogTitle')}
              </h3>
              <span className="ui-type-micro text-slate-500">{t('usb.catalogHint')}</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {POPULAR_ESP32_BOARDS.map(board => (
                <button
                  key={board.id}
                  onClick={() => handleSelectPreset(board)}
                  className="p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl text-left transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-slate-900 border border-slate-700 text-cyan-400 rounded font-mono ui-type-micro font-bold">
                      {board.family}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                        {t(boardNameKey(board.id))}
                      </div>
                      <div className="ui-type-micro text-slate-400">
                        {t('usb.catalogMeta')
                          .replace('{cores}', String(board.cores))
                          .replace('{mhz}', String(board.clockMhz))
                          .replace('{flash}', String(board.flashMb))}
                        <strong className="text-rose-400">{board.touchController.toUpperCase()}</strong>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="ui-icon-sm text-slate-600 group-hover:text-cyan-400 transition-colors" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live Serial Monitor Console (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-4 p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Terminal className="ui-icon-sm text-emerald-400" aria-hidden="true" />
              {t('usb.monitorTitle')}
            </h3>
            <button
              onClick={() => setSerialLogs([])}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
              title={t('usb.monitorClear')}
            >
              <Trash2 className="ui-icon-sm" aria-hidden="true" />
            </button>
          </div>

          {/* Terminal Screen Output */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 min-h-[420px] max-h-[500px] overflow-y-auto flex flex-col gap-1.5 leading-relaxed selection:bg-emerald-500/30">
            {serialLogs.map(log => (
              <div key={log.id} className="flex items-start gap-2">
                <span className="ui-type-micro text-slate-600 select-none">{log.timestamp}</span>
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
              placeholder={t('usb.monitorPlaceholder')}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none ui-focus-ring focus:border-cyan-500"
            />
            <button
              type="submit"
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-sm"
            >
              <Send className="ui-icon-sm" aria-hidden="true" />
              <span>{t('usb.monitorSend')}</span>
            </button>
          </form>

          <div className="flex items-center justify-between ui-type-micro font-mono text-slate-500 pt-1">
            <span>{t('usb.monitorQuick')}</span>
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
