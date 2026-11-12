import React from 'react';
import { DisplayConfig, SystemConfig, DisplayModel, BusType, DisplayTheme, Screen } from '../types';
import { 
  Monitor, 
  Wifi, 
  Moon, 
  Cpu, 
  Sliders, 
  Palette, 
  Sparkles, 
  Clock, 
  ShieldCheck,
  Usb,
  Bluetooth,
  HardDrive,
  Activity,
  Radio,
  Lock,
  Signal,
  CheckCircle2,
  Sun,
  Globe,
  Check
} from 'lucide-react';

interface SettingsViewProps {
  display: DisplayConfig;
  setDisplay: React.Dispatch<React.SetStateAction<DisplayConfig>>;
  system: SystemConfig;
  setSystem: React.Dispatch<React.SetStateAction<SystemConfig>>;
  screens?: Screen[];
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  display,
  setDisplay,
  system,
  setSystem,
  screens = [],
}) => {
  // Handle model change and update resolution automatically
  const handleModelChange = (model: DisplayModel) => {
    let width = 128;
    let height = 64;

    switch (model) {
      case 'ssd1306_128x64':
      case 'sh1106_128x64':
        width = 128;
        height = 64;
        break;
      case 'ssd1306_128x32':
        width = 128;
        height = 32;
        break;
      case 'st7789_240x240':
      case 'gc9a01_240x240_round':
        width = 240;
        height = 240;
        break;
      case 'st7789_135x240':
        width = 135;
        height = 240;
        break;
      case 'ili9341_320x240':
        width = 320;
        height = 240;
        break;
    }

    setDisplay(prev => ({
      ...prev,
      model,
      width,
      height,
    }));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Konfiguracja Wyświetlacza & Motywów */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-cyan-400" />
              Parametry Ekranu i Motywy Wizualne
            </h3>
            <span className="text-[10px] font-mono text-cyan-400">
              {display.width}x{display.height} px
            </span>
          </div>

          {/* Model Display */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Model Wyświetlacza:</label>
            <select
              value={display.model}
              onChange={e => handleModelChange(e.target.value as DisplayModel)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
            >
              <option value="ssd1306_128x64">SSD1306 OLED (128x64) - Najpopularniejszy</option>
              <option value="ssd1306_128x32">SSD1306 OLED (128x32) - Wąski pasek</option>
              <option value="sh1106_128x64">SH1106 OLED (128x64)</option>
              <option value="st7789_240x240">ST7789 IPS LCD (240x240) - Kolorowy kwadrat</option>
              <option value="st7789_135x240">ST7789 TTGO T-Display (135x240)</option>
              <option value="ili9341_320x240">ILI9341 TFT LCD (320x240) - Duży ekran</option>
              <option value="gc9a01_240x240_round">GC9A01 Okrągły Smartwatch (240x240)</option>
            </select>
          </div>

          {/* Bus Type (I2C vs SPI) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Magistrala:</label>
              <select
                value={display.bus}
                onChange={e => setDisplay(prev => ({ ...prev, bus: e.target.value as BusType }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              >
                <option value="i2c">I2C (2 piny: SDA + SCL)</option>
                <option value="spi">SPI (Szybki 4-Wire)</option>
              </select>
            </div>

            {display.bus === 'i2c' ? (
              <div>
                <label className="text-xs text-slate-400 block mb-1">Adres I2C:</label>
                <select
                  value={display.i2cAddress}
                  onChange={e => setDisplay(prev => ({ ...prev, i2cAddress: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                >
                  <option value="0x3C">0x3C (Domyślny)</option>
                  <option value="0x3D">0x3D (Alternatywny)</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs text-slate-400 block mb-1">Pin CS:</label>
                <input
                  type="number"
                  value={display.csPin}
                  onChange={e => setDisplay(prev => ({ ...prev, csPin: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono"
                />
              </div>
            )}
          </div>

          {/* GPIO Pins Configuration */}
          {display.bus === 'i2c' ? (
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div>
                <label className="text-[11px] text-slate-400 font-mono">Pin SDA (Dane):</label>
                <input
                  type="number"
                  value={display.sdaPin}
                  onChange={e => setDisplay(prev => ({ ...prev, sdaPin: Number(e.target.value) }))}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300 font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-mono">Pin SCL (Zegar):</label>
                <input
                  type="number"
                  value={display.sclPin}
                  onChange={e => setDisplay(prev => ({ ...prev, sclPin: Number(e.target.value) }))}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300 font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div>
                <label className="text-[10px] text-slate-400 font-mono">MOSI:</label>
                <input
                  type="number"
                  value={display.mosiPin}
                  onChange={e => setDisplay(prev => ({ ...prev, mosiPin: Number(e.target.value) }))}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono">SCK:</label>
                <input
                  type="number"
                  value={display.sckPin}
                  onChange={e => setDisplay(prev => ({ ...prev, sckPin: Number(e.target.value) }))}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono">DC:</label>
                <input
                  type="number"
                  value={display.dcPin}
                  onChange={e => setDisplay(prev => ({ ...prev, dcPin: Number(e.target.value) }))}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300 font-mono"
                />
              </div>
            </div>
          )}

          {/* Visual Palette / Theme Selection */}
          <div>
            <label className="text-xs text-slate-300 block mb-2 flex items-center gap-2 font-medium">
              <Palette className="w-4 h-4 text-cyan-400" />
              Motyw Kolorystyczny Wyświetlacza:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'oled_neon_blue', name: 'OLED Neon Blue', hex: '#00f0ff', desc: 'Błękit neonowy' },
                { id: 'oled_pure_white', name: 'OLED Pure White', hex: '#ffffff', desc: 'Czysta biel' },
                { id: 'crt_amber', name: 'Retro Amber CRT', hex: '#ffb000', desc: 'Ciepły bursztyn' },
                { id: 'terminal_green', name: 'Matrix Terminal', hex: '#00ff66', desc: 'Zielony hakerski' },
                { id: 'cyberpunk_cyan_pink', name: 'Cyberpunk Neon', hex: '#ff007f', desc: 'Cyjan & Róż' },
                { id: 'epaper_bw', name: 'E-Paper Minimalist', hex: '#0f172a', desc: 'Matowy e-ink' },
              ].map(theme => (
                <button
                  key={theme.id}
                  onClick={() => setDisplay(prev => ({ ...prev, theme: theme.id as DisplayTheme }))}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                    display.theme === theme.id
                      ? 'border-cyan-400 bg-cyan-950/30 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                      : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-slate-700 shrink-0"
                    style={{ backgroundColor: theme.hex }}
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{theme.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{theme.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Brightness & Pixel Raster */}
          <div className="flex flex-col gap-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-400" />
                Jasność ekranu / Kontrast PWM:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={display.brightness}
                  onChange={e => setDisplay(prev => ({ ...prev, brightness: Math.max(5, Math.min(100, Number(e.target.value))) }))}
                  className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-cyan-400 font-mono text-center font-bold"
                />
                <span className="font-mono text-slate-400 text-xs">%</span>
              </div>
            </div>

            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={display.brightness}
              onChange={e => setDisplay(prev => ({ ...prev, brightness: Number(e.target.value) }))}
              className="w-full accent-cyan-400 cursor-pointer"
            />

            {/* Szybkie presety jasności */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: '10% Noc', val: 10 },
                { label: '25% Ciemno', val: 25 },
                { label: '50% Średnia', val: 50 },
                { label: '75% Jasno', val: 75 },
                { label: '100% Maks', val: 100 },
              ].map(p => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setDisplay(prev => ({ ...prev, brightness: p.val }))}
                  className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                    display.brightness === p.val
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <span className="text-[11px] text-slate-400">Inteligentna auto-jasność (czujnik LDR):</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={system.autoBrightnessEnabled ?? false}
                  onChange={e => setSystem(prev => ({ ...prev, autoBrightnessEnabled: e.target.checked }))}
                  className="rounded accent-cyan-400"
                />
                <span className="font-mono text-slate-300">
                  {system.autoBrightnessEnabled ? 'WŁĄCZONA' : 'WYŁĄCZONA'}
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400">Efekt siatki pikseli (Matrix):</span>
              <input
                type="checkbox"
                checked={display.pixelGridEffect}
                onChange={e => setDisplay(prev => ({ ...prev, pixelGridEffect: e.target.checked }))}
                className="rounded accent-cyan-400"
              />
            </div>
          </div>

          {/* Touchscreen Configuration Section */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-xs font-semibold text-rose-400 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-rose-400" />
                Obsługa Ekranu Dotykowego (Touchscreen)
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={display.touchEnabled}
                  onChange={e => setDisplay(prev => ({ ...prev, touchEnabled: e.target.checked }))}
                  className="rounded accent-rose-500"
                />
                <span className="font-mono text-[11px] text-slate-300">Włączony</span>
              </label>
            </div>

            {display.touchEnabled && (
              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Kontroler Dotykowy:</label>
                  <select
                    value={display.touchController}
                    onChange={e => setDisplay(prev => ({ ...prev, touchController: e.target.value as any }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                  >
                    <option value="cst816s">CST816S / CST816T (Pojemnościowy I2C - T-Display S3 / Waveshare)</option>
                    <option value="ft6236">FT6236 / FT6336U (Pojemnościowy I2C - M5Stack Core2)</option>
                    <option value="xpt2046">XPT2046 (Oporowy SPI - ILI9341 2.8"/3.2")</option>
                    <option value="gt911">GT911 (Pojemnościowy 5-punktowy I2C)</option>
                    <option value="capacitive_gpio">Wbudowane sensory dotykowe ESP32 (Touch0-Touch9 GPIO)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div>
                    <label className="text-slate-400 text-[10px]">Pin Touch SDA/MOSI:</label>
                    <input
                      type="number"
                      value={display.touchSdaPin}
                      onChange={e => setDisplay(prev => ({ ...prev, touchSdaPin: Number(e.target.value) }))}
                      className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-rose-300"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px]">Pin Touch SCL/SCK:</label>
                    <input
                      type="number"
                      value={display.touchSclPin}
                      onChange={e => setDisplay(prev => ({ ...prev, touchSclPin: Number(e.target.value) }))}
                      className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-rose-300"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px]">Pin INT (Przerwanie):</label>
                    <input
                      type="number"
                      value={display.touchIntPin}
                      onChange={e => setDisplay(prev => ({ ...prev, touchIntPin: Number(e.target.value) }))}
                      className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-rose-300"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px]">Pin RST (Reset):</label>
                    <input
                      type="number"
                      value={display.touchRstPin}
                      onChange={e => setDisplay(prev => ({ ...prev, touchRstPin: Number(e.target.value) }))}
                      className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-rose-300"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1 text-[11px] text-slate-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={display.touchInvertX}
                      onChange={e => setDisplay(prev => ({ ...prev, touchInvertX: e.target.checked }))}
                      className="rounded accent-rose-500"
                    />
                    <span>Odwróć oś X</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={display.touchInvertY}
                      onChange={e => setDisplay(prev => ({ ...prev, touchInvertY: e.target.checked }))}
                      className="rounded accent-rose-500"
                    />
                    <span>Odwróć oś Y</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel 2: Ustawienia Systemowe ESP32 */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-400" />
              Sieć Wi-Fi i Parametry Systemowe ESP32
            </h3>
            <span className="text-[10px] font-mono text-emerald-400">
              {system.cpuFrequencyMhz} MHz
            </span>
          </div>

          {/* Wi-Fi Configuration */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Nazwa Sieci (SSID Wi-Fi):</label>
              <input
                type="text"
                value={system.wifiSsid}
                onChange={e => setSystem(prev => ({ ...prev, wifiSsid: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Hasło Wi-Fi:</label>
              <input
                type="password"
                value={system.wifiPassword}
                onChange={e => setSystem(prev => ({ ...prev, wifiPassword: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Nazwa mDNS w sieci lokalnej:</label>
              <input
                type="text"
                value={system.mdnsName}
                onChange={e => setSystem(prev => ({ ...prev, mdnsName: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                placeholder="esp32-display"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Dostępny w przeglądarce jako: http://{system.mdnsName}.local</span>
            </div>
          </div>

          {/* Power Saving & Deep Sleep */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <Moon className="w-4 h-4 text-indigo-400" />
              Zarządzanie Energią i Uśpienie (Deep Sleep)
            </h4>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Czas do uśpienia przy braku ruchu:</span>
                <span className="font-mono text-indigo-300 font-bold">
                  {system.deepSleepTimeoutSec === 0 ? 'Wyłączone (Zawsze włączony)' : `${system.deepSleepTimeoutSec} sekund`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="300"
                step="15"
                value={system.deepSleepTimeoutSec}
                onChange={e => setSystem(prev => ({ ...prev, deepSleepTimeoutSec: Number(e.target.value) }))}
                className="w-full accent-indigo-400 cursor-pointer"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  { label: 'Nigdy (0s)', val: 0 },
                  { label: '30 sek', val: 30 },
                  { label: '1 min', val: 60 },
                  { label: '2 min', val: 120 },
                  { label: '5 min', val: 300 },
                ].map(p => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => setSystem(prev => ({ ...prev, deepSleepTimeoutSec: p.val }))}
                    className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                      system.deepSleepTimeoutSec === p.val
                        ? 'bg-indigo-500 text-white font-bold'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-300">Wybudzanie przerwaniem na pinie PIR (GPIO 14):</span>
              <input
                type="checkbox"
                checked={system.wakeOnMotion}
                onChange={e => setSystem(prev => ({ ...prev, wakeOnMotion: e.target.checked }))}
                className="rounded accent-indigo-400"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Taktowanie procesora ESP32:</label>
              <select
                value={system.cpuFrequencyMhz}
                onChange={e => setSystem(prev => ({ ...prev, cpuFrequencyMhz: Number(e.target.value) as any }))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200"
              >
                <option value={240}>240 MHz - Maksymalna wydajność i FPS</option>
                <option value={160}>160 MHz - Zrównoważony</option>
                <option value={80}>80 MHz - Ultra energooszczędny</option>
              </select>
            </div>
          </div>

          {/* Time & NTP */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
              <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                Synchronizacja Zegara i Strefy Czasowej (NTP)
              </h4>

              <button
                type="button"
                onClick={() => {
                  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                  setSystem(prev => ({
                    ...prev,
                    ntpServer: 'pool.ntp.org',
                    timezone: tz.includes('Warsaw') || tz.includes('Berlin') || tz.includes('Paris') 
                      ? 'CET-1CEST,M3.5.0,M10.5.0/3' 
                      : 'GMT0BST,M3.5.0/1,M10.5.0'
                  }));
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-xs text-cyan-400 border border-cyan-800/50 rounded-lg transition-colors font-medium"
                title="Pobierz strefę i serwer NTP z ustawień przeglądarki"
              >
                <Globe className="w-4 h-4" />
                <span>Pobierz z przeglądarki</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Popularne strefy czasowe:</label>
                <select
                  value={
                    system.timezone.includes('CET-1CEST') ? 'warsaw' :
                    system.timezone.includes('GMT0BST') ? 'london' :
                    system.timezone.includes('EST5EDT') ? 'new_york' :
                    system.timezone.includes('PST8PDT') ? 'los_angeles' :
                    system.timezone.includes('JST-9') ? 'tokyo' : 'custom'
                  }
                  onChange={e => {
                    const k = e.target.value;
                    let tzStr = system.timezone;
                    if (k === 'warsaw') tzStr = 'CET-1CEST,M3.5.0,M10.5.0/3';
                    else if (k === 'london') tzStr = 'GMT0BST,M3.5.0/1,M10.5.0';
                    else if (k === 'new_york') tzStr = 'EST5EDT,M3.2.0,M11.1.0';
                    else if (k === 'los_angeles') tzStr = 'PST8PDT,M3.2.0,M11.1.0';
                    else if (k === 'tokyo') tzStr = 'JST-9';
                    else if (k === 'utc') tzStr = 'UTC0';
                    setSystem(prev => ({ ...prev, timezone: tzStr }));
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200"
                >
                  <option value="warsaw">Warszawa / Berlin (UTC+1/+2)</option>
                  <option value="london">Londyn / Dublin (UTC+0/+1)</option>
                  <option value="new_york">Nowy Jork / Wschód USA (UTC-5/-4)</option>
                  <option value="los_angeles">Los Angeles / Zachód USA (UTC-8/-7)</option>
                  <option value="tokyo">Tokio / Japonia (UTC+9)</option>
                  <option value="utc">Czas uniwersalny UTC</option>
                  <option value="custom">Własny ciąg POSIX TZ</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Ciąg POSIX strefy czasowej:</label>
                <input
                  type="text"
                  value={system.timezone}
                  onChange={e => setSystem(prev => ({ ...prev, timezone: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-[11px]"
                  placeholder="np. CET-1CEST,M3.5.0,M10.5.0/3"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Serwer NTP do synchronizacji:</label>
              <input
                type="text"
                value={system.ntpServer}
                onChange={e => setSystem(prev => ({ ...prev, ntpServer: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs"
              />
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {['pool.ntp.org', 'time.google.com', 'time.cloudflare.com', 'pl.pool.ntp.org'].map(srv => (
                  <button
                    key={srv}
                    type="button"
                    onClick={() => setSystem(prev => ({ ...prev, ntpServer: srv }))}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      system.ntpServer === srv
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {srv}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
              <span className="text-slate-400">Format zegara:</span>
              <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded border border-slate-800">
                <button
                  type="button"
                  onClick={() => setSystem(prev => ({ ...prev, clockFormat: '24h' }))}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                    (system.clockFormat || '24h') === '24h' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                  }`}
                >
                  24h (14:30)
                </button>
                <button
                  type="button"
                  onClick={() => setSystem(prev => ({ ...prev, clockFormat: '12h' }))}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                    system.clockFormat === '12h' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                  }`}
                >
                  12h (2:30 PM)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: USB-C Auto-Switching to PC Monitor & Bluetooth Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Panel 3: USB-C Auto-Switch to PC Resource Monitor */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Usb className="w-4 h-4 text-cyan-400" />
              Wykrywanie Kabla USB-C & Auto-Przełączanie Monitora PC
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
              {system.usbAutoSwitchToPcMonitor ? 'Aktywne' : 'Wyłączone'}
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {/* Master Toggle */}
            <label className="flex items-start gap-3 p-3.5 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={system.usbAutoSwitchToPcMonitor}
                onChange={e => setSystem(prev => ({ ...prev, usbAutoSwitchToPcMonitor: e.target.checked }))}
                className="mt-0.5 w-4 h-4 rounded accent-cyan-500 cursor-pointer"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-slate-200">
                  Automatycznie przełącz na Monitor Zasobów PC po podłączeniu kabla USB-C
                </span>
                <span className="text-[11px] text-slate-400 leading-relaxed">
                  Gdy kabel USB-C zostanie wpięty do komputera PC, ESP32 natychmiast przełączy ekran na podgląd zasobów sprzętowych (CPU, RAM, GPU, Dysk).
                </span>
              </div>
            </label>

            {/* Target Screen Selector */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Ekran docelowy po wykryciu połączenia USB:
              </label>
              <select
                value={system.usbSwitchScreenIndex ?? 2}
                onChange={e => setSystem(prev => ({ ...prev, usbSwitchScreenIndex: Number(e.target.value) }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
              >
                {screens.length > 0 ? (
                  screens.map((s, idx) => (
                    <option key={s.id || idx} value={idx}>
                      Ekran {idx + 1}: {s.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value={0}>Ekran 1: Cyber-Zwierzak</option>
                    <option value={1}>Ekran 2: Pulpit Główny & Pogoda</option>
                    <option value={2}>Ekran 3: Monitor Zasobów PC (CPU, RAM, GPU, Dysk)</option>
                  </>
                )}
              </select>
            </div>

            {/* Revert on Disconnect Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <div className="flex flex-col">
                <span className="text-slate-200 font-medium">
                  Powrót do poprzedniego ekranu po odłączeniu kabla USB:
                </span>
                <span className="text-[10px] text-slate-400">
                  Po wyjęciu wtyczki USB-C przywraca ekran, który był wyświetlany wcześniej.
                </span>
              </div>
              <input
                type="checkbox"
                checked={system.usbDisconnectRevertScreen}
                onChange={e => setSystem(prev => ({ ...prev, usbDisconnectRevertScreen: e.target.checked }))}
                className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Detection Method */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Metoda wykrywania podłączenia do komputera:
              </label>
              <select
                value={system.usbDetectMethod}
                onChange={e => setSystem(prev => ({ ...prev, usbDetectMethod: e.target.value as any }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              >
                <option value="serial_handshake">
                  Handshake z agentem PC / WebSerial (Rekomendowane dla wszystkich ESP32)
                </option>
                <option value="cdc_dtr">
                  Sygnał DTR/RTS portu CDC USB (ESP32-S3 / ESP32-C3 Native USB)
                </option>
                <option value="vbus_power">
                  Pomiar napięcia VBUS 5V linii USB (Hardware GPIO)
                </option>
              </select>
            </div>

            {/* Monitored Metrics Badges */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-2">
              <span className="text-xs font-mono text-slate-300 uppercase font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Monitorowane parametry komputera na ekranie:
              </span>
              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  CPU (Obciążenie procesora %)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  RAM (Pamięć operacyjna %)
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                  Karta Graficzna (GPU %)
                </span>
                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Zajęty Dysk (Disk C/D %)
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                  Temperatura CPU (°C)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 4: Bluetooth & BLE Configuration */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Bluetooth className="w-4 h-4 text-blue-400" />
              Łączność Bezprzewodowa Bluetooth & BLE (ESP32)
            </h3>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              system.bluetoothEnabled
                ? 'bg-blue-950 text-blue-400 border-blue-800'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}>
              {system.bluetoothEnabled ? system.bluetoothMode.toUpperCase() : 'Wyłączone'}
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {/* Bluetooth Master Toggle */}
            <label className="flex items-start gap-3 p-3.5 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={system.bluetoothEnabled}
                onChange={e => setSystem(prev => ({ ...prev, bluetoothEnabled: e.target.checked }))}
                className="mt-0.5 w-4 h-4 rounded accent-blue-500 cursor-pointer"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-slate-200">
                  Włącz moduł Bluetooth w oprogramowaniu ESP32
                </span>
                <span className="text-[11px] text-slate-400 leading-relaxed">
                  Umożliwia bezprzewodowe przesyłanie danych z komputera, odczyt telemetrii PC przez Bluetooth lub sterowanie aplikacją ze smartfona.
                </span>
              </div>
            </label>

            {/* Bluetooth Mode */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Tryb pracy Bluetooth:</label>
              <select
                disabled={!system.bluetoothEnabled}
                value={system.bluetoothMode}
                onChange={e => setSystem(prev => ({ ...prev, bluetoothMode: e.target.value as any }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 disabled:opacity-50"
              >
                <option value="ble">
                  BLE (Bluetooth Low Energy) - Energooszczędny profil GATT
                </option>
                <option value="classic_spp">
                  Bluetooth Classic SPP - Wirtualny bezprzewodowy port szeregowy COM
                </option>
                <option value="ble_keyboard">
                  BLE HID - Bezprzewodowa klawiatura / media controller dla komputera
                </option>
                <option value="disabled">
                  Wyłączony (Oszczędność pamięci RAM)
                </option>
              </select>
            </div>

            {/* Bluetooth Device Name */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Nazwa rozgłaszana urządzenia (Bluetooth Device Name):</label>
              <input
                type="text"
                disabled={!system.bluetoothEnabled}
                value={system.bluetoothDeviceName}
                onChange={e => setSystem(prev => ({ ...prev, bluetoothDeviceName: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono disabled:opacity-50"
                placeholder="ESP32-Display-Studio"
              />
            </div>

            {/* BLE Service Profile and TX Power */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Profil Usług BLE:</label>
                <select
                  disabled={!system.bluetoothEnabled}
                  value={system.bleServiceType}
                  onChange={e => setSystem(prev => ({ ...prev, bleServiceType: e.target.value as any }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 disabled:opacity-50"
                >
                  <option value="pc_telemetry">Telemetria PC (CPU/RAM/Dysk)</option>
                  <option value="serial_spp">Serial Nordic UART</option>
                  <option value="battery_env">Bateria & Sensory</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Moc nadawania (TX Power):</label>
                <select
                  disabled={!system.bluetoothEnabled}
                  value={system.bleTxPower}
                  onChange={e => setSystem(prev => ({ ...prev, bleTxPower: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 disabled:opacity-50 font-mono"
                >
                  <option value={9}>+9 dBm (Maksymalny zasięg)</option>
                  <option value={6}>+6 dBm</option>
                  <option value={3}>+3 dBm (Domyślny)</option>
                  <option value={0}>0 dBm (Standard)</option>
                  <option value={-6}>-6 dBm (Oszczędny)</option>
                </select>
              </div>
            </div>

            {/* PIN Code and Advertising */}
            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Kod PIN parowania (opcjonalny):</label>
                <input
                  type="text"
                  disabled={!system.bluetoothEnabled}
                  value={system.blePairingPin}
                  onChange={e => setSystem(prev => ({ ...prev, blePairingPin: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono disabled:opacity-50"
                  placeholder="123456"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs mt-4">
                <span className="text-slate-300 text-[11px]">Auto-rozgłaszanie:</span>
                <input
                  type="checkbox"
                  disabled={!system.bluetoothEnabled}
                  checked={system.bleAdvertising}
                  onChange={e => setSystem(prev => ({ ...prev, bleAdvertising: e.target.checked }))}
                  className="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer disabled:opacity-50"
                />
              </div>
            </div>

            {/* RAM Tip */}
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-[11px] text-slate-400 leading-relaxed">
              💡 <strong>Wskazówka RAM:</strong> Włączenie Bluetooth Classic SPP alokuje ok. 60 KB pamięci RAM. W trybie BLE zużycie spada do ~30 KB.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
