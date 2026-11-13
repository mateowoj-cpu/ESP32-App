import React, { useState } from 'react';
import { 
  DisplayConfig, 
  SystemConfig, 
  PinFunction, 
  GpioMode 
} from '../types';
import { 
  Cpu, 
  Zap, 
  Check, 
  AlertTriangle, 
  Sliders, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Info, 
  X,
  Volume2,
  Sun,
  Eye,
  Radio,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';

interface Esp32PinoutMapProps {
  display: DisplayConfig;
  setDisplay: React.Dispatch<React.SetStateAction<DisplayConfig>>;
  system: SystemConfig;
  setSystem: React.Dispatch<React.SetStateAction<SystemConfig>>;
  onPinAssigned?: (pin: number, func: PinFunction) => void;
}

export interface PhysicalPinInfo {
  pin: number;
  label: string;
  side: 'left' | 'right';
  pinIndex: number; // 1 to 15
  isInputOnly?: boolean;
  isStrapping?: boolean;
  isAdc1?: boolean;
  isAdc2?: boolean;
  supportsPwm?: boolean;
  supportsTouch?: boolean;
  supportsI2c?: boolean;
  supportsSpi?: boolean;
  defaultRole: string;
}

// 30-pin NodeMCU ESP32-WROOM-32 physical layout
export const ESP32_PHYSICAL_PINS: PhysicalPinInfo[] = [
  // Left Header (J1) - Top to Bottom
  { pin: 36, label: 'VP (GPIO36)', side: 'left', pinIndex: 3, isInputOnly: true, isAdc1: true, supportsPwm: false, defaultRole: 'pinout.role.36' },
  { pin: 39, label: 'VN (GPIO39)', side: 'left', pinIndex: 4, isInputOnly: true, isAdc1: true, supportsPwm: false, defaultRole: 'pinout.role.39' },
  { pin: 34, label: 'GPIO34', side: 'left', pinIndex: 5, isInputOnly: true, isAdc1: true, supportsPwm: false, defaultRole: 'pinout.role.34' },
  { pin: 35, label: 'GPIO35', side: 'left', pinIndex: 6, isInputOnly: true, isAdc1: true, supportsPwm: false, defaultRole: 'pinout.role.35' },
  { pin: 32, label: 'GPIO32', side: 'left', pinIndex: 7, isAdc1: true, supportsTouch: true, supportsPwm: true, supportsI2c: true, defaultRole: 'pinout.role.32' },
  { pin: 33, label: 'GPIO33', side: 'left', pinIndex: 8, isAdc1: true, supportsTouch: true, supportsPwm: true, supportsI2c: true, defaultRole: 'pinout.role.33' },
  { pin: 25, label: 'GPIO25', side: 'left', pinIndex: 9, isAdc2: true, supportsPwm: true, defaultRole: 'pinout.role.25' },
  { pin: 26, label: 'GPIO26', side: 'left', pinIndex: 10, isAdc2: true, supportsPwm: true, defaultRole: 'pinout.role.26' },
  { pin: 27, label: 'GPIO27', side: 'left', pinIndex: 11, isAdc2: true, supportsTouch: true, supportsPwm: true, defaultRole: 'pinout.role.27' },
  { pin: 14, label: 'GPIO14', side: 'left', pinIndex: 12, isAdc2: true, supportsTouch: true, supportsPwm: true, supportsSpi: true, defaultRole: 'pinout.role.14' },
  { pin: 12, label: 'GPIO12', side: 'left', pinIndex: 13, isStrapping: true, isAdc2: true, supportsTouch: true, supportsPwm: true, supportsSpi: true, defaultRole: 'pinout.role.12' },
  { pin: 13, label: 'GPIO13', side: 'left', pinIndex: 14, isAdc2: true, supportsTouch: true, supportsPwm: true, supportsSpi: true, defaultRole: 'pinout.role.13' },

  // Right Header (J2) - Top to Bottom
  { pin: 23, label: 'GPIO23', side: 'right', pinIndex: 5, supportsPwm: true, supportsSpi: true, defaultRole: 'pinout.role.23' },
  { pin: 22, label: 'GPIO22', side: 'right', pinIndex: 6, supportsPwm: true, supportsI2c: true, defaultRole: 'pinout.role.22' },
  { pin: 1,  label: 'TX0 (GPIO1)', side: 'right', pinIndex: 7, defaultRole: 'pinout.role.1' },
  { pin: 3,  label: 'RX0 (GPIO3)', side: 'right', pinIndex: 8, defaultRole: 'pinout.role.3' },
  { pin: 21, label: 'GPIO21', side: 'right', pinIndex: 9, supportsPwm: true, supportsI2c: true, defaultRole: 'pinout.role.21' },
  { pin: 19, label: 'GPIO19', side: 'right', pinIndex: 10, supportsPwm: true, supportsSpi: true, defaultRole: 'pinout.role.19' },
  { pin: 18, label: 'GPIO18', side: 'right', pinIndex: 11, supportsPwm: true, supportsSpi: true, defaultRole: 'pinout.role.18' },
  { pin: 5,  label: 'GPIO5',  side: 'right', pinIndex: 12, isStrapping: true, supportsPwm: true, supportsSpi: true, defaultRole: 'pinout.role.5' },
  { pin: 17, label: 'GPIO17', side: 'right', pinIndex: 13, supportsPwm: true, defaultRole: 'pinout.role.17' },
  { pin: 16, label: 'GPIO16', side: 'right', pinIndex: 14, supportsPwm: true, defaultRole: 'pinout.role.16' },
  { pin: 4,  label: 'GPIO4',  side: 'right', pinIndex: 15, isAdc2: true, supportsTouch: true, supportsPwm: true, defaultRole: 'pinout.role.4' },
  { pin: 0,  label: 'GPIO0',  side: 'right', pinIndex: 16, isStrapping: true, isAdc2: true, supportsTouch: true, supportsPwm: true, defaultRole: 'pinout.role.0' },
  { pin: 2,  label: 'GPIO2',  side: 'right', pinIndex: 17, isStrapping: true, isAdc2: true, supportsTouch: true, supportsPwm: true, defaultRole: 'pinout.role.2' },
  { pin: 15, label: 'GPIO15', side: 'right', pinIndex: 18, isStrapping: true, isAdc2: true, supportsTouch: true, supportsPwm: true, supportsSpi: true, defaultRole: 'pinout.role.15' },
];

export const Esp32PinoutMap: React.FC<Esp32PinoutMapProps> = ({
  display,
  setDisplay,
  system,
  setSystem,
  onPinAssigned,
}) => {
  const { t } = useLocale();
  const [selectedPin, setSelectedPin] = useState<PhysicalPinInfo | null>(null);
  const [filterPeripheral, setFilterPeripheral] = useState<'all' | 'i2c' | 'spi' | 'pwm' | 'adc' | 'touch'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastAssignedMsg, setLastAssignedMsg] = useState<string | null>(null);

  // Determine current active function assigned to a pin
  const getPinCurrentFunction = (pin: number): { func: PinFunction; label: string; color: string; badge: string } => {
    // 1. Check Display Config assignments
    if (pin === display.sdaPin) return { func: 'I2C_SDA', label: t('pinout.fn.i2cSda'), color: 'border-cyan-500 bg-cyan-950/60 text-cyan-300', badge: 'I2C SDA' };
    if (pin === display.sclPin) return { func: 'I2C_SCL', label: t('pinout.fn.i2cScl'), color: 'border-cyan-500 bg-cyan-950/60 text-cyan-300', badge: 'I2C SCL' };
    if (pin === display.mosiPin && display.bus === 'spi') return { func: 'SPI_MOSI', label: t('pinout.fn.spiMosi'), color: 'border-indigo-500 bg-indigo-950/60 text-indigo-300', badge: 'SPI MOSI' };
    if (pin === display.sckPin && display.bus === 'spi') return { func: 'SPI_SCK', label: t('pinout.fn.spiSck'), color: 'border-indigo-500 bg-indigo-950/60 text-indigo-300', badge: 'SPI SCK' };
    if (pin === display.csPin && display.bus === 'spi') return { func: 'SPI_CS', label: t('pinout.fn.spiCs'), color: 'border-indigo-500 bg-indigo-950/60 text-indigo-300', badge: 'SPI CS' };
    if (pin === display.dcPin) return { func: 'OLED_DC', label: t('pinout.fn.oledDc'), color: 'border-purple-500 bg-purple-950/60 text-purple-300', badge: 'OLED DC' };
    if (pin === display.rstPin) return { func: 'OLED_RST', label: t('pinout.fn.oledRst'), color: 'border-purple-500 bg-purple-950/60 text-purple-300', badge: 'OLED RST' };
    if (pin === display.backlightPin) return { func: 'PWM_BACKLIGHT', label: t('pinout.fn.pwmBl'), color: 'border-amber-500 bg-amber-950/60 text-amber-300', badge: 'PWM BL' };

    // 2. Check Touch Config assignments
    if (display.touchEnabled) {
      if (pin === display.touchSdaPin) return { func: 'TOUCH_SDA', label: t('pinout.fn.touchSda'), color: 'border-rose-500 bg-rose-950/60 text-rose-300', badge: 'TOUCH SDA' };
      if (pin === display.touchSclPin) return { func: 'TOUCH_SCL', label: t('pinout.fn.touchScl'), color: 'border-rose-500 bg-rose-950/60 text-rose-300', badge: 'TOUCH SCL' };
      if (pin === display.touchIntPin) return { func: 'TOUCH_INT', label: t('pinout.fn.touchInt'), color: 'border-rose-500 bg-rose-950/60 text-rose-300', badge: 'TOUCH INT' };
      if (pin === display.touchRstPin) return { func: 'TOUCH_RST', label: t('pinout.fn.touchRst'), color: 'border-rose-500 bg-rose-950/60 text-rose-300', badge: 'TOUCH RST' };
    }

    // 3. Check System Config assignments
    if (pin === (system.pirPin ?? 14)) return { func: 'INPUT_PIR', label: t('pinout.fn.pir'), color: 'border-emerald-500 bg-emerald-950/60 text-emerald-300', badge: 'PIR MOTION' };
    if (pin === (system.ldrPin ?? 36)) return { func: 'ADC_LDR', label: t('pinout.fn.ldr'), color: 'border-yellow-500 bg-yellow-950/60 text-yellow-300', badge: 'ADC LDR' };
    if (pin === (system.potPin ?? 34)) return { func: 'ADC_POT', label: t('pinout.fn.pot'), color: 'border-yellow-500 bg-yellow-950/60 text-yellow-300', badge: 'ADC POT' };
    if (pin === (system.buzzerPin ?? 18)) return { func: 'PWM_BUZZER', label: t('pinout.fn.buzzer'), color: 'border-amber-500 bg-amber-950/60 text-amber-300', badge: 'PWM BUZZER' };
    if (pin === (system.ledPin ?? 2)) return { func: 'OUTPUT_LED', label: t('pinout.fn.led'), color: 'border-blue-500 bg-blue-950/60 text-blue-300', badge: 'LED STATUS' };
    if (pin === (system.userBtn1Pin ?? 35)) return { func: 'INPUT_BUTTON', label: t('pinout.fn.userBtn'), color: 'border-teal-500 bg-teal-950/60 text-teal-300', badge: 'USER BTN' };
    if (pin === 0) return { func: 'INPUT_BOOT', label: t('pinout.fn.boot'), color: 'border-slate-500 bg-slate-900 text-slate-300', badge: 'BOOT BTN' };

    // 4. Check customPinFunctions record
    if (system.customPinFunctions && system.customPinFunctions[pin]) {
      const custom = system.customPinFunctions[pin];
      return { func: custom, label: custom.replace('_', ' '), color: 'border-slate-600 bg-slate-900 text-slate-200', badge: custom };
    }

    return { func: 'GPIO_FREE', label: t('pinout.fn.free'), color: 'border-slate-800 bg-slate-950 text-slate-400', badge: t('pinout.badge.free') };
  };

  // Assign a new function to a pin
  const handleAssignFunction = (pin: number, func: PinFunction) => {
    // 1. Update Display Config if display-related
    if (func === 'I2C_SDA') setDisplay(prev => ({ ...prev, sdaPin: pin }));
    else if (func === 'I2C_SCL') setDisplay(prev => ({ ...prev, sclPin: pin }));
    else if (func === 'SPI_MOSI') setDisplay(prev => ({ ...prev, mosiPin: pin }));
    else if (func === 'SPI_SCK') setDisplay(prev => ({ ...prev, sckPin: pin }));
    else if (func === 'SPI_CS') setDisplay(prev => ({ ...prev, csPin: pin }));
    else if (func === 'OLED_DC') setDisplay(prev => ({ ...prev, dcPin: pin }));
    else if (func === 'OLED_RST') setDisplay(prev => ({ ...prev, rstPin: pin }));
    else if (func === 'PWM_BACKLIGHT') setDisplay(prev => ({ ...prev, backlightPin: pin }));
    else if (func === 'TOUCH_SDA') setDisplay(prev => ({ ...prev, touchSdaPin: pin }));
    else if (func === 'TOUCH_SCL') setDisplay(prev => ({ ...prev, touchSclPin: pin }));
    else if (func === 'TOUCH_INT') setDisplay(prev => ({ ...prev, touchIntPin: pin }));
    else if (func === 'TOUCH_RST') setDisplay(prev => ({ ...prev, touchRstPin: pin }));

    // 2. Update System Config
    setSystem(prev => {
      const nextCustom = { ...(prev.customPinFunctions || {}) };
      if (func === 'GPIO_FREE') {
        delete nextCustom[pin];
      } else {
        nextCustom[pin] = func;
      }

      return {
        ...prev,
        pirPin: func === 'INPUT_PIR' ? pin : prev.pirPin === pin ? 14 : prev.pirPin,
        ldrPin: func === 'ADC_LDR' ? pin : prev.ldrPin === pin ? 36 : prev.ldrPin,
        potPin: func === 'ADC_POT' ? pin : prev.potPin === pin ? 34 : prev.potPin,
        buzzerPin: func === 'PWM_BUZZER' ? pin : prev.buzzerPin === pin ? 18 : prev.buzzerPin,
        ledPin: func === 'OUTPUT_LED' ? pin : prev.ledPin === pin ? 2 : prev.ledPin,
        userBtn1Pin: func === 'INPUT_BUTTON' ? pin : prev.userBtn1Pin === pin ? 35 : prev.userBtn1Pin,
        customPinFunctions: nextCustom,
      };
    });

    const msg = t('pinout.assigned').replace('{pin}', String(pin)).replace('{func}', func);
    setLastAssignedMsg(msg);
    setTimeout(() => setLastAssignedMsg(null), 4000);

    if (onPinAssigned) {
      onPinAssigned(pin, func);
    }
  };

  // Filter pins
  const filteredPins = ESP32_PHYSICAL_PINS.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const current = getPinCurrentFunction(p.pin);
      const roleLabel = t(p.defaultRole).toLowerCase();
      if (
        !p.label.toLowerCase().includes(q) &&
        !roleLabel.includes(q) &&
        !p.defaultRole.toLowerCase().includes(q) &&
        !current.label.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (filterPeripheral === 'i2c') return p.supportsI2c;
    if (filterPeripheral === 'spi') return p.supportsSpi;
    if (filterPeripheral === 'pwm') return p.supportsPwm;
    if (filterPeripheral === 'adc') return p.isAdc1 || p.isAdc2;
    if (filterPeripheral === 'touch') return p.supportsTouch;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Top Filter & Information Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <Cpu className="ui-icon-md" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{t('pinout.title')}</span>
              <span className="px-2 py-0.5 rounded ui-type-micro font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Live Code Sync
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('pinout.subtitle')}
            </p>
          </div>
        </div>

        {/* Filter Pills and Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs">
            <Search className="ui-icon-sm text-slate-500 mr-2" aria-hidden="true" />
            <input
              type="text"
              placeholder={t('pinout.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none ui-focus-ring placeholder:text-slate-600 text-xs w-48 font-mono"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setFilterPeripheral('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterPeripheral === 'all' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('pinout.all')}
            </button>
            <button
              onClick={() => setFilterPeripheral('i2c')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterPeripheral === 'i2c' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              I2C
            </button>
            <button
              onClick={() => setFilterPeripheral('pwm')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterPeripheral === 'pwm' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              PWM
            </button>
            <button
              onClick={() => setFilterPeripheral('spi')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterPeripheral === 'spi' ? 'bg-indigo-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              SPI
            </button>
            <button
              onClick={() => setFilterPeripheral('adc')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterPeripheral === 'adc' ? 'bg-yellow-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ADC
            </button>
            <button
              onClick={() => setFilterPeripheral('touch')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterPeripheral === 'touch' ? 'bg-rose-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('pinout.touch')}
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Code Sync Notification Toast */}
      {lastAssignedMsg && (
        <div className="px-4 py-2.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs font-mono text-emerald-300 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="ui-icon-sm text-emerald-400 shrink-0" aria-hidden="true" />
            <span>{lastAssignedMsg}</span>
          </div>
          <span className="ui-type-micro text-emerald-400/80 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
            {t('pinout.cppReady')}
          </span>
        </div>
      )}

      {/* Main Interactive ESP32 Microcontroller Board Layout */}
      <div className="p-6 bg-slate-950 border border-slate-800 rounded-3xl relative overflow-hidden shadow-2xl">
        {/* Background circuit grid pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row items-center justify-between gap-8">
          
          {/* Left Pins Column (J1 Rail) */}
          <div className="w-full xl:w-72 flex flex-col gap-2">
            <div className="text-xs font-mono text-slate-400 font-semibold pb-1 border-b border-slate-800/80 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                {t('pinout.leftRail')}
              </span>
              <span className="ui-type-micro text-slate-500">{t('pinout.pinsRange').replace('{range}', '1-15')}</span>
            </div>

            <div className="flex flex-col gap-1.5">
              {filteredPins
                .filter(p => p.side === 'left')
                .map(p => renderPinRow(p, 'left'))}
            </div>
          </div>

          {/* Center Physical ESP32 Module Representation */}
          <div className="w-72 sm:w-80 h-[580px] bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-slate-700/80 rounded-3xl p-5 flex flex-col items-center justify-between shadow-[0_0_50px_rgba(0,0,0,0.8)] relative shrink-0">
            
            {/* Top: Wi-Fi / Bluetooth PCB Meandered Antenna */}
            <div className="w-full flex flex-col items-center">
              <div className="w-36 h-9 border-2 border-amber-600/70 bg-amber-950/20 rounded-md relative flex items-center justify-center overflow-hidden">
                <div className="w-full h-full bg-[repeating-linear-gradient(90deg,#d97706,#d97706_4px,transparent_4px,transparent_8px)] opacity-50" />
                <span className="absolute ui-type-micro font-mono text-amber-400/90 font-bold uppercase tracking-widest">
                  2.4GHz Antenna
                </span>
              </div>
            </div>

            {/* Middle: Tensilica ESP-WROOM-32 Metal Shield */}
            <div className="w-56 h-64 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-700 border-2 border-slate-600 rounded-xl p-4 flex flex-col items-center justify-between shadow-inner relative">
              <div className="flex items-center justify-between w-full ui-type-micro font-mono text-slate-400">
                <span>ESPRESSIF</span>
                <span>FCC ID: 2AC7Z</span>
              </div>

              <div className="flex flex-col items-center text-center my-auto">
                <div className="w-12 h-12 rounded-lg bg-slate-900/60 border border-slate-600 flex items-center justify-center text-cyan-400 mb-2">
                  <Cpu className="w-7 h-7" aria-hidden="true" />
                </div>
                <h4 className="text-sm font-bold text-slate-100 font-mono tracking-wider">
                  ESP-WROOM-32
                </h4>
                <p className="ui-type-micro text-slate-400 font-mono mt-0.5">
                  Dual-Core Xtensa LX6
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="px-1.5 py-0.5 rounded ui-type-micro font-mono bg-cyan-950 text-cyan-400 border border-cyan-800">
                    240 MHz
                  </span>
                  <span className="px-1.5 py-0.5 rounded ui-type-micro font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                    Wi-Fi + BLE
                  </span>
                </div>
              </div>

              <div className="w-full text-center ui-type-micro font-mono text-slate-500 uppercase tracking-widest border-t border-slate-600/50 pt-1">
                Tensilica 32-bit Architecture
              </div>
            </div>

            {/* Tactile Buttons and Power LEDs */}
            <div className="w-full flex items-center justify-between px-3">
              {/* Reset EN button */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-6 h-6 rounded bg-slate-800 border border-slate-600 flex items-center justify-center ui-type-micro font-mono text-slate-300 shadow active:scale-95 cursor-pointer">
                  EN
                </div>
                <span className="ui-type-micro font-mono text-slate-500">RESET</span>
              </div>

              {/* Status LEDs */}
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" title="Power 3.3V LED" />
                  <span className="ui-type-micro font-mono text-slate-500">PWR</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4] animate-pulse" title="GPIO 2 Built-in Status LED" />
                  <span className="ui-type-micro font-mono text-slate-500">IO2</span>
                </div>
              </div>

              {/* BOOT button */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-6 h-6 rounded bg-slate-800 border border-slate-600 flex items-center justify-center ui-type-micro font-mono text-slate-300 shadow active:scale-95 cursor-pointer">
                  IO0
                </div>
                <span className="ui-type-micro font-mono text-slate-500">BOOT</span>
              </div>
            </div>

            {/* Bottom: Micro-USB / USB-C Connector */}
            <div className="w-20 h-7 bg-slate-800 border-2 border-slate-600 rounded-t-lg flex items-center justify-center ui-type-micro font-mono text-slate-400 shadow-inner">
              <span>USB UART</span>
            </div>
          </div>

          {/* Right Pins Column (J2 Rail) */}
          <div className="w-full xl:w-72 flex flex-col gap-2">
            <div className="text-xs font-mono text-slate-400 font-semibold pb-1 border-b border-slate-800/80 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                {t('pinout.rightRail')}
              </span>
              <span className="ui-type-micro text-slate-500">{t('pinout.pinsRange').replace('{range}', '16-30')}</span>
            </div>

            <div className="flex flex-col gap-1.5">
              {filteredPins
                .filter(p => p.side === 'right')
                .map(p => renderPinRow(p, 'right'))}
            </div>
          </div>
        </div>
      </div>

      {/* Pin Function Assignment Flyout / Modal */}
      {selectedPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-5 relative">
            <button
              onClick={() => setSelectedPin(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="ui-icon-sm" aria-hidden="true" />
            </button>

            {/* Modal Header */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Sliders className="ui-icon-lg" aria-hidden="true" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white">
                    {t('pinout.modal.title').replace('{label}', selectedPin.label)}
                  </h3>
                  {selectedPin.isInputOnly && (
                    <span className="px-2 py-0.5 rounded ui-type-micro font-mono bg-rose-950 text-rose-300 border border-rose-800">
                      {t('pinout.modal.inputOnly')}
                    </span>
                  )}
                  {selectedPin.isStrapping && (
                    <span className="px-2 py-0.5 rounded ui-type-micro font-mono bg-amber-950 text-amber-300 border border-amber-800">
                      {t('pinout.modal.strapping')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {t('pinout.modal.hint')}
                </p>
              </div>
            </div>

            {/* Hardware Limitations Notice for Input-Only pins */}
            {selectedPin.isInputOnly && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-start gap-2.5 text-xs text-rose-300 leading-relaxed">
                <AlertTriangle className="ui-icon-sm shrink-0 text-rose-400 mt-0.5" aria-hidden="true" />
                <span>{t('pinout.modal.hwLimit')}</span>
              </div>
            )}

            {/* Function Selectors Grid */}
            <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
              
              {/* Category: I2C (Display & Sensors) */}
              <div className="flex flex-col gap-1.5">
                <span className="ui-type-micro font-mono uppercase text-cyan-400 font-semibold tracking-wider">
                  {t('pinout.cat.i2c')}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={selectedPin.isInputOnly}
                    onClick={() => {
                      handleAssignFunction(selectedPin.pin, 'I2C_SDA');
                      setSelectedPin(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors flex items-center justify-between ${
                      getPinCurrentFunction(selectedPin.pin).func === 'I2C_SDA'
                        ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                        : selectedPin.isInputOnly
                        ? 'bg-slate-950 border-slate-800 opacity-40 cursor-not-allowed text-slate-500'
                        : 'bg-slate-950 border-slate-800 hover:border-cyan-500/60 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{t('pinout.opt.i2cSda')}</div>
                      <div className="ui-type-micro text-slate-400">{t('pinout.opt.i2cSdaHint')}</div>
                    </div>
                    {getPinCurrentFunction(selectedPin.pin).func === 'I2C_SDA' && <Check className="ui-icon-sm text-cyan-400" aria-hidden="true" />}
                  </button>

                  <button
                    disabled={selectedPin.isInputOnly}
                    onClick={() => {
                      handleAssignFunction(selectedPin.pin, 'I2C_SCL');
                      setSelectedPin(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors flex items-center justify-between ${
                      getPinCurrentFunction(selectedPin.pin).func === 'I2C_SCL'
                        ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                        : selectedPin.isInputOnly
                        ? 'bg-slate-950 border-slate-800 opacity-40 cursor-not-allowed text-slate-500'
                        : 'bg-slate-950 border-slate-800 hover:border-cyan-500/60 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{t('pinout.opt.i2cScl')}</div>
                      <div className="ui-type-micro text-slate-400">{t('pinout.opt.i2cSclHint')}</div>
                    </div>
                    {getPinCurrentFunction(selectedPin.pin).func === 'I2C_SCL' && <Check className="ui-icon-sm text-cyan-400" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {/* Category: PWM (Buzzer, Backlight, Servo) */}
              <div className="flex flex-col gap-1.5">
                <span className="ui-type-micro font-mono uppercase text-amber-400 font-semibold tracking-wider">
                  {t('pinout.cat.pwm')}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={selectedPin.isInputOnly}
                    onClick={() => {
                      handleAssignFunction(selectedPin.pin, 'PWM_BUZZER');
                      setSelectedPin(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors flex items-center justify-between ${
                      getPinCurrentFunction(selectedPin.pin).func === 'PWM_BUZZER'
                        ? 'bg-amber-950 border-amber-400 text-amber-300'
                        : selectedPin.isInputOnly
                        ? 'bg-slate-950 border-slate-800 opacity-40 cursor-not-allowed text-slate-500'
                        : 'bg-slate-950 border-slate-800 hover:border-amber-500/60 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{t('pinout.opt.buzzer')}</div>
                      <div className="ui-type-micro text-slate-400">{t('pinout.opt.buzzerHint')}</div>
                    </div>
                    {getPinCurrentFunction(selectedPin.pin).func === 'PWM_BUZZER' && <Check className="ui-icon-sm text-amber-400" aria-hidden="true" />}
                  </button>

                  <button
                    disabled={selectedPin.isInputOnly}
                    onClick={() => {
                      handleAssignFunction(selectedPin.pin, 'PWM_BACKLIGHT');
                      setSelectedPin(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors flex items-center justify-between ${
                      getPinCurrentFunction(selectedPin.pin).func === 'PWM_BACKLIGHT'
                        ? 'bg-amber-950 border-amber-400 text-amber-300'
                        : selectedPin.isInputOnly
                        ? 'bg-slate-950 border-slate-800 opacity-40 cursor-not-allowed text-slate-500'
                        : 'bg-slate-950 border-slate-800 hover:border-amber-500/60 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{t('pinout.opt.backlight')}</div>
                      <div className="ui-type-micro text-slate-400">{t('pinout.opt.backlightHint')}</div>
                    </div>
                    {getPinCurrentFunction(selectedPin.pin).func === 'PWM_BACKLIGHT' && <Check className="ui-icon-sm text-amber-400" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {/* Category: Sensors & ADC Inputs */}
              <div className="flex flex-col gap-1.5">
                <span className="ui-type-micro font-mono uppercase text-emerald-400 font-semibold tracking-wider">
                  {t('pinout.cat.sensors')}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      handleAssignFunction(selectedPin.pin, 'INPUT_PIR');
                      setSelectedPin(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors flex items-center justify-between ${
                      getPinCurrentFunction(selectedPin.pin).func === 'INPUT_PIR'
                        ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 hover:border-emerald-500/60 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{t('pinout.opt.pir')}</div>
                      <div className="ui-type-micro text-slate-400">{t('pinout.opt.pirHint')}</div>
                    </div>
                    {getPinCurrentFunction(selectedPin.pin).func === 'INPUT_PIR' && <Check className="ui-icon-sm text-emerald-400" aria-hidden="true" />}
                  </button>

                  <button
                    onClick={() => {
                      handleAssignFunction(selectedPin.pin, 'ADC_LDR');
                      setSelectedPin(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors flex items-center justify-between ${
                      getPinCurrentFunction(selectedPin.pin).func === 'ADC_LDR'
                        ? 'bg-yellow-950 border-yellow-400 text-yellow-300'
                        : 'bg-slate-950 border-slate-800 hover:border-yellow-500/60 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{t('pinout.opt.ldr')}</div>
                      <div className="ui-type-micro text-slate-400">{t('pinout.opt.ldrHint')}</div>
                    </div>
                    {getPinCurrentFunction(selectedPin.pin).func === 'ADC_LDR' && <Check className="ui-icon-sm text-yellow-400" aria-hidden="true" />}
                  </button>

                  <button
                    onClick={() => {
                      handleAssignFunction(selectedPin.pin, 'ADC_POT');
                      setSelectedPin(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors flex items-center justify-between ${
                      getPinCurrentFunction(selectedPin.pin).func === 'ADC_POT'
                        ? 'bg-yellow-950 border-yellow-400 text-yellow-300'
                        : 'bg-slate-950 border-slate-800 hover:border-yellow-500/60 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{t('pinout.opt.pot')}</div>
                      <div className="ui-type-micro text-slate-400">{t('pinout.opt.potHint')}</div>
                    </div>
                    {getPinCurrentFunction(selectedPin.pin).func === 'ADC_POT' && <Check className="ui-icon-sm text-yellow-400" aria-hidden="true" />}
                  </button>

                  <button
                    onClick={() => {
                      handleAssignFunction(selectedPin.pin, 'INPUT_BUTTON');
                      setSelectedPin(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors flex items-center justify-between ${
                      getPinCurrentFunction(selectedPin.pin).func === 'INPUT_BUTTON'
                        ? 'bg-teal-950 border-teal-400 text-teal-300'
                        : 'bg-slate-950 border-slate-800 hover:border-teal-500/60 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{t('pinout.opt.userBtn')}</div>
                      <div className="ui-type-micro text-slate-400">{t('pinout.opt.userBtnHint')}</div>
                    </div>
                    {getPinCurrentFunction(selectedPin.pin).func === 'INPUT_BUTTON' && <Check className="ui-icon-sm text-teal-400" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {/* Category: Touchscreen Pins */}
              <div className="flex flex-col gap-1.5">
                <span className="ui-type-micro font-mono uppercase text-rose-400 font-semibold tracking-wider">
                  {t('pinout.cat.touch')}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      handleAssignFunction(selectedPin.pin, 'TOUCH_INT');
                      setSelectedPin(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors flex items-center justify-between ${
                      getPinCurrentFunction(selectedPin.pin).func === 'TOUCH_INT'
                        ? 'bg-rose-950 border-rose-400 text-rose-300'
                        : 'bg-slate-950 border-slate-800 hover:border-rose-500/60 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{t('pinout.opt.touchInt')}</div>
                      <div className="ui-type-micro text-slate-400">{t('pinout.opt.touchIntHint')}</div>
                    </div>
                    {getPinCurrentFunction(selectedPin.pin).func === 'TOUCH_INT' && <Check className="ui-icon-sm text-rose-400" aria-hidden="true" />}
                  </button>

                  <button
                    disabled={selectedPin.isInputOnly}
                    onClick={() => {
                      handleAssignFunction(selectedPin.pin, 'TOUCH_RST');
                      setSelectedPin(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors flex items-center justify-between ${
                      getPinCurrentFunction(selectedPin.pin).func === 'TOUCH_RST'
                        ? 'bg-rose-950 border-rose-400 text-rose-300'
                        : selectedPin.isInputOnly
                        ? 'bg-slate-950 border-slate-800 opacity-40 cursor-not-allowed text-slate-500'
                        : 'bg-slate-950 border-slate-800 hover:border-rose-500/60 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{t('pinout.opt.touchRst')}</div>
                      <div className="ui-type-micro text-slate-400">{t('pinout.opt.touchRstHint')}</div>
                    </div>
                    {getPinCurrentFunction(selectedPin.pin).func === 'TOUCH_RST' && <Check className="ui-icon-sm text-rose-400" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {/* Category: SPI (LCD ST7789 / ILI9341) */}
              <div className="flex flex-col gap-1.5">
                <span className="ui-type-micro font-mono uppercase text-indigo-400 font-semibold tracking-wider">
                  {t('pinout.cat.spi')}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={selectedPin.isInputOnly}
                    onClick={() => {
                      handleAssignFunction(selectedPin.pin, 'SPI_MOSI');
                      setSelectedPin(null);
                    }}
                    className={`p-2 rounded-lg border text-left text-xs ${
                      getPinCurrentFunction(selectedPin.pin).func === 'SPI_MOSI'
                        ? 'bg-indigo-950 border-indigo-400 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-indigo-500/60'
                    }`}
                  >
                    {t('pinout.opt.spiMosi')}
                  </button>
                  <button
                    disabled={selectedPin.isInputOnly}
                    onClick={() => {
                      handleAssignFunction(selectedPin.pin, 'SPI_SCK');
                      setSelectedPin(null);
                    }}
                    className={`p-2 rounded-lg border text-left text-xs ${
                      getPinCurrentFunction(selectedPin.pin).func === 'SPI_SCK'
                        ? 'bg-indigo-950 border-indigo-400 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-indigo-500/60'
                    }`}
                  >
                    {t('pinout.opt.spiSck')}
                  </button>
                  <button
                    disabled={selectedPin.isInputOnly}
                    onClick={() => {
                      handleAssignFunction(selectedPin.pin, 'SPI_CS');
                      setSelectedPin(null);
                    }}
                    className={`p-2 rounded-lg border text-left text-xs ${
                      getPinCurrentFunction(selectedPin.pin).func === 'SPI_CS'
                        ? 'bg-indigo-950 border-indigo-400 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-indigo-500/60'
                    }`}
                  >
                    {t('pinout.opt.spiCs')}
                  </button>
                  <button
                    disabled={selectedPin.isInputOnly}
                    onClick={() => {
                      handleAssignFunction(selectedPin.pin, 'OLED_DC');
                      setSelectedPin(null);
                    }}
                    className={`p-2 rounded-lg border text-left text-xs ${
                      getPinCurrentFunction(selectedPin.pin).func === 'OLED_DC'
                        ? 'bg-indigo-950 border-indigo-400 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-indigo-500/60'
                    }`}
                  >
                    {t('pinout.opt.lcdDc')}
                  </button>
                </div>
              </div>

              {/* Reset to Free */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => {
                    handleAssignFunction(selectedPin.pin, 'GPIO_FREE');
                    setSelectedPin(null);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition-colors"
                >
                  {t('pinout.opt.free')}
                </button>
                <button
                  onClick={() => setSelectedPin(null)}
                  className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
                >
                  {t('pinout.opt.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Helper row renderer for pins in physical columns
  function renderPinRow(p: PhysicalPinInfo, side: 'left' | 'right') {
    const current = getPinCurrentFunction(p.pin);
    const isSelected = selectedPin?.pin === p.pin;

    return (
      <button
        key={p.pin}
        onClick={() => setSelectedPin(p)}
        className={`w-full p-2 rounded-xl border text-left transition-all flex items-center justify-between gap-2.5 group cursor-pointer ${
          isSelected
            ? 'bg-cyan-950/60 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400'
            : current.func !== 'GPIO_FREE'
            ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
            : 'bg-slate-950/70 border-slate-900 hover:border-slate-800'
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {/* Gold PCB Through-hole Solder Pad */}
          <div className="w-5 h-5 rounded-full border-2 border-amber-500/80 bg-slate-950 flex items-center justify-center shrink-0 shadow-sm group-hover:border-amber-400">
            <div className="w-2 h-2 rounded-full bg-slate-900 border border-slate-700" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-xs text-slate-200 truncate">
                {p.label}
              </span>
              {p.isInputOnly && (
                <span className="ui-type-micro font-mono px-1 rounded bg-rose-950/70 text-rose-400 border border-rose-900/50">
                  IN
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400 truncate mt-0.5">
              {current.label}
            </span>
          </div>
        </div>

        {/* Assigned Function Badge */}
        <div className="shrink-0 flex items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium border ${current.color}`}>
            {current.badge}
          </span>
          <ArrowRight className="ui-icon-sm text-slate-500 group-hover:text-cyan-400 transition-colors" aria-hidden="true" />
        </div>
      </button>
    );
  }
};
