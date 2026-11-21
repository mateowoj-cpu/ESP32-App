import React from 'react';
import { DisplayConfig, SystemConfig, DisplayModel, BusType, DisplayTheme, Screen } from '../types';
import { DesktopSettingsPanel } from './DesktopSettingsPanel';
import { useLocale } from '../i18n/LocaleContext';
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
  const { t } = useLocale();
  // Handle model change and update resolution automatically
  const handleModelChange = (model: DisplayModel) => {
    let width = 128;
    let height = 64;
    // Popular DevKit pinouts from common ESP32 + OLED/TFT tutorials
    let busPatch: Partial<DisplayConfig> = {};

    switch (model) {
      case 'ssd1306_128x64':
      case 'sh1106_128x64':
        width = 128;
        height = 64;
        busPatch = { bus: 'i2c', sdaPin: 21, sclPin: 22, i2cAddress: '0x3C' };
        break;
      case 'ssd1306_128x32':
        width = 128;
        height = 32;
        busPatch = { bus: 'i2c', sdaPin: 21, sclPin: 22, i2cAddress: '0x3C' };
        break;
      case 'st7789_240x240':
      case 'gc9a01_240x240_round':
        width = 240;
        height = 240;
        // ST7789 / GC9A01: VSPI MOSI23 SCK18, CS5, DC2, RST4, BL32
        busPatch = {
          bus: 'spi',
          mosiPin: 23,
          misoPin: 19,
          sckPin: 18,
          csPin: 5,
          dcPin: 2,
          rstPin: 4,
          backlightPin: 32,
        };
        break;
      case 'st7789_135x240':
        width = 135;
        height = 240;
        busPatch = {
          bus: 'spi',
          mosiPin: 23,
          misoPin: 19,
          sckPin: 18,
          csPin: 5,
          dcPin: 2,
          rstPin: 4,
          backlightPin: 32,
        };
        break;
      case 'ili9341_320x240':
        width = 320;
        height = 240;
        // ILI9341 + XPT2046 common VSPI: CS15 DC2 RST4 BL21 TOUCH_CS5
        busPatch = {
          bus: 'spi',
          mosiPin: 23,
          misoPin: 19,
          sckPin: 18,
          csPin: 15,
          dcPin: 2,
          rstPin: 4,
          backlightPin: 21,
          touchEnabled: true,
          touchController: 'xpt2046',
          touchSdaPin: 23,
          touchSclPin: 18,
          touchIntPin: 27,
          touchRstPin: 5,
        };
        break;
    }

    setDisplay(prev => ({
      ...prev,
      model,
      width,
      height,
      ...busPatch,
    }));
  };

  return (
    <div className="flex flex-col gap-6">
      <DesktopSettingsPanel />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Konfiguracja Wyświetlacza & Motywów */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="ui-type-title text-slate-100 flex items-center gap-2">
              <Monitor className="ui-icon-sm text-cyan-400" aria-hidden="true" />
              {t('settings.display')}
            </h3>
            <span className="ui-type-micro font-mono text-cyan-400">
              {t('settings.displayResolution').replace('{w}', String(display.width)).replace('{h}', String(display.height))}
            </span>
          </div>

          {/* Model Display */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('settings.displayModelLabel')}</label>
            <select
              value={display.model}
              onChange={e => handleModelChange(e.target.value as DisplayModel)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
            >
              <option value="ssd1306_128x64">{t('settings.displayModel.ssd1306_128x64')}</option>
              <option value="ssd1306_128x32">{t('settings.displayModel.ssd1306_128x32')}</option>
              <option value="sh1106_128x64">{t('settings.displayModel.sh1106_128x64')}</option>
              <option value="st7789_240x240">{t('settings.displayModel.st7789_240x240')}</option>
              <option value="st7789_135x240">{t('settings.displayModel.st7789_135x240')}</option>
              <option value="ili9341_320x240">{t('settings.displayModel.ili9341_320x240')}</option>
              <option value="gc9a01_240x240_round">{t('settings.displayModel.gc9a01_240x240_round')}</option>
            </select>
          </div>

          {/* Bus Type (I2C vs SPI) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('settings.busLabel')}</label>
              <select
                value={display.bus}
                onChange={e => setDisplay(prev => ({ ...prev, bus: e.target.value as BusType }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              >
                <option value="i2c">{t('settings.bus.i2c')}</option>
                <option value="spi">{t('settings.bus.spi')}</option>
              </select>
            </div>

            {display.bus === 'i2c' ? (
              <div>
                <label className="text-xs text-slate-400 block mb-1">{t('settings.i2cAddressLabel')}</label>
                <select
                  value={display.i2cAddress}
                  onChange={e => setDisplay(prev => ({ ...prev, i2cAddress: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                >
                  <option value="0x3C">{t('settings.i2cAddr.0x3C')}</option>
                  <option value="0x3D">{t('settings.i2cAddr.0x3D')}</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs text-slate-400 block mb-1">{t('settings.csPinLabel')}</label>
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
                <label className="ui-type-micro text-slate-400 font-mono">{t('settings.pinSdaLabel')}</label>
                <input
                  type="number"
                  value={display.sdaPin}
                  onChange={e => setDisplay(prev => ({ ...prev, sdaPin: Number(e.target.value) }))}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300 font-mono"
                />
              </div>
              <div>
                <label className="ui-type-micro text-slate-400 font-mono">{t('settings.pinSclLabel')}</label>
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
                <label className="ui-type-micro text-slate-400 font-mono">{t('settings.pinMosiLabel')}</label>
                <input
                  type="number"
                  value={display.mosiPin}
                  onChange={e => setDisplay(prev => ({ ...prev, mosiPin: Number(e.target.value) }))}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300 font-mono"
                />
              </div>
              <div>
                <label className="ui-type-micro text-slate-400 font-mono">{t('settings.pinSckLabel')}</label>
                <input
                  type="number"
                  value={display.sckPin}
                  onChange={e => setDisplay(prev => ({ ...prev, sckPin: Number(e.target.value) }))}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300 font-mono"
                />
              </div>
              <div>
                <label className="ui-type-micro text-slate-400 font-mono">{t('settings.pinDcLabel')}</label>
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
              <Palette className="ui-icon-sm text-cyan-400" aria-hidden="true" />
              {t('settings.themeLabel')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'oled_neon_blue', hex: '#00f0ff' },
                { id: 'oled_pure_white', hex: '#ffffff' },
                { id: 'crt_amber', hex: '#ffb000' },
                { id: 'terminal_green', hex: '#00ff66' },
                { id: 'cyberpunk_cyan_pink', hex: '#ff007f' },
                { id: 'epaper_bw', hex: '#0f172a' },
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
                    <div className="text-xs font-semibold text-slate-200">{t(`settings.theme.${theme.id}.name`)}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{t(`settings.theme.${theme.id}.desc`)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Brightness & Pixel Raster */}
          <div className="flex flex-col gap-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium flex items-center gap-2">
                <Sun className="ui-icon-sm text-amber-400" aria-hidden="true" />
                {t('settings.brightnessLabel')}
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
              {(
                [
                  { key: 'night', val: 10 },
                  { key: 'dark', val: 25 },
                  { key: 'medium', val: 50 },
                  { key: 'bright', val: 75 },
                  { key: 'max', val: 100 },
                ] as const
              ).map(p => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setDisplay(prev => ({ ...prev, brightness: p.val }))}
                  className={`px-2 py-1 rounded ui-type-micro font-mono transition-colors ${
                    display.brightness === p.val
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                  }`}
                >
                  {t(`settings.brightnessPreset.${p.key}`)}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <span className="ui-type-micro text-slate-400">{t('settings.autoBrightnessLabel')}</span>
              <label className="flex items-center gap-1.5 cursor-pointer ui-type-micro">
                <input
                  type="checkbox"
                  checked={system.autoBrightnessEnabled ?? false}
                  onChange={e => setSystem(prev => ({ ...prev, autoBrightnessEnabled: e.target.checked }))}
                  className="rounded accent-cyan-400"
                />
                <span className="font-mono text-slate-300">
                  {system.autoBrightnessEnabled ? t('settings.toggleOn') : t('settings.toggleOff')}
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="ui-type-micro text-slate-400">{t('settings.pixelGridLabel')}</span>
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
                <Sliders className="ui-icon-sm text-rose-400" aria-hidden="true" />
                {t('settings.touch.sectionTitle')}
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={display.touchEnabled}
                  onChange={e => setDisplay(prev => ({ ...prev, touchEnabled: e.target.checked }))}
                  className="rounded accent-rose-500"
                />
                <span className="font-mono ui-type-micro text-slate-300">{t('settings.touch.enabled')}</span>
              </label>
            </div>

            {display.touchEnabled && (
              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="ui-type-micro text-slate-400 block mb-1">{t('settings.touch.controllerLabel')}</label>
                  <select
                    value={display.touchController}
                    onChange={e => setDisplay(prev => ({ ...prev, touchController: e.target.value as any }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                  >
                    <option value="cst816s">{t('settings.touch.controller.cst816s')}</option>
                    <option value="ft6236">{t('settings.touch.controller.ft6236')}</option>
                    <option value="xpt2046">{t('settings.touch.controller.xpt2046')}</option>
                    <option value="gt911">{t('settings.touch.controller.gt911')}</option>
                    <option value="capacitive_gpio">{t('settings.touch.controller.capacitive_gpio')}</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono ui-type-micro">
                  <div>
                    <label className="text-slate-400 ui-type-micro">{t('settings.touch.pinSdaMosi')}</label>
                    <input
                      type="number"
                      value={display.touchSdaPin}
                      onChange={e => setDisplay(prev => ({ ...prev, touchSdaPin: Number(e.target.value) }))}
                      className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-rose-300"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 ui-type-micro">{t('settings.touch.pinSclSck')}</label>
                    <input
                      type="number"
                      value={display.touchSclPin}
                      onChange={e => setDisplay(prev => ({ ...prev, touchSclPin: Number(e.target.value) }))}
                      className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-rose-300"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 ui-type-micro">{t('settings.touch.pinInt')}</label>
                    <input
                      type="number"
                      value={display.touchIntPin}
                      onChange={e => setDisplay(prev => ({ ...prev, touchIntPin: Number(e.target.value) }))}
                      className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-rose-300"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 ui-type-micro">{t('settings.touch.pinRst')}</label>
                    <input
                      type="number"
                      value={display.touchRstPin}
                      onChange={e => setDisplay(prev => ({ ...prev, touchRstPin: Number(e.target.value) }))}
                      className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-rose-300"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1 ui-type-micro text-slate-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={display.touchInvertX}
                      onChange={e => setDisplay(prev => ({ ...prev, touchInvertX: e.target.checked }))}
                      className="rounded accent-rose-500"
                    />
                    <span>{t('settings.touch.invertX')}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={display.touchInvertY}
                      onChange={e => setDisplay(prev => ({ ...prev, touchInvertY: e.target.checked }))}
                      className="rounded accent-rose-500"
                    />
                    <span>{t('settings.touch.invertY')}</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel 2: Ustawienia Systemowe ESP32 */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="ui-type-title text-slate-100 flex items-center gap-2">
              <Wifi className="ui-icon-sm text-emerald-400" aria-hidden="true" />
              {t('settings.wifiSection')}
            </h3>
            <span className="ui-type-micro font-mono text-emerald-400">
              {t('settings.cpuFreqBadge').replace('{mhz}', String(system.cpuFrequencyMhz))}
            </span>
          </div>

          {/* Wi-Fi Configuration */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('settings.wifiSsid')}</label>
              <input
                type="text"
                value={system.wifiSsid}
                onChange={e => setSystem(prev => ({ ...prev, wifiSsid: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('settings.wifiPassword')}</label>
              <input
                type="password"
                value={system.wifiPassword}
                onChange={e => setSystem(prev => ({ ...prev, wifiPassword: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('settings.mdnsName')}</label>
              <input
                type="text"
                value={system.mdnsName}
                onChange={e => setSystem(prev => ({ ...prev, mdnsName: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                placeholder="esp32-display"
              />
              <span className="ui-type-micro text-slate-400 mt-1 block">{t('settings.mdnsHint')} http://{system.mdnsName}.local</span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-3">
              <h4 className="text-xs font-semibold text-slate-200">{t('settings.ota')}</h4>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={system.otaEnabled !== false}
                  onChange={e => setSystem(prev => ({ ...prev, otaEnabled: e.target.checked }))}
                  className="accent-cyan-400"
                />
                {t('settings.otaEnable')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">{t('settings.otaPassword')}</label>
                  <input
                    type="password"
                    value={system.otaPassword ?? ''}
                    onChange={e => setSystem(prev => ({ ...prev, otaPassword: e.target.value }))}
                    disabled={system.otaEnabled === false}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">{t('settings.otaPort')}</label>
                  <input
                    type="number"
                    value={system.otaPort ?? 3232}
                    onChange={e =>
                      setSystem(prev => ({ ...prev, otaPort: Number(e.target.value) || 3232 }))
                    }
                    disabled={system.otaEnabled === false}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono disabled:opacity-40"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Power Saving & Deep Sleep */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <Moon className="ui-icon-sm text-indigo-400" aria-hidden="true" />
              {t('settings.power')}
            </h4>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">{t('settings.idleSleep')}</span>
                <span className="font-mono text-indigo-300 font-bold">
                  {system.deepSleepTimeoutSec === 0
                    ? t('settings.deepSleep.disabled')
                    : t('settings.deepSleep.seconds').replace('{n}', String(system.deepSleepTimeoutSec))}
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
                {(
                  [
                    { key: 'never', val: 0 },
                    { key: '30s', val: 30 },
                    { key: '1m', val: 60 },
                    { key: '2m', val: 120 },
                    { key: '5m', val: 300 },
                  ] as const
                ).map(p => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => setSystem(prev => ({ ...prev, deepSleepTimeoutSec: p.val }))}
                    className={`px-2 py-1 rounded ui-type-micro font-mono transition-colors ${
                      system.deepSleepTimeoutSec === p.val
                        ? 'bg-indigo-500 text-white font-bold'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {t(`settings.deepSleepPreset.${p.key}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-300">{t('settings.wakeOnMotionLabel')}</span>
              <input
                type="checkbox"
                checked={system.wakeOnMotion}
                onChange={e => setSystem(prev => ({ ...prev, wakeOnMotion: e.target.checked }))}
                className="rounded accent-indigo-400"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('settings.cpuFreqLabel')}</label>
              <select
                value={system.cpuFrequencyMhz}
                onChange={e => setSystem(prev => ({ ...prev, cpuFrequencyMhz: Number(e.target.value) as any }))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200"
              >
                <option value={240}>{t('settings.cpuFreq.240')}</option>
                <option value={160}>{t('settings.cpuFreq.160')}</option>
                <option value={80}>{t('settings.cpuFreq.80')}</option>
              </select>
            </div>
          </div>

          {/* Time & NTP */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
              <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <Clock className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                {t('settings.ntp.sectionTitle')}
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
                title={t('settings.ntp.fromBrowserTitle')}
              >
                <Globe className="ui-icon-sm" aria-hidden="true" />
                <span>{t('settings.ntp.fromBrowser')}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="ui-type-micro text-slate-400 block mb-1">{t('settings.ntp.popularZones')}</label>
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
                  <option value="warsaw">{t('settings.ntp.zone.warsaw')}</option>
                  <option value="london">{t('settings.ntp.zone.london')}</option>
                  <option value="new_york">{t('settings.ntp.zone.new_york')}</option>
                  <option value="los_angeles">{t('settings.ntp.zone.los_angeles')}</option>
                  <option value="tokyo">{t('settings.ntp.zone.tokyo')}</option>
                  <option value="utc">{t('settings.ntp.zone.utc')}</option>
                  <option value="custom">{t('settings.ntp.zone.custom')}</option>
                </select>
              </div>

              <div>
                <label className="ui-type-micro text-slate-400 block mb-1">{t('settings.ntp.posixLabel')}</label>
                <input
                  type="text"
                  value={system.timezone}
                  onChange={e => setSystem(prev => ({ ...prev, timezone: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono ui-type-micro"
                  placeholder={t('settings.ntp.posixPlaceholder')}
                />
              </div>
            </div>

            <div>
              <label className="ui-type-micro text-slate-400 block mb-1">{t('settings.ntp.serverLabel')}</label>
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
                    className={`px-2 py-0.5 rounded ui-type-micro font-mono transition-colors ${
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
              <span className="text-slate-400">{t('settings.ntp.clockFormat')}</span>
              <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded border border-slate-800">
                <button
                  type="button"
                  onClick={() => setSystem(prev => ({ ...prev, clockFormat: '24h' }))}
                  className={`px-2 py-0.5 rounded ui-type-micro font-mono font-medium ${
                    (system.clockFormat || '24h') === '24h' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                  }`}
                >
                  {t('settings.ntp.format24')}
                </button>
                <button
                  type="button"
                  onClick={() => setSystem(prev => ({ ...prev, clockFormat: '12h' }))}
                  className={`px-2 py-0.5 rounded ui-type-micro font-mono font-medium ${
                    system.clockFormat === '12h' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                  }`}
                >
                  {t('settings.ntp.format12')}
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
            <h3 className="ui-type-title text-slate-100 flex items-center gap-2">
              <Usb className="ui-icon-sm text-cyan-400" aria-hidden="true" />
              {t('settings.usb.sectionTitle')}
            </h3>
            <span className="ui-type-micro font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
              {system.usbAutoSwitchToPcMonitor ? t('settings.status.active') : t('settings.status.disabled')}
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
                  {t('settings.usb.autoSwitchTitle')}
                </span>
                <span className="ui-type-micro text-slate-400 leading-relaxed">
                  {t('settings.usb.autoSwitchDesc')}
                </span>
              </div>
            </label>

            {/* Target Screen Selector */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                {t('settings.usb.targetScreenLabel')}
              </label>
              <select
                value={system.usbSwitchScreenIndex ?? 2}
                onChange={e => setSystem(prev => ({ ...prev, usbSwitchScreenIndex: Number(e.target.value) }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
              >
                {screens.length > 0 ? (
                  screens.map((s, idx) => (
                    <option key={s.id || idx} value={idx}>
                      {t('settings.usb.screenOption')
                        .replace('{n}', String(idx + 1))
                        .replace('{name}', s.name)}
                    </option>
                  ))
                ) : (
                  <>
                    <option value={0}>{t('settings.usb.fallbackScreen.0')}</option>
                    <option value={1}>{t('settings.usb.fallbackScreen.1')}</option>
                    <option value={2}>{t('settings.usb.fallbackScreen.2')}</option>
                  </>
                )}
              </select>
            </div>

            {/* Revert on Disconnect Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <div className="flex flex-col">
                <span className="text-slate-200 font-medium">
                  {t('settings.usb.revertTitle')}
                </span>
                <span className="ui-type-micro text-slate-400">
                  {t('settings.usb.revertDesc')}
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
                {t('settings.usb.detectLabel')}
              </label>
              <select
                value={system.usbDetectMethod}
                onChange={e => setSystem(prev => ({ ...prev, usbDetectMethod: e.target.value as any }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              >
                <option value="serial_handshake">{t('settings.usb.detect.serial_handshake')}</option>
                <option value="cdc_dtr">{t('settings.usb.detect.cdc_dtr')}</option>
                <option value="vbus_power">{t('settings.usb.detect.vbus_power')}</option>
              </select>
            </div>

            {/* Monitored Metrics Badges */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-2">
              <span className="text-xs font-mono text-slate-300 uppercase font-semibold flex items-center gap-2">
                <Activity className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                {t('settings.usb.metricsTitle')}
              </span>
              <div className="flex flex-wrap gap-1.5 ui-type-micro font-mono">
                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {t('settings.usb.metric.cpu')}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {t('settings.usb.metric.ram')}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                  {t('settings.usb.metric.gpu')}
                </span>
                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  {t('settings.usb.metric.disk')}
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                  {t('settings.usb.metric.temp')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 4: Bluetooth & BLE Configuration */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="ui-type-title text-slate-100 flex items-center gap-2">
              <Bluetooth className="ui-icon-sm text-blue-400" aria-hidden="true" />
              {t('settings.bluetooth.sectionTitle')}
            </h3>
            <span className={`ui-type-micro font-mono px-2 py-0.5 rounded border ${
              system.bluetoothEnabled
                ? 'bg-blue-950 text-blue-400 border-blue-800'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}>
              {system.bluetoothEnabled ? system.bluetoothMode.toUpperCase() : t('settings.status.disabled')}
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
                  {t('settings.bluetooth.enableTitle')}
                </span>
                <span className="ui-type-micro text-slate-400 leading-relaxed">
                  {t('settings.bluetooth.enableDesc')}
                </span>
              </div>
            </label>

            {/* Bluetooth Mode */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('settings.bluetooth.modeLabel')}</label>
              <select
                disabled={!system.bluetoothEnabled}
                value={system.bluetoothMode}
                onChange={e => setSystem(prev => ({ ...prev, bluetoothMode: e.target.value as any }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 disabled:opacity-50"
              >
                <option value="ble">{t('settings.bluetooth.mode.ble')}</option>
                <option value="classic_spp">{t('settings.bluetooth.mode.classic_spp')}</option>
                <option value="ble_keyboard">{t('settings.bluetooth.mode.ble_keyboard')}</option>
                <option value="disabled">{t('settings.bluetooth.mode.disabled')}</option>
              </select>
            </div>

            {/* Bluetooth Device Name */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('settings.bluetooth.deviceNameLabel')}</label>
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
                <label className="text-xs text-slate-400 block mb-1">{t('settings.bluetooth.serviceLabel')}</label>
                <select
                  disabled={!system.bluetoothEnabled}
                  value={system.bleServiceType}
                  onChange={e => setSystem(prev => ({ ...prev, bleServiceType: e.target.value as any }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 disabled:opacity-50"
                >
                  <option value="pc_telemetry">{t('settings.bluetooth.service.pc_telemetry')}</option>
                  <option value="serial_spp">{t('settings.bluetooth.service.serial_spp')}</option>
                  <option value="battery_env">{t('settings.bluetooth.service.battery_env')}</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">{t('settings.bluetooth.txPowerLabel')}</label>
                <select
                  disabled={!system.bluetoothEnabled}
                  value={system.bleTxPower}
                  onChange={e => setSystem(prev => ({ ...prev, bleTxPower: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 disabled:opacity-50 font-mono"
                >
                  {([9, 6, 3, 0, -6] as const).map(power => (
                    <option key={power} value={power}>
                      {t(`settings.bluetooth.tx.${power}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* PIN Code and Advertising */}
            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="ui-type-micro text-slate-400 block mb-1">{t('settings.bluetooth.pairingPinLabel')}</label>
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
                <span className="text-slate-300 ui-type-micro">{t('settings.bluetooth.advertisingLabel')}</span>
                <input
                  type="checkbox"
                  disabled={!system.bluetoothEnabled}
                  checked={system.bleAdvertising}
                  onChange={e => setSystem(prev => ({ ...prev, bleAdvertising: e.target.checked }))}
                  className="w-4 h-4 rounded accent-blue-500 cursor-pointer disabled:opacity-50"
                />
              </div>
            </div>

            {/* RAM Tip */}
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl ui-type-micro text-slate-400 leading-relaxed">
              <strong>{t('settings.bluetooth.ramTip')}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
