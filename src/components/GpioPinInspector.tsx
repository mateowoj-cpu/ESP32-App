import React, { useState } from 'react';
import { 
  DisplayConfig, 
  HardwareSimState, 
  AutomationRule, 
  GpioMode, 
  GpioLevel 
} from '../types';
import { 
  Activity, 
  Zap, 
  RotateCcw, 
  Sliders, 
  Radio, 
  CheckCircle2, 
  ArrowUpDown, 
  Filter, 
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Info
} from 'lucide-react';

interface GpioPinInspectorProps {
  display: DisplayConfig;
  simState: HardwareSimState;
  setSimState: React.Dispatch<React.SetStateAction<HardwareSimState>>;
  automations: AutomationRule[];
  onTriggerAction: (ruleName: string, mood?: any, screenIndex?: number) => void;
}

interface PinDefinition {
  pin: number;
  name: string;
  defaultRole: string;
  mode: GpioMode;
  side: 'left' | 'right';
  isInputOnly?: boolean;
}

// Complete ESP32-WROOM-32D 30-pin Header Mapping
const ESP32_PIN_LAYOUT: PinDefinition[] = [
  // Left Header
  { pin: 36, name: 'VP / GPIO36', defaultRole: 'Sensor Światła LDR (ADC1_0)', mode: 'ADC', side: 'left', isInputOnly: true },
  { pin: 39, name: 'VN / GPIO39', defaultRole: 'Sensor VN (ADC1_3)', mode: 'ADC', side: 'left', isInputOnly: true },
  { pin: 34, name: 'GPIO34', defaultRole: 'Potencjometr Analogowy (ADC1_6)', mode: 'ADC', side: 'left', isInputOnly: true },
  { pin: 35, name: 'GPIO35', defaultRole: 'Przycisk USER 1 (Input Pullup)', mode: 'INPUT_PULLUP', side: 'left', isInputOnly: true },
  { pin: 32, name: 'GPIO32', defaultRole: 'Touch SCL / RTC GPIO9', mode: 'I2C_SPI', side: 'left' },
  { pin: 33, name: 'GPIO33', defaultRole: 'Touch SDA / RTC GPIO8', mode: 'I2C_SPI', side: 'left' },
  { pin: 25, name: 'GPIO25', defaultRole: 'Sygnalizator / DAC1', mode: 'OUTPUT', side: 'left' },
  { pin: 26, name: 'GPIO26', defaultRole: 'Impulsator Enkoder A / DAC2', mode: 'INPUT', side: 'left' },
  { pin: 27, name: 'GPIO27', defaultRole: 'Touch INT / Impulsator B', mode: 'INPUT_PULLUP', side: 'left' },
  { pin: 14, name: 'GPIO14', defaultRole: 'Czujnik Ruchu PIR', mode: 'INPUT', side: 'left' },
  { pin: 12, name: 'GPIO12', defaultRole: 'Wolny GPIO / Touch 5', mode: 'INPUT', side: 'left' },
  { pin: 13, name: 'GPIO13', defaultRole: 'Wolny GPIO / Touch 4', mode: 'INPUT', side: 'left' },
  
  // Right Header
  { pin: 23, name: 'GPIO23', defaultRole: 'SPI MOSI / Ekran LCD', mode: 'I2C_SPI', side: 'right' },
  { pin: 22, name: 'GPIO22', defaultRole: 'I2C SCL (Ekran OLED)', mode: 'I2C_SPI', side: 'right' },
  { pin: 1,  name: 'TX0 / GPIO1', defaultRole: 'Serial Debug TX', mode: 'SYSTEM', side: 'right' },
  { pin: 3,  name: 'RX0 / GPIO3', defaultRole: 'Serial Debug RX', mode: 'SYSTEM', side: 'right' },
  { pin: 21, name: 'GPIO21', defaultRole: 'I2C SDA (Ekran OLED)', mode: 'I2C_SPI', side: 'right' },
  { pin: 19, name: 'GPIO19', defaultRole: 'SPI MISO / Wolny GPIO', mode: 'INPUT', side: 'right' },
  { pin: 18, name: 'GPIO18', defaultRole: 'SPI SCK / Wolny GPIO', mode: 'I2C_SPI', side: 'right' },
  { pin: 5,  name: 'GPIO5',  defaultRole: 'SPI CS / Wolny GPIO', mode: 'OUTPUT', side: 'right' },
  { pin: 17, name: 'GPIO17', defaultRole: 'OLED RST / UART2 TX', mode: 'OUTPUT', side: 'right' },
  { pin: 16, name: 'GPIO16', defaultRole: 'OLED DC / UART2 RX', mode: 'OUTPUT', side: 'right' },
  { pin: 4,  name: 'GPIO4',  defaultRole: 'Sensor Temp DHT22', mode: 'INPUT', side: 'right' },
  { pin: 0,  name: 'GPIO0',  defaultRole: 'Przycisk BOOT (Wbudowany)', mode: 'INPUT_PULLUP', side: 'right' },
  { pin: 2,  name: 'GPIO2',  defaultRole: 'Wbudowana Dioda LED (Status)', mode: 'OUTPUT', side: 'right' },
  { pin: 15, name: 'GPIO15', defaultRole: 'Wolny GPIO / Touch 3', mode: 'INPUT', side: 'right' },
];

