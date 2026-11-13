import React, { useRef, useEffect, useState } from 'react';
import { 
  DisplayConfig, 
  SystemConfig,
  HardwareSimState, 
  Screen, 
  ApiIntegrationsConfig, 
  AutomationRule, 
  PetMood 
} from '../types';
import { GpioPinInspector } from './GpioPinInspector';
import { Esp32PinoutMap } from './Esp32PinoutMap';
import { useLocale } from '../i18n/LocaleContext';
import { 
  Power, 
  Eye, 
  RotateCw, 
  RotateCcw, 
  Sun, 
  Moon, 
  Thermometer, 
  Clock, 
  Gauge, 
  Activity, 
  Radio, 
  Sparkles,
  Cpu,
  Layers,
  Sliders,
  MapPin,
  Usb,
  Bluetooth
} from 'lucide-react';

interface HardwareSimulatorProps {
  display: DisplayConfig;
  setDisplay: React.Dispatch<React.SetStateAction<DisplayConfig>>;
  system: SystemConfig;
  setSystem: React.Dispatch<React.SetStateAction<SystemConfig>>;
  simState: HardwareSimState;
  setSimState: React.Dispatch<React.SetStateAction<HardwareSimState>>;
  screens: Screen[];
  apiConfig: ApiIntegrationsConfig;
  automations: AutomationRule[];
  onTriggerAction: (ruleName: string, mood?: PetMood, screenIndex?: number) => void;
}