export const GpioPinInspector: React.FC<GpioPinInspectorProps> = ({
  display,
  simState,
  setSimState,
  automations,
  onTriggerAction,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'inputs' | 'outputs' | 'adc'>('all');
  const [pinOverrides, setPinOverrides] = useState<Record<number, GpioLevel>>({});
  const [lastActionLog, setLastActionLog] = useState<string | null>(null);

  // Compute live logic level for a pin
  const getPinLiveLevel = (pin: number): GpioLevel => {
    // Check manual override first
    if (pinOverrides[pin] !== undefined) {
      return pinOverrides[pin];
    }

    // Dynamic bindings based on simulator state
    if (pin === 0) return simState.bootPressed ? 'LOW' : 'HIGH';
    if (pin === 14) return simState.pirActive ? 'HIGH' : 'LOW';
    if (pin === 35) return simState.userBtn1Pressed ? 'LOW' : 'HIGH';
    if (pin === 27) return simState.touchActive ? 'LOW' : 'HIGH'; // Touch IRQ active LOW
    if (pin === 2) return simState.isDisplayAwake ? 'HIGH' : 'LOW'; // Power/Status LED
    if (pin === 36) return simState.ambientLux > 200 ? 'HIGH' : 'LOW'; // LDR threshold
    if (pin === 34) return simState.potAdc > 2048 ? 'HIGH' : 'LOW'; // POT threshold
    if (pin === display.sdaPin || pin === display.sclPin) return 'HIGH'; // I2C pulled high

    return 'LOW';
  };

  // Compute voltage for a pin
  const getPinVoltage = (pin: number): number => {
    if (pin === 36) return (simState.ambientLux / 1000) * 3.3;
    if (pin === 34) return (simState.potAdc / 4095) * 3.3;
    return getPinLiveLevel(pin) === 'HIGH' ? 3.3 : 0.0;
  };

  // Get active role text
  const getPinActiveRole = (p: PinDefinition): string => {
    if (p.pin === display.sdaPin) return `I2C SDA (Wyświetlacz ${display.i2cAddress})`;
    if (p.pin === display.sclPin) return 'I2C SCL (Wyświetlacz OLED)';
    if (display.touchEnabled && p.pin === display.touchSdaPin) return `Touch SDA (${display.touchController.toUpperCase()})`;
    if (display.touchEnabled && p.pin === display.touchSclPin) return `Touch SCL (${display.touchController.toUpperCase()})`;
    if (display.touchEnabled && p.pin === display.touchIntPin) return 'Touch INT (Przerwanie dotyku)';
    if (p.pin === display.rstPin) return 'OLED RST (Reset)';
    if (p.pin === display.dcPin) return 'OLED DC (Data/Command)';
    return p.defaultRole;
  };

  // Determine if pin is used in current project
  const isPinActiveInProject = (pin: number): boolean => {
    return (
      pin === 0 || // BOOT
      pin === 14 || // PIR
      pin === 35 || // User Btn
      pin === 36 || // LDR
      pin === 34 || // POT
      pin === 4 || // DHT22
      pin === 2 || // Builtin LED
      pin === display.sdaPin ||
      pin === display.sclPin ||
      (display.touchEnabled && (pin === display.touchSdaPin || pin === display.touchSclPin || pin === display.touchIntPin || pin === display.touchRstPin)) ||
      automations.some(r => r.trigger.gpioPin === pin)
    );
  };

  // Manual Level Toggle
  const handleTogglePinLevel = (pin: number) => {
    const current = getPinLiveLevel(pin);
    const next: GpioLevel = current === 'HIGH' ? 'LOW' : 'HIGH';

    setPinOverrides(prev => ({
      ...prev,
      [pin]: next,
    }));

    // Trigger simulator logic based on pin
    handleGpioSideEffects(pin, next);
  };

  // Momentary Pulse (e.g. 150ms button click or sensor trip)
  const handlePulsePin = (pin: number) => {
    const original = getPinLiveLevel(pin);
    const inverted: GpioLevel = original === 'HIGH' ? 'LOW' : 'HIGH';

    // Set inverted state
    setPinOverrides(prev => ({ ...prev, [pin]: inverted }));
    handleGpioSideEffects(pin, inverted);

    // Revert after 180ms
    setTimeout(() => {
      setPinOverrides(prev => {
        const copy = { ...prev };
        delete copy[pin];
        return copy;
      });
      handleGpioSideEffects(pin, original);
    }, 180);
  };

  // Handle side-effects on simulated hardware when a pin changes
  const handleGpioSideEffects = (pin: number, level: GpioLevel) => {
    setLastActionLog(`Wysłano sygnał ${level} na pin GPIO ${pin}`);

    // If PIR sensor pin (GPIO 14)
    if (pin === 14) {
      const isMotion = level === 'HIGH';
      setSimState(prev => ({
        ...prev,
        pirActive: isMotion,
        isDisplayAwake: true,
        activePetMood: isMotion ? 'surprised' : 'neutral',
        lastTriggerFired: isMotion ? 'GPIO 14 [HIGH] -> Czujnik PIR wykrył obecność!' : 'GPIO 14 [LOW] -> Koniec ruchu PIR',
      }));
      if (isMotion) onTriggerAction('PIR Ruch GPIO 14', 'surprised');
    }

    // If BOOT button pin (GPIO 0, active LOW)
    if (pin === 0) {
      if (level === 'LOW') {
        setSimState(prev => {
          const nextScreen = (prev.currentScreenIndex + 1);
          return {
            ...prev,
            bootPressed: true,
            currentScreenIndex: nextScreen,
            isDisplayAwake: true,
            lastTriggerFired: 'GPIO 0 [LOW] -> Wciśnięto przycisk BOOT (Zmiana ekranu)',
          };
        });
      } else {
        setSimState(prev => ({ ...prev, bootPressed: false }));
      }
    }

    // If User Button 1 (GPIO 35, active LOW)
    if (pin === 35) {
      setSimState(prev => ({
        ...prev,
        userBtn1Pressed: level === 'LOW',
        lastTriggerFired: `GPIO 35 [${level}] -> Przycisk USER 1`,
      }));
    }

    // If Touch Interrupt (GPIO 27, active LOW)
    if (pin === 27) {
      const isTouch = level === 'LOW';
      setSimState(prev => ({
        ...prev,
        touchActive: isTouch,
        activePetMood: isTouch ? 'happy' : prev.activePetMood,
        lastTriggerFired: `GPIO 27 [${level}] -> Przerwanie kontrolera dotykowego (Touch INT)`,
      }));
    }

    // Check custom automation rules targeting this GPIO pin
    const matchingRule = automations.find(r => r.enabled && r.trigger.gpioPin === pin);
    if (matchingRule) {
      onTriggerAction(matchingRule.name, matchingRule.action.petMood);
    }
  };

  // Reset all manual overrides
  const handleResetAllOverrides = () => {
    setPinOverrides({});
    setLastActionLog('Zresetowano wszystkie wymuszone sygnały pinów GPIO');
  };

  // Filter pins based on selection
  const filteredPins = ESP32_PIN_LAYOUT.filter(p => {
    if (filterMode === 'active') return isPinActiveInProject(p.pin);
    if (filterMode === 'inputs') return p.mode === 'INPUT' || p.mode === 'INPUT_PULLUP';
    if (filterMode === 'outputs') return p.mode === 'OUTPUT';
    if (filterMode === 'adc') return p.mode === 'ADC';
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header Strip with Filters & Quick Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Panel Monitorowania & Zadawania Sygnałów GPIO ESP32
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Klikaj przyciski [HIGH/LOW] lub [IMPULS], aby ręcznie wymuszać sygnały logiczne na wirtualnych pinach procesora.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Filter Pills */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterMode === 'all' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Wszystkie ({ESP32_PIN_LAYOUT.length})
            </button>
            <button
              onClick={() => setFilterMode('active')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterMode === 'active' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Aktywne w projekcie
            </button>
            <button
              onClick={() => setFilterMode('inputs')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterMode === 'inputs' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Wejścia (Input)
            </button>
            <button
              onClick={() => setFilterMode('outputs')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterMode === 'outputs' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Wyjścia
            </button>
          </div>

          <button
            onClick={handleResetAllOverrides}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-colors border border-slate-700 font-medium"
            title="Resetuj wszystkie wymuszone stany pinów"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Stanów</span>
          </button>
        </div>
      </div>

      {lastActionLog && (
        <div className="px-3.5 py-2 bg-cyan-950/40 border border-cyan-800/60 rounded-lg text-xs font-mono text-cyan-300 flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{lastActionLog}</span>
        </div>
      )}

      {/* Main Visual Pin Grid (2 Columns: Left Header / Right Header) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left ESP32 Header Rails */}
        <div className="flex flex-col gap-2.5 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
            <span className="font-mono text-slate-300 font-semibold uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              Lewa Szyna Pinów ESP32 (Header J1)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">ADC1 / RTC / Touch / PIR</span>
          </div>

          <div className="flex flex-col gap-2">
            {filteredPins
              .filter(p => p.side === 'left')
              .map(pin => renderPinCard(pin))}
          </div>
        </div>

        {/* Right ESP32 Header Rails */}
        <div className="flex flex-col gap-2.5 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
            <span className="font-mono text-slate-300 font-semibold uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Prawa Szyna Pinów ESP32 (Header J2)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">I2C / SPI / BOOT / UART</span>
          </div>

          <div className="flex flex-col gap-2">
            {filteredPins
              .filter(p => p.side === 'right')
              .map(pin => renderPinCard(pin))}
          </div>
        </div>
      </div>

      {/* Legend & Help Banner */}
      <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
            <strong className="text-slate-200">HIGH (3.3V)</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-600" />
            <strong className="text-slate-400">LOW (0.0V)</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <strong className="text-amber-300">ADC / Sygnał Analogowy</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            <strong className="text-rose-300">Ekran Dotykowy</strong>
          </span>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          *Piny GPIO 34, 35, 36, 39 są wyłącznie pinami wejściowymi (Input-Only) w procesorach ESP32.
        </div>
      </div>
    </div>
  );

  // Helper renderer for individual pin cards
  function renderPinCard(p: PinDefinition) {
    const level = getPinLiveLevel(p.pin);
    const voltage = getPinVoltage(p.pin);
    const isOverridden = pinOverrides[p.pin] !== undefined;
    const isHigh = level === 'HIGH';
    const isProjectActive = isPinActiveInProject(p.pin);
    const role = getPinActiveRole(p);

    return (
      <div
        key={p.pin}
        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
          isOverridden
            ? 'bg-cyan-950/30 border-cyan-500/60 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
            : isProjectActive
            ? 'bg-slate-950 border-slate-800 hover:border-slate-700'
            : 'bg-slate-950/40 border-slate-900/60 opacity-80'
        }`}
      >
        {/* Left: Pin Badge & Live Logic Level LED */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-3.5 h-3.5 rounded-full transition-all flex items-center justify-center ${
                isHigh
                  ? 'bg-cyan-400 shadow-[0_0_10px_#06b6d4]'
                  : 'bg-slate-800 border border-slate-700'
              }`}
              title={isHigh ? 'Stan WYSOKI: 3.3V' : 'Stan NISKI: 0.0V'}
            />
            <span className="w-16 font-mono font-bold text-xs text-slate-200">
              GPIO {p.pin}
            </span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${isProjectActive ? 'text-cyan-300' : 'text-slate-300'}`}>
                {role}
              </span>
              {isOverridden && (
                <span className="text-[10px] bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono px-1.5 py-0.5 rounded font-medium">
                  FORCED
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-0.5">
              <span className="text-slate-500">{p.mode}</span>
              <span className="text-slate-600">·</span>
              <span className={isHigh ? 'text-cyan-400 font-bold' : 'text-slate-400'}>
                {level} ({voltage.toFixed(2)}V)
              </span>
            </div>
          </div>
        </div>

        {/* Right: Manual Signal Transmission Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Toggle Level Button */}
          <button
            onClick={() => handleTogglePinLevel(p.pin)}
            className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-all ${
              isHigh
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700/60'
            }`}
            title="Przełącz stan logiczny HIGH / LOW"
          >
            {isHigh ? 'HIGH (1)' : 'LOW (0)'}
          </button>

          {/* Momentary Pulse Button */}
          <button
            onClick={() => handlePulsePin(p.pin)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 border border-slate-700 rounded transition-colors active:scale-95"
            title="Wyślij chwilowy impuls zmiany stanu (180ms)"
          >
            <Zap className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }
};