export const HardwareSimulator: React.FC<HardwareSimulatorProps> = ({
  display,
  setDisplay,
  system,
  setSystem,
  simState,
  setSimState,
  screens,
  apiConfig,
  automations,
  onTriggerAction,
}) => {
  const { t } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeScreen = screens[simState.currentScreenIndex] || screens[0];
  const [hardwareStationTab, setHardwareStationTab] = useState<'pinout' | 'gpio_monitor'>('pinout');
  const [simulatedTime, setSimulatedTime] = useState<string>('14:30');

  const handleSimulatedTimeChange = (newTime: string) => {
    setSimulatedTime(newTime);
    // Sprawdź czy jakakolwiek reguła automatyzacji odpowiada tej godzinie
    const matchingRule = automations.find(r => r.enabled && r.trigger.type === 'time_is' && r.trigger.time === newTime);
    if (matchingRule) {
      if (matchingRule.action.type === 'set_brightness' && matchingRule.action.brightness !== undefined) {
        setDisplay(prev => ({ ...prev, brightness: matchingRule.action.brightness! }));
      }
      if (matchingRule.action.type === 'set_pet_mood' && matchingRule.action.petMood) {
        setSimState(prev => ({ ...prev, activePetMood: matchingRule.action.petMood! }));
      }
      if (matchingRule.action.type === 'switch_screen') {
        if (matchingRule.action.targetScreenId) {
          const found = screens.findIndex(s => s.id === matchingRule.action.targetScreenId);
          if (found >= 0) setSimState(prev => ({ ...prev, currentScreenIndex: found }));
        }
      }
      if (matchingRule.action.type === 'wake_display') {
        setSimState(prev => ({ ...prev, isDisplayAwake: true }));
      }

      setSimState(prev => ({
        ...prev,
        lastTriggerFired: `Zegar RTC [${newTime}] -> Uruchomiono regułę: "${matchingRule.name}"`,
      }));
      onTriggerAction(matchingRule.name, matchingRule.action.petMood);
    } else {
      setSimState(prev => ({
        ...prev,
        lastTriggerFired: `Zegar RTC [${newTime}] (Brak przypisanej reguły)`,
      }));
    }
  };

  // Helper colors based on theme
  const getThemeColors = () => {
    switch (display.theme) {
      case 'oled_neon_blue':
        return { bg: '#030712', fg: '#00f0ff', dim: '#0e7490', glow: 'oled-glow-blue' };
      case 'oled_pure_white':
        return { bg: '#000000', fg: '#ffffff', dim: '#64748b', glow: 'oled-glow-white' };
      case 'crt_amber':
        return { bg: '#0c0700', fg: '#ffb000', dim: '#78350f', glow: 'oled-glow-amber' };
      case 'terminal_green':
        return { bg: '#021005', fg: '#00ff66', dim: '#14532d', glow: 'oled-glow-green' };
      case 'cyberpunk_cyan_pink':
        return { bg: '#080114', fg: '#00f0ff', alt: '#ff007f', dim: '#47164d', glow: 'oled-glow-blue' };
      case 'epaper_bw':
        return { bg: '#f1f5f9', fg: '#0f172a', dim: '#94a3b8', glow: '' };
      case 'ips_rgb_full':
      default:
        return { bg: '#050b14', fg: '#38bdf8', alt: '#f43f5e', dim: '#334155', glow: 'oled-glow-blue' };
    }
  };

  const themeColors = getThemeColors();

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = simState.isDisplayAwake ? themeColors.bg : '#000000';
    ctx.fillRect(0, 0, display.width, display.height);

    if (!simState.isDisplayAwake) {
      // Screen is off / deep sleep
      ctx.fillStyle = '#1e293b';
      ctx.font = '7px monospace';
      ctx.fillText('[DEEP SLEEP - WAKE ON PIR/BOOT]', 4, display.height / 2);
      return;
    }

    // Set draw color based on brightness
    const alpha = Math.max(0.1, display.brightness / 100);
    ctx.globalAlpha = alpha;

    // Check for active notification popup
    const activeNotif = apiConfig.notifications.list[0];
    const isShowingNotif = apiConfig.notifications.enabled && activeNotif && simState.lastTriggerFired === 'Powiadomienie';

    if (isShowingNotif) {
      ctx.fillStyle = themeColors.bg;
      ctx.fillRect(2, 2, display.width - 4, display.height - 4);
      ctx.strokeStyle = themeColors.fg;
      ctx.lineWidth = 1;
      ctx.strokeRect(2, 2, display.width - 4, display.height - 4);

      ctx.fillStyle = themeColors.fg;
      ctx.font = 'bold 8px monospace';
      ctx.fillText(`! ${activeNotif.title}`, 6, 12);
      ctx.beginPath();
      ctx.moveTo(4, 16);
      ctx.lineTo(display.width - 4, 16);
      ctx.stroke();

      ctx.font = '7px monospace';
      ctx.fillText(activeNotif.message.slice(0, 22), 6, 28);
      ctx.fillText(activeNotif.message.slice(22, 44), 6, 38);
      ctx.font = '6px monospace';
      ctx.fillText(`Czas: ${activeNotif.time}`, 6, 52);
      ctx.globalAlpha = 1.0;
      return;
    }

    // Draw touch ripple / pointer crosshair if touch is active
    if (simState.touchActive && display.touchEnabled) {
      ctx.save();
      ctx.strokeStyle = '#f43f5e';
      ctx.fillStyle = 'rgba(244, 63, 94, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(simState.touchX, simState.touchY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(simState.touchX - 9, simState.touchY);
      ctx.lineTo(simState.touchX + 9, simState.touchY);
      ctx.moveTo(simState.touchX, simState.touchY - 9);
      ctx.lineTo(simState.touchX, simState.touchY + 9);
      ctx.stroke();

      // Coordinates tooltip
      ctx.fillStyle = '#ffffff';
      ctx.font = '6px monospace';
      ctx.fillText(`(${simState.touchX},${simState.touchY})`, Math.min(simState.touchX + 8, display.width - 28), Math.max(simState.touchY - 6, 8));
      ctx.restore();
    }

    // Draw widgets of current screen
    if (activeScreen && activeScreen.widgets) {
      activeScreen.widgets.forEach(widget => {
        ctx.save();
        ctx.fillStyle = themeColors.fg;
        ctx.strokeStyle = themeColors.fg;

        switch (widget.type) {
          case 'cyber_pet': {
            // Render animated eyes
            const mood = simState.activePetMood || widget.petMood || 'neutral';
            const w = widget.width;
            const h = widget.height;
            const eyeW = Math.floor(w / 2) - 8;
            const eyeH = h - 6;
            const leftX = widget.x + 2;
            const rightX = widget.x + Math.floor(w / 2) + 6;
            const eyeY = widget.y + 3;

            if (mood === 'sleep') {
              // Closed lines + Zzz
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(leftX, eyeY + eyeH / 2);
              ctx.lineTo(leftX + eyeW, eyeY + eyeH / 2);
              ctx.moveTo(rightX, eyeY + eyeH / 2);
              ctx.lineTo(rightX + eyeW, eyeY + eyeH / 2);
              ctx.stroke();

              ctx.font = 'bold 8px monospace';
              ctx.fillText('Zzz', rightX + eyeW - 6, widget.y);
            } else if (mood === 'happy') {
              // Curved smiling eyes ^_^
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(leftX + eyeW / 2, eyeY + eyeH / 2 + 4, eyeW / 2, Math.PI, 0, false);
              ctx.arc(rightX + eyeW / 2, eyeY + eyeH / 2 + 4, eyeW / 2, Math.PI, 0, false);
              ctx.stroke();
            } else if (mood === 'blink') {
              // Narrow horizontal strip
              ctx.fillRect(leftX, eyeY + eyeH / 2 - 1, eyeW, 2);
              ctx.fillRect(rightX, eyeY + eyeH / 2 - 1, eyeW, 2);
            } else if (mood === 'yawn') {
              // Yawning eyes + open mouth 'O'
              ctx.beginPath();
              ctx.roundRect(leftX, eyeY + 4, eyeW, eyeH - 8, 4);
              ctx.roundRect(rightX, eyeY + 4, eyeW, eyeH - 8, 4);
              ctx.fill();

              ctx.beginPath();
              ctx.arc(widget.x + w / 2, eyeY + eyeH, 4, 0, Math.PI * 2);
              ctx.stroke();
            } else if (mood === 'surprised') {
              // Wide surprised eyes with inner pupil
              ctx.beginPath();
              ctx.roundRect(leftX, eyeY - 2, eyeW + 2, eyeH + 4, 8);
              ctx.roundRect(rightX, eyeY - 2, eyeW + 2, eyeH + 4, 8);
              ctx.fill();

              ctx.fillStyle = themeColors.bg;
              ctx.beginPath();
              ctx.arc(leftX + eyeW / 2 + 1, eyeY + eyeH / 2, 3, 0, Math.PI * 2);
              ctx.arc(rightX + eyeW / 2 + 1, eyeY + eyeH / 2, 3, 0, Math.PI * 2);
              ctx.fill();
            } else if (mood === 'angry') {
              // Slanted eyebrows / angry eyes >_<
              ctx.beginPath();
              ctx.moveTo(leftX, eyeY + 2);
              ctx.lineTo(leftX + eyeW, eyeY + 8);
              ctx.lineTo(leftX + eyeW, eyeY + eyeH);
              ctx.lineTo(leftX, eyeY + eyeH - 4);
              ctx.closePath();
              ctx.fill();

              ctx.beginPath();
              ctx.moveTo(rightX + eyeW, eyeY + 2);
              ctx.lineTo(rightX, eyeY + 8);
              ctx.lineTo(rightX, eyeY + eyeH);
              ctx.lineTo(rightX + eyeW, eyeY + eyeH - 4);
              ctx.closePath();
              ctx.fill();
            } else if (mood === 'look_up') {
              // Patrzą do góry
              ctx.beginPath();
              ctx.roundRect(leftX, eyeY, eyeW, eyeH, 6);
              ctx.roundRect(rightX, eyeY, eyeW, eyeH, 6);
              ctx.fill();

              ctx.fillStyle = themeColors.bg;
              ctx.beginPath();
              ctx.arc(leftX + eyeW / 2, eyeY + 4, 3, 0, Math.PI * 2);
              ctx.arc(rightX + eyeW / 2, eyeY + 4, 3, 0, Math.PI * 2);
              ctx.fill();
            } else if (mood === 'look_left' || mood === 'glance_left') {
              // Spojrzenie w lewo
              ctx.beginPath();
              ctx.roundRect(leftX, eyeY, eyeW, eyeH, 6);
              ctx.roundRect(rightX, eyeY, eyeW, eyeH, 6);
              ctx.fill();

              ctx.fillStyle = themeColors.bg;
              ctx.beginPath();
              ctx.arc(leftX + 4, eyeY + eyeH / 2, 3, 0, Math.PI * 2);
              ctx.arc(rightX + 4, eyeY + eyeH / 2, 3, 0, Math.PI * 2);
              ctx.fill();
            } else if (mood === 'look_right' || mood === 'glance_right') {
              // Spojrzenie w prawo
              ctx.beginPath();
              ctx.roundRect(leftX, eyeY, eyeW, eyeH, 6);
              ctx.roundRect(rightX, eyeY, eyeW, eyeH, 6);
              ctx.fill();

              ctx.fillStyle = themeColors.bg;
              ctx.beginPath();
              ctx.arc(leftX + eyeW - 4, eyeY + eyeH / 2, 3, 0, Math.PI * 2);
              ctx.arc(rightX + eyeW - 4, eyeY + eyeH / 2, 3, 0, Math.PI * 2);
              ctx.fill();
            } else if (mood === 'look_around') {
              // Rozglądanie się (płynny ruch wahadłowy)
              const t = Date.now() / 450;
              const sweepX = Math.sin(t) * (eyeW / 3.2);
              ctx.beginPath();
              ctx.roundRect(leftX, eyeY, eyeW, eyeH, 6);
              ctx.roundRect(rightX, eyeY, eyeW, eyeH, 6);
              ctx.fill();

              ctx.fillStyle = themeColors.bg;
              ctx.beginPath();
              ctx.arc(leftX + eyeW / 2 + sweepX, eyeY + eyeH / 2, 3, 0, Math.PI * 2);
              ctx.arc(rightX + eyeW / 2 + sweepX, eyeY + eyeH / 2, 3, 0, Math.PI * 2);
              ctx.fill();
            } else if (mood === 'crazy' || mood === 'dizzy') {
              // Zaczyna wariować / wirujące oczy / party mode
              const t = Date.now() / 120;
              const rotX = Math.cos(t) * (eyeW / 3.5);
              const rotY = Math.sin(t) * (eyeH / 3.5);

              ctx.beginPath();
              ctx.roundRect(leftX, eyeY - (Math.sin(t * 2) * 2), eyeW, eyeH, 8);
              ctx.roundRect(rightX, eyeY + (Math.sin(t * 2) * 2), eyeW, eyeH, 8);
              ctx.fill();

              // Wirujące źrenice
              ctx.fillStyle = themeColors.bg;
              ctx.beginPath();
              ctx.arc(leftX + eyeW / 2 + rotX, eyeY + eyeH / 2 + rotY, 3.5, 0, Math.PI * 2);
              ctx.arc(rightX + eyeW / 2 - rotX, eyeY + eyeH / 2 - rotY, 3.5, 0, Math.PI * 2);
              ctx.fill();

              // Błyski pikseli
              ctx.fillStyle = themeColors.fg;
              ctx.fillRect(leftX + 2, eyeY - 3, 2, 2);
              ctx.fillRect(rightX + eyeW - 2, eyeY - 3, 2, 2);
            } else {
              // Default capsule eyes with slight shift
              ctx.beginPath();
              ctx.roundRect(leftX, eyeY, eyeW, eyeH, 6);
              ctx.roundRect(rightX, eyeY, eyeW, eyeH, 6);
              ctx.fill();

              // Inner pupil
              ctx.fillStyle = themeColors.bg;
              ctx.beginPath();
              ctx.arc(leftX + eyeW / 2, eyeY + eyeH / 2, 2.5, 0, Math.PI * 2);
              ctx.arc(rightX + eyeW / 2, eyeY + eyeH / 2, 2.5, 0, Math.PI * 2);
              ctx.fill();
            }
            break;
          }

          case 'clock': {
            ctx.font = widget.fontSize && widget.fontSize > 12 ? 'bold 14px monospace' : '8px monospace';
            const timeStr = simState.simulatedTime;
            ctx.fillText(timeStr, widget.x, widget.y + (widget.fontSize && widget.fontSize > 12 ? 12 : 7));
            if (widget.showDate) {
              ctx.font = '6px monospace';
              ctx.fillText(simState.simulatedDate, widget.x, widget.y + 18);
            }
            break;
          }

          case 'text': {
            ctx.font = widget.fontSize && widget.fontSize > 12 ? 'bold 12px monospace' : '8px monospace';
            let displayText = widget.label || '';
            if (widget.binding === 'pirActive' || widget.binding === 'pir') {
              displayText = simState.pirActive ? (widget.sensorActiveLabel || 'RUCH WYKRYTY!') : (widget.sensorInactiveLabel || 'Brak ruchu');
            } else if (widget.binding === 'ambientLux' || widget.binding === 'lux') {
              displayText = `${simState.ambientLux} ${widget.unit || 'lx'}`;
            } else if (widget.binding === 'potAdc' || widget.binding === 'pot') {
              displayText = `ADC: ${simState.potAdc}`;
            } else if (widget.binding === 'temp' || widget.binding === 'temperature') {
              displayText = `${simState.temperature.toFixed(1)}°C`;
            } else if (widget.binding === 'humidity') {
              displayText = `${simState.humidity}%`;
            } else if (widget.binding === 'usbConnected') {
              displayText = simState.usbConnected ? (widget.sensorActiveLabel || 'USB: POLACZONO') : (widget.sensorInactiveLabel || 'USB: BRAK');
            } else if (widget.binding === 'bluetoothConnected') {
              displayText = simState.bluetoothConnected ? (widget.sensorActiveLabel || 'BLE: POLACZONO') : (widget.sensorInactiveLabel || 'BLE: BRAK');
            } else if (widget.binding === 'cpu') displayText = `CPU: ${apiConfig.pcMonitor.data.cpuUsage}%`;
            else if (widget.binding === 'ram') displayText = `RAM: ${apiConfig.pcMonitor.data.ramUsage}%`;
            else if (widget.binding === 'gpu') displayText = `GPU: ${apiConfig.pcMonitor.data.gpuUsage}%`;
            else if (widget.binding === 'disk') displayText = `DYSK: ${apiConfig.pcMonitor.data.diskUsage ?? 64}%`;
            else if (widget.binding === 'time') displayText = simState.simulatedTime;
            else if (widget.binding === 'date') displayText = simState.simulatedDate;
            ctx.fillText(displayText, widget.x, widget.y + 8);
            break;
          }

          case 'gauge': {
            // Draw arc gauge or numeric box
            const val = (widget.binding === 'temp' || widget.binding === 'temperature') ? simState.temperature :
                        (widget.binding === 'lux' || widget.binding === 'ambientLux') ? simState.ambientLux :
                        (widget.binding === 'pot' || widget.binding === 'potAdc') ? simState.potAdc :
                        widget.binding === 'humidity' ? simState.humidity :
                        (widget.binding === 'pirActive' || widget.binding === 'pir') ? (simState.pirActive ? 100 : 0) :
                        apiConfig.pcMonitor.data.cpuUsage;
            const min = widget.minVal || 0;
            const max = widget.maxVal || (widget.binding === 'potAdc' ? 4095 : 100);
            const pct = Math.max(0, Math.min(1, (val - min) / (max - min)));

            ctx.lineWidth = 1;
            ctx.strokeRect(widget.x, widget.y, widget.width, widget.height);
            ctx.fillRect(widget.x + 2, widget.y + 2, Math.floor((widget.width - 4) * pct), widget.height - 4);
            
            ctx.fillStyle = themeColors.bg;
            ctx.font = 'bold 7px monospace';
            const labelStr = `${Math.round(val)}${widget.unit || ''}`;
            ctx.fillText(labelStr, widget.x + 4, widget.y + widget.height - 4);
            break;
          }

          case 'progress_bar': {
            const val = (widget.binding === 'temp' || widget.binding === 'temperature') ? simState.temperature :
                        (widget.binding === 'lux' || widget.binding === 'ambientLux') ? simState.ambientLux :
                        (widget.binding === 'pot' || widget.binding === 'potAdc') ? simState.potAdc :
                        widget.binding === 'humidity' ? simState.humidity :
                        (widget.binding === 'pirActive' || widget.binding === 'pir') ? (simState.pirActive ? 100 : 0) :
                        widget.binding === 'ram' ? apiConfig.pcMonitor.data.ramUsage :
                        widget.binding === 'gpu' ? apiConfig.pcMonitor.data.gpuUsage :
                        widget.binding === 'disk' ? (apiConfig.pcMonitor.data.diskUsage ?? 64) :
                        apiConfig.pcMonitor.data.cpuUsage;
            const min = widget.minVal || 0;
            const max = widget.maxVal || (widget.binding === 'potAdc' ? 4095 : 100);
            const pct = Math.max(0, Math.min(1, (val - min) / (max - min)));

            ctx.lineWidth = 1;
            ctx.strokeRect(widget.x, widget.y, widget.width, widget.height);
            ctx.fillRect(widget.x + 1, widget.y + 1, Math.floor((widget.width - 2) * pct), widget.height - 2);

            ctx.font = '6px monospace';
            ctx.fillStyle = themeColors.fg;
            ctx.fillText(widget.label || '', widget.x, widget.y - 2);
            break;
          }

          case 'sparkline': {
            ctx.lineWidth = 1;
            ctx.strokeRect(widget.x, widget.y, widget.width, widget.height);
            ctx.beginPath();
            const pts = widget.historyPoints || 16;
            const step = (widget.width - 4) / pts;
            for (let i = 0; i <= pts; i++) {
              // Simulated wave based on cpu/temp
              const seed = (Math.sin(i * 0.8 + Date.now() / 800) + 1) / 2;
              const yVal = widget.y + widget.height - 2 - (seed * (widget.height - 4));
              if (i === 0) ctx.moveTo(widget.x + 2, yVal);
              else ctx.lineTo(widget.x + 2 + i * step, yVal);
            }
            ctx.stroke();
            break;
          }

          case 'weather': {
            // Weather icon + temp
            const wData = apiConfig.weather.data;
            ctx.beginPath();
            ctx.arc(widget.x + 10, widget.y + 12, 7, 0, Math.PI * 2);
            ctx.stroke();

            ctx.font = 'bold 10px monospace';
            ctx.fillText(`${wData.temperature.toFixed(1)}°`, widget.x + 22, widget.y + 10);
            ctx.font = '7px monospace';
            ctx.fillText(wData.city, widget.x + 22, widget.y + 20);
            break;
          }

          case 'pc_monitor': {
            const pc = apiConfig.pcMonitor.data;
            const diskVal = pc.diskUsage ?? 64;
            ctx.font = '7px monospace';
            ctx.fillText(`CPU:${pc.cpuUsage}% RAM:${pc.ramUsage}%`, widget.x, widget.y + 7);
            ctx.fillText(`GPU:${pc.gpuUsage}% DYSK:${diskVal}%`, widget.x, widget.y + 16);
            
            // 4 mini resource bars: CPU, RAM, GPU, DISK
            const barW = Math.max(18, Math.floor((widget.width - 15) / 4));
            
            // 1. CPU Bar
            ctx.strokeRect(widget.x, widget.y + 20, barW, 4);
            ctx.fillRect(widget.x + 1, widget.y + 21, Math.max(1, Math.floor((barW - 2) * (pc.cpuUsage / 100))), 2);
            
            // 2. RAM Bar
            ctx.strokeRect(widget.x + barW + 4, widget.y + 20, barW, 4);
            ctx.fillRect(widget.x + barW + 5, widget.y + 21, Math.max(1, Math.floor((barW - 2) * (pc.ramUsage / 100))), 2);
            
            // 3. GPU Bar
            ctx.strokeRect(widget.x + (barW + 4) * 2, widget.y + 20, barW, 4);
            ctx.fillRect(widget.x + (barW + 4) * 2 + 1, widget.y + 21, Math.max(1, Math.floor((barW - 2) * (pc.gpuUsage / 100))), 2);
            
            // 4. DISK Bar
            ctx.strokeRect(widget.x + (barW + 4) * 3, widget.y + 20, barW, 4);
            ctx.fillRect(widget.x + (barW + 4) * 3 + 1, widget.y + 21, Math.max(1, Math.floor((barW - 2) * (diskVal / 100))), 2);
            break;
          }

          case 'battery_wifi': {
            // Battery icon
            ctx.lineWidth = 1;
            ctx.strokeRect(widget.x, widget.y, 14, 7);
            ctx.fillRect(widget.x + 2, widget.y + 2, 8, 3);
            ctx.fillRect(widget.x + 14, widget.y + 2, 1, 3);

            // WiFi status
            ctx.font = '7px monospace';
            ctx.fillText('WiFi', widget.x + 18, widget.y + 6);
            break;
          }

          case 'menu': {
            ctx.font = 'bold 8px monospace';
            ctx.fillText(widget.menuTitle || 'MENU', widget.x, widget.y + 8);
            ctx.beginPath();
            ctx.moveTo(widget.x, widget.y + 11);
            ctx.lineTo(widget.x + widget.width, widget.y + 11);
            ctx.stroke();

            const items = widget.menuItems || [];
            ctx.font = '7px monospace';
            items.slice(0, 4).forEach((item, idx) => {
              const isSelected = (widget.selectedIndex || 0) === idx;
              if (isSelected) {
                ctx.fillText(`> ${item}`, widget.x, widget.y + 21 + idx * 9);
              } else {
                ctx.fillText(`  ${item}`, widget.x, widget.y + 21 + idx * 9);
              }
            });
            break;
          }

          default:
            ctx.strokeRect(widget.x, widget.y, widget.width, widget.height);
            break;
        }

        ctx.restore();
      });
    }

    ctx.globalAlpha = 1.0;
  }, [display, simState, activeScreen, apiConfig, themeColors]);

  // Handle BOOT button press (GPIO 0)
  const handleBootButton = () => {
    setSimState(prev => {
      const nextScreen = (prev.currentScreenIndex + 1) % screens.length;
      return {
        ...prev,
        bootPressed: true,
        currentScreenIndex: nextScreen,
        isDisplayAwake: true,
        lastTriggerFired: 'Przycisk BOOT (GPIO 0) -> Następny ekran',
      };
    });
    setTimeout(() => {
      setSimState(prev => ({ ...prev, bootPressed: false }));
    }, 150);
  };

  // Handle User Button (GPIO 35)
  const handleUserButton = () => {
    setSimState(prev => ({
      ...prev,
      userBtn1Pressed: true,
      lastTriggerFired: 'Przycisk USER 1 (GPIO 35)',
    }));
    setTimeout(() => {
      setSimState(prev => ({ ...prev, userBtn1Pressed: false }));
    }, 150);
  };

  // Handle PIR Motion Sensor Toggle
  const handleTogglePIR = () => {
    const nextVal = !simState.pirActive;
    setSimState(prev => ({
      ...prev,
      pirActive: nextVal,
      isDisplayAwake: true,
      activePetMood: nextVal ? 'surprised' : 'neutral',
      lastTriggerFired: nextVal ? 'PIR: Wykryto ruch! (GPIO 14)' : 'PIR: Brak ruchu',
    }));
    if (nextVal) {
      onTriggerAction('PIR Ruch', 'surprised');
    }
  };

  // Handle Rotary Turn
  const handleRotaryStep = (dir: 1 | -1) => {
    setSimState(prev => {
      const newPos = prev.encoderVal + dir;
      // Change selected item in menu if active screen has menu
      return {
        ...prev,
        encoderVal: newPos,
        lastTriggerFired: `Impulsator obrót: ${dir > 0 ? 'W prawo' : 'W lewo'} (${newPos})`,
      };
    });
  };

  // Handle USB-C Cable Plug / Unplug
  const handleUsbCableToggle = () => {
    const nextState = !simState.usbConnected;
    if (nextState) {
      // Connect USB-C cable to PC
      const targetScreen = system.usbSwitchScreenIndex ?? 2;
      setSimState(prev => ({
        ...prev,
        usbConnected: true,
        previousScreenBeforeUsb: prev.currentScreenIndex,
        currentScreenIndex: system.usbAutoSwitchToPcMonitor ? targetScreen : prev.currentScreenIndex,
        isDisplayAwake: true,
        lastTriggerFired: system.usbAutoSwitchToPcMonitor 
          ? `USB-C: podłączono — ekran przełączony na Monitor Zasobów PC (CPU, RAM, GPU, Dysk)`
          : 'USB-C: podłączono do komputera (zasilanie i port COM aktywne)',
      }));
      onTriggerAction('Podłączenie kabla USB-C (Monitor PC)', 'happy', system.usbAutoSwitchToPcMonitor ? targetScreen : undefined);
    } else {
      // Disconnect USB-C cable
      setSimState(prev => {
        const revertTo = (system.usbDisconnectRevertScreen && prev.previousScreenBeforeUsb !== undefined)
          ? prev.previousScreenBeforeUsb
          : prev.currentScreenIndex;
        return {
          ...prev,
          usbConnected: false,
          currentScreenIndex: revertTo,
          lastTriggerFired: system.usbDisconnectRevertScreen
            ? 'USB-C: odłączono — powrót do poprzedniego ekranu'
            : 'USB-C: odłączono',
        };
      });
      onTriggerAction('Odłączenie kabla USB-C');
    }
  };

  // Handle Bluetooth BLE Connection Simulation
  const handleBluetoothToggle = () => {
    setSimState(prev => {
      const next = !prev.bluetoothConnected;
      return {
        ...prev,
        bluetoothConnected: next,
        lastTriggerFired: next 
          ? `Bluetooth BLE: połączono z PC (${system.bluetoothDeviceName})`
          : 'Bluetooth BLE: rozłączono',
      };
    });
  };

  // Handle direct touch / click on display canvas
  const handleCanvasPointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const scaleX = display.width / rect.width;
    const scaleY = display.height / rect.height;
    const x = Math.max(0, Math.min(display.width - 1, Math.round((clientX - rect.left) * scaleX)));
    const y = Math.max(0, Math.min(display.height - 1, Math.round((clientY - rect.top) * scaleY)));

    setSimState(prev => {
      let nextMood = prev.activePetMood;
      // If clicking on cyber pet, make it happy
      const petWidget = activeScreen?.widgets.find(w => w.type === 'cyber_pet');
      if (petWidget && x >= petWidget.x && x <= petWidget.x + petWidget.width && y >= petWidget.y && y <= petWidget.y + petWidget.height) {
        nextMood = 'happy';
      }

      return {
        ...prev,
        touchActive: true,
        touchX: x,
        touchY: y,
        touchGesture: 'tap',
        activePetMood: nextMood,
        isDisplayAwake: true,
        lastTriggerFired: `Dotyk ekranu [${display.touchController.toUpperCase()}]: Tap (${x}, ${y})`,
      };
    });
  };

  const handleCanvasPointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!simState.touchActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const scaleX = display.width / rect.width;
    const scaleY = display.height / rect.height;
    const x = Math.max(0, Math.min(display.width - 1, Math.round((clientX - rect.left) * scaleX)));
    const y = Math.max(0, Math.min(display.height - 1, Math.round((clientY - rect.top) * scaleY)));

    setSimState(prev => ({
      ...prev,
      touchX: x,
      touchY: y,
    }));
  };

  const handleCanvasPointerUp = () => {
    setTimeout(() => {
      setSimState(prev => ({
        ...prev,
        touchActive: false,
      }));
    }, 450);
  };

  // Simulate gestures
  const handleSimulateGesture = (gesture: 'tap' | 'swipe_left' | 'swipe_right' | 'long_press') => {
    const midX = Math.round(display.width / 2);
    const midY = Math.round(display.height / 2);

    if (gesture === 'swipe_left') {
      const nextScreen = (simState.currentScreenIndex + 1) % screens.length;
      setSimState(prev => ({
        ...prev,
        touchActive: true,
        touchX: midX,
        touchY: midY,
        touchGesture: 'swipe_left',
        currentScreenIndex: nextScreen,
        lastTriggerFired: `Gest dotykowy: Przesunięcie w lewo (Swipe L) -> Ekran ${nextScreen + 1}`,
      }));
    } else if (gesture === 'swipe_right') {
      const prevScreen = (simState.currentScreenIndex - 1 + screens.length) % screens.length;
      setSimState(prev => ({
        ...prev,
        touchActive: true,
        touchX: midX,
        touchY: midY,
        touchGesture: 'swipe_right',
        currentScreenIndex: prevScreen,
        lastTriggerFired: `Gest dotykowy: Przesunięcie w prawo (Swipe R) -> Ekran ${prevScreen + 1}`,
      }));
    } else if (gesture === 'tap') {
      setSimState(prev => ({
        ...prev,
        touchActive: true,
        touchX: midX,
        touchY: midY,
        touchGesture: 'tap',
        activePetMood: 'happy',
        lastTriggerFired: `Gest dotykowy: Dotknięcie środka ekranu (Tap)`,
      }));
    } else {
      setSimState(prev => ({
        ...prev,
        touchActive: true,
        touchX: midX,
        touchY: midY,
        touchGesture: 'long_press',
        activePetMood: 'surprised',
        lastTriggerFired: `Gest dotykowy: Długie przytrzymanie (Long Press)`,
      }));
    }

    setTimeout(() => {
      setSimState(prev => ({ ...prev, touchActive: false }));
    }, 600);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Telemetry Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-slate-900/90 border border-slate-800 rounded-xl text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono text-cyan-400">
            <Activity className="ui-icon-sm animate-pulse" aria-hidden="true" />
            <span>ESP32-WROOM-32D</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">{t('sim.screen')}: <strong className="text-slate-200 font-mono">{display.model.replace('_', ' ').toUpperCase()}</strong></span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">{t('sim.touch')}: <strong className="text-rose-400 font-mono">{display.touchEnabled ? display.touchController.toUpperCase() : t('sim.touchOff')}</strong></span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400">{t('sim.state')}:</span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-mono font-medium ${simState.isDisplayAwake ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'}`}>
            <span className={`w-2 h-2 rounded-full ${simState.isDisplayAwake ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            {simState.isDisplayAwake ? t('sim.on') : t('sim.sleep')}
          </span>
          <button
            onClick={() => setSimState(prev => ({ ...prev, isDisplayAwake: !prev.isDisplayAwake }))}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title={t('sim.powerTitle')}
          >
            <Power className="ui-icon-sm" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Main Hardware Lab Workspace: Board & Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Virtual Breadboard / Hardware Case (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center p-6 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden shadow-2xl">
          {/* Subtle PCB copper trace aesthetic lines */}
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Module Label */}
          <div className="w-full flex items-center justify-between mb-4 pb-2 border-b border-slate-800/80 ui-type-micro font-mono text-slate-400">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" title="Power LED (3.3V)" />
              <span>ESP32 I2C OLED & TOUCH EMULATOR</span>
            </span>
            <span className="text-slate-500">{display.width} x {display.height} px · {display.touchEnabled ? t('sim.capacitive') : t('sim.displayOnly')}</span>
          </div>

          {/* Realistic Display Housing */}
          <div className="relative p-5 bg-slate-950 border-2 border-slate-800 rounded-xl shadow-2xl flex flex-col items-center">
            {/* Display Pin Headers Top */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 mb-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded ui-type-micro font-mono text-slate-400">
              <span className="text-rose-400 font-bold">VCC</span>
              <span className="text-slate-500 font-bold">GND</span>
              <span className="text-amber-400 font-bold">{display.bus === 'i2c' ? 'SCL' : 'SCK'}</span>
              <span className="text-cyan-400 font-bold">{display.bus === 'i2c' ? 'SDA' : 'MOSI'}</span>
              {display.touchEnabled && (
                <>
                  <span className="text-slate-600">|</span>
                  <span className="text-rose-400 font-bold" title="Touch SDA (GPIO 33)">T_SDA</span>
                  <span className="text-rose-400 font-bold" title="Touch SCL (GPIO 32)">T_SCL</span>
                  <span className="text-rose-300 font-bold" title="Touch Interrupt (GPIO 27)">T_INT</span>
                </>
              )}
            </div>

            {/* Display Glass Bezel */}
            <div 
              className={`p-3 bg-black rounded-lg border border-slate-800 transition-all ${themeColors.glow} relative cursor-crosshair`}
              style={{
                width: display.width * 2.8 + 24,
                height: display.height * 2.8 + 24,
              }}
            >
              {/* Glass Reflection Highlight */}
              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none rounded-t-lg" />
              
              {/* Simulated Raster Pixel Layer */}
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black rounded">
                <canvas
                  ref={canvasRef}
                  width={display.width}
                  height={display.height}
                  onMouseDown={handleCanvasPointerDown}
                  onMouseMove={handleCanvasPointerMove}
                  onMouseUp={handleCanvasPointerUp}
                  onTouchStart={handleCanvasPointerDown}
                  onTouchMove={handleCanvasPointerMove}
                  onTouchEnd={handleCanvasPointerUp}
                  className={`w-full h-full image-rendering-pixelated ${display.pixelGridEffect ? 'pixel-matrix-grid' : ''}`}
                />
              </div>
            </div>

            {/* Display Subtitle with Touch coordinates live indicator */}
            <div className="mt-3 flex items-center justify-between w-full px-2 ui-type-micro font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span>KONTROLER: {display.touchEnabled ? display.touchController.toUpperCase() : 'BRAK'}</span>
                {simState.touchActive && (
                  <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded ui-type-micro font-bold animate-pulse">
                    DOTYK: X={simState.touchX} Y={simState.touchY}
                  </span>
                )}
              </span>
              <span className="text-cyan-400">AKTYWNY: {activeScreen?.name || 'Brak'}</span>
            </div>
          </div>

          {/* Podręczny Pasek Regulacji Jasności Ekranu */}
          <div className="mt-4 w-full max-w-lg flex flex-col gap-2 p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium flex items-center gap-2">
                <Sun className="ui-icon-sm text-amber-400" aria-hidden="true" />
                Podręczna Jasność Ekranu (PWM):
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-cyan-400 font-bold">{display.brightness}%</span>
                <span className="ui-type-micro text-slate-500 font-mono">(podgląd na żywo)</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={display.brightness}
                onChange={e => setDisplay(prev => ({ ...prev, brightness: Number(e.target.value) }))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex items-center gap-1 shrink-0">
                {[15, 50, 80, 100].map(b => (
                  <button
                    key={b}
                    onClick={() => setDisplay(prev => ({ ...prev, brightness: b }))}
                    className={`px-2 py-0.5 rounded ui-type-micro font-mono transition-colors ${
                      display.brightness === b 
                        ? 'bg-cyan-500 text-slate-950 font-bold' 
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {b}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Touch Gesture Control Buttons */}
          {display.touchEnabled && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs">
              <span className="ui-type-micro font-mono text-slate-500 mr-1">Gesty Dotyku:</span>
              <button
                onClick={() => handleSimulateGesture('tap')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono ui-type-micro transition-colors"
              >
                Tap (Dotknij)
              </button>
              <button
                onClick={() => handleSimulateGesture('swipe_left')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono ui-type-micro transition-colors"
              >
                Swipe &larr; (Następny)
              </button>
              <button
                onClick={() => handleSimulateGesture('swipe_right')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono ui-type-micro transition-colors"
              >
                Swipe &rarr; (Poprzedni)
              </button>
              <button
                onClick={() => handleSimulateGesture('long_press')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono ui-type-micro transition-colors"
              >
                Long Press
              </button>
            </div>
          )}

          {/* Interactive Physical Buttons on the Board */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            {/* BOOT Pushbutton */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={handleBootButton}
                className={`w-14 h-14 rounded-full border-2 transition-all flex flex-col items-center justify-center font-mono active:scale-95 ${
                  simState.bootPressed
                    ? 'bg-cyan-500 border-white text-slate-950 shadow-[0_0_15px_#06b6d4]'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-cyan-500 hover:text-white'
                }`}
              >
                <span className="text-xs font-bold leading-tight">BOOT</span>
                <span className={`ui-type-micro font-medium leading-none mt-0.5 ${simState.bootPressed ? 'text-slate-900' : 'text-slate-400'}`}>GPIO 0</span>
              </button>
              <span className="text-xs font-medium text-slate-400">Przełącz ekran</span>
            </div>

            {/* Extra User Button 1 */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={handleUserButton}
                className={`w-14 h-14 rounded-full border-2 transition-all flex flex-col items-center justify-center font-mono active:scale-95 ${
                  simState.userBtn1Pressed
                    ? 'bg-amber-500 border-white text-slate-950 shadow-[0_0_15px_#f59e0b]'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-amber-500 hover:text-white'
                }`}
              >
                <span className="text-xs font-bold leading-tight">USER</span>
                <span className={`ui-type-micro font-medium leading-none mt-0.5 ${simState.userBtn1Pressed ? 'text-slate-900' : 'text-slate-400'}`}>GPIO 35</span>
              </button>
              <span className="text-xs font-medium text-slate-400">Przycisk 2</span>
            </div>

            {/* Rotary Encoder Widget */}
            <div className="flex flex-col items-center gap-1.5 ml-4 pl-4 border-l border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRotaryStep(-1)}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white active:scale-95 transition-colors"
                  title="Obróć impulsator w lewo"
                >
                  <RotateCcw className="ui-icon-sm" aria-hidden="true" />
                </button>
                <div 
                  onClick={() => handleRotaryStep(1)}
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-slate-600 flex items-center justify-center cursor-pointer shadow-inner relative group active:scale-95"
                  title="Kliknij lub obracaj enkoder"
                >
                  <div 
                    className="w-2.5 h-2.5 rounded-full bg-cyan-400 transition-transform" 
                    style={{ transform: `rotate(${simState.encoderVal * 30}deg) translate(0, -14px)` }} 
                  />
                  <span className="ui-type-micro font-mono font-bold text-slate-200">ENC</span>
                </div>
                <button
                  onClick={() => handleRotaryStep(1)}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white active:scale-95 transition-colors"
                  title="Obróć impulsator w prawo"
                >
                  <RotateCw className="ui-icon-sm" aria-hidden="true" />
                </button>
              </div>
              <span className="text-xs font-medium text-slate-400">Impulsator obrotowy</span>
            </div>

            {/* USB-C Cable Plug / Unplug Simulator */}
            <div className="flex flex-col items-center gap-1.5 ml-2 pl-3 border-l border-slate-800">
              <button
                onClick={handleUsbCableToggle}
                className={`px-3.5 py-2.5 rounded-xl border flex items-center gap-2.5 font-mono transition-all shadow-sm active:scale-95 ${
                  simState.usbConnected
                    ? 'bg-cyan-500 border-cyan-300 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
                }`}
                title="Kliknij, aby symulować podłączenie kabla USB-C do komputera (automatyczne przełączenie na monitor PC)"
               aria-label="Kliknij, aby symulować podłączenie kabla USB-C do komputera (automatyczne przełączenie na monitor PC)">
                <Usb className="ui-icon-sm stroke-[2.3] shrink-0" aria-hidden="true" />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold leading-tight">Kabel USB-C</span>
                  <span className={`ui-type-micro font-semibold mt-0.5 tracking-wider uppercase ${simState.usbConnected ? 'text-slate-950' : 'text-slate-400'}`}>
                    {simState.usbConnected ? 'PODŁĄCZONY' : 'ODŁĄCZONY'}
                  </span>
                </div>
              </button>
              <span className="text-xs font-medium text-slate-400">Podłącz do PC</span>
            </div>

            {/* Bluetooth BLE Connection Simulator */}
            {system.bluetoothEnabled && (
              <div className="flex flex-col items-center gap-1.5 ml-2 pl-3 border-l border-slate-800">
                <button
                  onClick={handleBluetoothToggle}
                  className={`px-3.5 py-2.5 rounded-xl border flex items-center gap-2.5 font-mono transition-all shadow-sm active:scale-95 ${
                    simState.bluetoothConnected
                      ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
                  }`}
                  title="Symuluj połączenie bezprzewodowe Bluetooth BLE z komputerem"
                 aria-label="Symuluj połączenie bezprzewodowe Bluetooth BLE z komputerem">
                  <Bluetooth className="ui-icon-sm shrink-0" aria-hidden="true" />
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold leading-tight">Bluetooth</span>
                    <span className={`ui-type-micro font-semibold mt-0.5 tracking-wider uppercase ${simState.bluetoothConnected ? 'text-blue-100' : 'text-slate-400'}`}>
                      {simState.bluetoothConnected ? 'POŁĄCZONY' : 'ROZŁĄCZONY'}
                    </span>
                  </div>
                </button>
                <span className="text-xs font-medium text-slate-400">Łączność BLE</span>
              </div>
            )}
          </div>

          {/* Last Fired Automation Banner */}
          {simState.lastTriggerFired && (
            <div className="mt-4 px-3.5 py-2 bg-cyan-950/50 border border-cyan-800/60 rounded-lg text-xs font-mono text-cyan-300 flex items-center gap-2.5">
              <Sparkles className="ui-icon-sm text-cyan-400 shrink-0" aria-hidden="true" />
              <span>Zdarzenie: <strong className="text-white">{simState.lastTriggerFired}</strong></span>
            </div>
          )}
        </div>

        {/* Sensor & Environment Simulation Controls (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Radio className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                Wirtualne Czujniki i Sensory ESP32
              </h3>
              <span className="ui-type-micro font-mono text-slate-500">Symulacja na żywo</span>
            </div>

            {/* Wirtualny Zegar Czasu Rzeczywistego RTC / Symulacja Pory Dnia */}
            <div className="flex flex-col gap-2.5 p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-300 font-medium">
                  <Clock className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                  Wirtualny Czas RTC (Zegar ESP32):
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={simulatedTime}
                    onChange={e => handleSimulatedTimeChange(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-cyan-400 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Szybkie przyciski symulacji pory dnia do testowania reguł automatyzacji */}
              <div className="flex flex-wrap gap-1">
                {[
                  { label: '07:00 Rano', val: '07:00' },
                  { label: '12:00 Południe', val: '12:00' },
                  { label: '18:00 Wieczór', val: '18:00' },
                  { label: '22:00 Noc', val: '22:00' },
                  { label: '23:30 Cisza', val: '23:30' },
                ].map(p => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => handleSimulatedTimeChange(p.val)}
                    className={`px-2 py-0.5 rounded ui-type-micro font-mono transition-colors ${
                      simulatedTime === p.val
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                    }`}
                    title={`Symuluj godzinę ${p.val} (wyzwala reguły time_is)`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* PIR Motion Sensor Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${simState.pirActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-500'}`}>
                  <Activity className="ui-icon-sm" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-200">Czujnik Ruchu PIR (GPIO 14)</div>
                  <div className="ui-type-micro text-slate-400">Wybudza ekran i reakcje cyber-zwierzaka</div>
                </div>
              </div>
              <button
                onClick={handleTogglePIR}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                  simState.pirActive 
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_12px_#06b6d4]' 
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {simState.pirActive ? 'RUCH: TAK' : 'RUCH: BRAK'}
              </button>
            </div>

            {/* Ambient Light Sensor LDR */}
            <div className="flex flex-col gap-2 p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-300 font-medium">
                  {simState.ambientLux < 50 ? <Moon className="ui-icon-sm text-indigo-400" aria-hidden="true" /> : <Sun className="ui-icon-sm text-amber-400" aria-hidden="true" />}
                  Sensor Światła LDR (GPIO 36 / ADC)
                </span>
                <span className="font-mono text-cyan-400 font-semibold">{simState.ambientLux} lux</span>
              </div>
              <input
                type="range"
                min="0"
                max="1000"
                step="10"
                value={simState.ambientLux}
                onChange={e => {
                  const val = Number(e.target.value);
                  setSimState(prev => ({ ...prev, ambientLux: val }));
                }}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <div className="flex justify-between ui-type-micro font-mono text-slate-500">
                <span>0 lx (Noc / Ciemno)</span>
                <span>500 lx (Biuro)</span>
                <span>1000 lx (Słońce)</span>
              </div>
            </div>

            {/* DHT22 Temperature & Humidity */}
            <div className="flex flex-col gap-2 p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-300 font-medium">
                  <Thermometer className="ui-icon-sm text-rose-400" aria-hidden="true" />
                  Temperatura otoczenia DHT22 (GPIO 4)
                </span>
                <span className="font-mono text-rose-400 font-semibold">{simState.temperature.toFixed(1)} °C</span>
              </div>
              <input
                type="range"
                min="-5"
                max="45"
                step="0.5"
                value={simState.temperature}
                onChange={e => {
                  const val = Number(e.target.value);
                  setSimState(prev => ({ ...prev, temperature: val }));
                }}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
              />
            </div>

            {/* Analog Potentiometer (ADC 0-4095) */}
            <div className="flex flex-col gap-2 p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-300 font-medium">
                  <Gauge className="ui-icon-sm text-emerald-400" aria-hidden="true" />
                  Potencjometr Analogowy (GPIO 34 / ADC1)
                </span>
                <span className="font-mono text-emerald-400 font-semibold">{simState.potAdc} / 4095</span>
              </div>
              <input
                type="range"
                min="0"
                max="4095"
                step="15"
                value={simState.potAdc}
                onChange={e => {
                  const val = Number(e.target.value);
                  setSimState(prev => ({ ...prev, potAdc: val }));
                }}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>

            {/* Time Scrubber (Test Day/Night Pet Automations) */}
            <div className="flex flex-col gap-2 p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-300 font-medium">
                  <Clock className="ui-icon-sm text-indigo-400" aria-hidden="true" />
                  Symulowana Godzina (Zegar NTP)
                </span>
                <span className="font-mono text-indigo-300 font-semibold">{simState.simulatedTime}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSimState(prev => ({
                      ...prev,
                      simulatedTime: '12:00:00',
                      activePetMood: 'happy',
                      lastTriggerFired: 'Zegar: 12:00 (Dzień - Zwierzak aktywny)',
                    }));
                  }}
                  className="flex-1 py-1 px-2 bg-slate-800 hover:bg-slate-700 rounded ui-type-micro font-mono text-slate-300"
                >
                  12:00 (Dzień)
                </button>
                <button
                  onClick={() => {
                    setSimState(prev => ({
                      ...prev,
                      simulatedTime: '23:00:00',
                      activePetMood: 'sleep',
                      lastTriggerFired: 'Zegar: 23:00 (Noc - Zwierzak ziewa i idzie spać!)',
                    }));
                  }}
                  className="flex-1 py-1 px-2 bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800/60 rounded ui-type-micro font-mono text-indigo-300"
                >
                  23:00 (Ziewanie & Sen)
                </button>
              </div>
            </div>

            {/* Cyber-Pet Direct Mood Selector */}
            <div className="flex flex-col gap-2 p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-300 font-medium">
                  <Eye className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                  Ręczny Nastrój Cyber-Zwierzaka
                </span>
                <span className="font-mono text-cyan-400">{simState.activePetMood}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(['neutral', 'happy', 'surprised', 'yawn', 'sleep', 'angry', 'blink'] as PetMood[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setSimState(prev => ({ ...prev, activePetMood: m, isDisplayAwake: true }))}
                    className={`py-1 px-1.5 rounded ui-type-micro font-mono capitalize transition-colors ${
                      simState.activePetMood === m
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hardware Architecture Station: Interactive ESP32 Pinout Map & GPIO Monitor */}
      <div className="mt-8 flex flex-col gap-4">
        {/* Tab Switcher Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHardwareStationTab('pinout')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                hardwareStationTab === 'pinout'
                  ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Cpu className="ui-icon-sm" aria-hidden="true" />
              <span>Interaktywna Mapa Pinów ESP32 (Konfigurator)</span>
            </button>

            <button
              onClick={() => setHardwareStationTab('gpio_monitor')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                hardwareStationTab === 'gpio_monitor'
                  ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Activity className="ui-icon-sm" aria-hidden="true" />
              <span>Monitor Sygnałów GPIO & Zadawanie Stanów</span>
            </button>
          </div>

          <span className="text-xs font-mono text-slate-400 hidden sm:inline px-3">
            {hardwareStationTab === 'pinout'
              ? 'Wizualne przypisywanie pinów: I2C, SPI, PWM, ADC, Touch'
              : 'Wymuszanie sygnałów logicznych HIGH / LOW na żywo'}
          </span>
        </div>

        {/* Tab Content 1: Interactive Pinout Map */}
        {hardwareStationTab === 'pinout' && (
          <Esp32PinoutMap
            display={display}
            setDisplay={setDisplay}
            system={system}
            setSystem={setSystem}
          />
        )}

        {/* Tab Content 2: GPIO Signal Inspector */}
        {hardwareStationTab === 'gpio_monitor' && (
          <GpioPinInspector
            display={display}
            simState={simState}
            setSimState={setSimState}
            automations={automations}
            onTriggerAction={onTriggerAction}
          />
        )}
      </div>
    </div>
  );
};
