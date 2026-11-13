import React, { useState, useRef, useEffect } from 'react';
import { 
  Screen, 
  UIWidget, 
  WidgetType, 
  DisplayConfig, 
  WidgetFont, 
  PetMood, 
  PetEyeStyle,
  WidgetAnimationType,
  WidgetAnimationLoop,
  WidgetBinding,
  HardwareSimState
} from '../types';
import { 
  Plus, 
  Trash2, 
  Copy, 
  Eye, 
  Type, 
  Clock, 
  Gauge, 
  Activity, 
  CloudSun, 
  Cpu, 
  List, 
  Wifi, 
  Move, 
  Settings2,
  Sliders,
  Play,
  Pause,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  AlignCenter,
  Maximize2,
  Sparkles,
  Timer,
  Film,
  Zap,
  Sun,
  Thermometer,
  Radio,
  Cable,
  SlidersHorizontal,
  CheckCircle2,
  RadioTower,
  Bluetooth
} from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';

interface VisualEditorProps {
  screens: Screen[];
  setScreens: React.Dispatch<React.SetStateAction<Screen[]>>;
  display: DisplayConfig;
  activeScreenIndex: number;
  setActiveScreenIndex: (index: number) => void;
  simState?: HardwareSimState;
  setSimState?: React.Dispatch<React.SetStateAction<HardwareSimState>>;
}

interface DragState {
  type: 'move' | 'resize';
  widgetId: string;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  initialW: number;
  initialH: number;
}

export const VisualEditor: React.FC<VisualEditorProps> = ({
  screens,
  setScreens,
  display,
  activeScreenIndex,
  setActiveScreenIndex,
  simState,
  setSimState,
}) => {
  const { t } = useLocale();
  const currentScreen = screens[activeScreenIndex] || screens[0];
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(
    currentScreen?.widgets[0]?.id || null
  );
  const [gridSnap, setGridSnap] = useState<number>(2);

  // Drag and drop state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [activeDragCoords, setActiveDragCoords] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Animation timeline state
  const [isPlayingTimeline, setIsPlayingTimeline] = useState<boolean>(false);
  const [timelineTimeMs, setTimelineTimeMs] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showLiveSimDock, setShowLiveSimDock] = useState<boolean>(true);

  const animFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  // Selected widget
  const selectedWidget = currentScreen?.widgets.find(w => w.id === selectedWidgetId) || null;

  // Max duration of current screen's animation sequence
  const maxSequenceDurationMs = Math.max(
    2500,
    ...(currentScreen?.widgets || []).map(
      w => (w.animationDelayMs ?? 0) + (w.animationDurationMs ?? 500) + 400
    )
  );

  // Timeline playback loop
  useEffect(() => {
    if (!isPlayingTimeline) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      lastTimestampRef.current = null;
      return;
    }

    const step = (now: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = now;
      }
      const delta = (now - lastTimestampRef.current) * playbackSpeed;
      lastTimestampRef.current = now;

      setTimelineTimeMs(prev => {
        const next = prev + delta;
        if (next >= maxSequenceDurationMs) {
          return 0; // Smooth loop
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlayingTimeline, maxSequenceDurationMs, playbackSpeed]);

  // Helper: compute live sensor value for a widget
  const getWidgetLiveValue = (widget: UIWidget): { text: string; fillPercent: number; isHigh: boolean; rawVal: number | string | boolean } => {
    const binding = widget.binding || 'none';

    // Fallbacks if simState not provided
    const pir = simState?.pirActive ?? false;
    const lux = simState?.ambientLux ?? 450;
    const temp = simState?.temperature ?? 22.5;
    const hum = simState?.humidity ?? 55;
    const pot = simState?.potAdc ?? 2048;
    const boot = simState?.bootPressed ?? false;
    const userBtn = simState?.userBtn1Pressed ?? false;
    const enc = simState?.encoderVal ?? 12;
    const usb = simState?.usbConnected ?? false;
    const ble = simState?.bluetoothConnected ?? false;

    switch (binding) {
      case 'pirActive':
      case 'pir': {
        const activeText = widget.sensorActiveLabel || 'RUCH WYKRYTY!';
        const inactiveText = widget.sensorInactiveLabel || 'Brak ruchu';
        return {
          text: pir ? activeText : inactiveText,
          fillPercent: pir ? 100 : 0,
          isHigh: pir,
          rawVal: pir,
        };
      }
      case 'ambientLux':
      case 'lux': {
        const min = widget.minVal ?? 0;
        const max = widget.maxVal ?? 1000;
        const fill = Math.min(100, Math.max(0, ((lux - min) / (max - min)) * 100));
        return {
          text: `${lux} ${widget.unit || 'lx'}`,
          fillPercent: fill,
          isHigh: widget.sensorThreshold !== undefined ? lux >= widget.sensorThreshold : lux > 500,
          rawVal: lux,
        };
      }
      case 'temperature':
      case 'temp': {
        const min = widget.minVal ?? 0;
        const max = widget.maxVal ?? 50;
        const fill = Math.min(100, Math.max(0, ((temp - min) / (max - min)) * 100));
        return {
          text: `${temp.toFixed(1)} ${widget.unit || '°C'}`,
          fillPercent: fill,
          isHigh: temp > 28,
          rawVal: temp,
        };
      }
      case 'humidity': {
        return {
          text: `${hum} %`,
          fillPercent: hum,
          isHigh: hum > 70,
          rawVal: hum,
        };
      }
      case 'potAdc':
      case 'pot': {
        const min = widget.minVal ?? 0;
        const max = widget.maxVal ?? 4095;
        const fill = Math.min(100, Math.max(0, ((pot - min) / (max - min)) * 100));
        return {
          text: `ADC: ${pot}`,
          fillPercent: fill,
          isHigh: pot > 2048,
          rawVal: pot,
        };
      }
      case 'bootPressed': {
        return {
          text: boot ? 'BOOT: WCISK' : 'BOOT: OFF',
          fillPercent: boot ? 100 : 0,
          isHigh: boot,
          rawVal: boot,
        };
      }
      case 'userBtn1Pressed': {
        return {
          text: userBtn ? 'BTN1: ON' : 'BTN1: OFF',
          fillPercent: userBtn ? 100 : 0,
          isHigh: userBtn,
          rawVal: userBtn,
        };
      }
      case 'encoderVal': {
        return {
          text: `ENC: ${enc}`,
          fillPercent: (enc % 100),
          isHigh: false,
          rawVal: enc,
        };
      }
      case 'usbConnected': {
        return {
          text: usb ? (widget.sensorActiveLabel || 'USB: POLACZONO') : (widget.sensorInactiveLabel || 'USB: BRAK'),
          fillPercent: usb ? 100 : 0,
          isHigh: usb,
          rawVal: usb,
        };
      }
      case 'bluetoothConnected': {
        return {
          text: ble ? (widget.sensorActiveLabel || 'BLE: POLACZONO') : (widget.sensorInactiveLabel || 'BLE: BRAK'),
          fillPercent: ble ? 100 : 0,
          isHigh: ble,
          rawVal: ble,
        };
      }
      case 'cpu': {
        return {
          text: 'CPU: 45%',
          fillPercent: 45,
          isHigh: false,
          rawVal: 45,
        };
      }
      case 'ram': {
        return {
          text: 'RAM: 62%',
          fillPercent: 62,
          isHigh: false,
          rawVal: 62,
        };
      }
      case 'time': {
        return {
          text: simState?.simulatedTime || '12:34:56',
          fillPercent: 50,
          isHigh: false,
          rawVal: simState?.simulatedTime || '12:34:56',
        };
      }
      case 'date': {
        return {
          text: simState?.simulatedDate || '2026-11-11',
          fillPercent: 50,
          isHigh: false,
          rawVal: simState?.simulatedDate || '2026-11-11',
        };
      }
      default: {
        return {
          text: widget.label || 'Tekst',
          fillPercent: 50,
          isHigh: false,
          rawVal: widget.label || '',
        };
      }
    }
  };

  // Add a new widget to the active screen
  const handleAddWidget = (type: WidgetType) => {
    const existingCount = currentScreen?.widgets.length || 0;
    const nextOrder = existingCount + 1;

    let newWidget: UIWidget = {
      id: `w_${type}_${Date.now()}`,
      type,
      x: 4,
      y: 4,
      width: 40,
      height: 20,
      sequenceOrder: nextOrder,
      animationType: 'fade_in',
      animationDelayMs: (nextOrder - 1) * 250,
      animationDurationMs: 500,
      animationLoop: 'none',
      binding: 'none',
    };

    switch (type) {
      case 'cyber_pet':
        newWidget = {
          ...newWidget,
          x: 14,
          y: 12,
          width: 100,
          height: 40,
          petMood: 'neutral',
          petEyeStyle: 'robot_capsule',
          animationType: 'zoom_in',
          animationLoop: 'pulse',
        };
        break;
      case 'text':
        newWidget = {
          ...newWidget,
          width: 60,
          height: 12,
          label: 'Etykieta',
          font: 'u8g2_8x13',
          fontSize: 8,
          binding: 'none',
          animationType: 'typewriter',
        };
        break;
      case 'clock':
        newWidget = {
          ...newWidget,
          width: 56,
          height: 16,
          fontSize: 12,
          clockFormat: '24h',
          showSeconds: true,
          animationType: 'slide_down',
        };
        break;
      case 'gauge':
        newWidget = {
          ...newWidget,
          width: 50,
          height: 24,
          label: 'LDR Światło',
          binding: 'ambientLux',
          minVal: 0,
          maxVal: 1000,
          unit: 'lx',
          animationType: 'slide_up',
        };
        break;
      case 'progress_bar':
        newWidget = {
          ...newWidget,
          width: 60,
          height: 14,
          label: 'Czujnik LDR',
          binding: 'ambientLux',
          minVal: 0,
          maxVal: 1000,
          unit: 'lx',
          animationType: 'slide_up',
        };
        break;
      case 'sparkline':
        newWidget = {
          ...newWidget,
          width: 110,
          height: 24,
          label: 'Wykres',
          binding: 'cpu',
          historyPoints: 20,
          animationType: 'slide_up',
        };
        break;
      case 'weather':
        newWidget = {
          ...newWidget,
          width: 60,
          height: 28,
          animationType: 'slide_left',
        };
        break;
      case 'pc_monitor':
        newWidget = {
          ...newWidget,
          width: 110,
          height: 36,
          animationType: 'fade_in',
        };
        break;
      case 'menu':
        newWidget = {
          ...newWidget,
          width: 110,
          height: 50,
          menuTitle: 'Ustawienia',
          menuItems: ['1. WiFi', '2. Jasność', '3. Informacje'],
          selectedIndex: 0,
          animationType: 'slide_down',
        };
        break;
      case 'battery_wifi':
        newWidget = {
          ...newWidget,
          width: 32,
          height: 10,
          animationType: 'fade_in',
        };
        break;
    }

    setScreens(prev => {
      const updated = [...prev];
      const screen = updated[activeScreenIndex];
      if (screen) {
        screen.widgets = [...screen.widgets, newWidget];
      }
      return updated;
    });

    setSelectedWidgetId(newWidget.id);
  };

  // Update selected widget properties
  const updateSelectedWidget = (patch: Partial<UIWidget>) => {
    if (!selectedWidgetId) return;

    setScreens(prev => {
      const updated = [...prev];
      const screen = updated[activeScreenIndex];
      if (screen) {
        screen.widgets = screen.widgets.map(w => 
          w.id === selectedWidgetId ? { ...w, ...patch } : w
        );
      }
      return updated;
    });
  };

  // Delete selected widget
  const handleDeleteWidget = () => {
    if (!selectedWidgetId) return;
    setScreens(prev => {
      const updated = [...prev];
      const screen = updated[activeScreenIndex];
      if (screen) {
        screen.widgets = screen.widgets.filter(w => w.id !== selectedWidgetId);
      }
      return updated;
    });
    setSelectedWidgetId(null);
  };

  // Duplicate selected widget
  const handleDuplicateWidget = () => {
    if (!selectedWidget) return;
    const newWidget: UIWidget = {
      ...JSON.parse(JSON.stringify(selectedWidget)),
      id: `w_${selectedWidget.type}_${Date.now()}`,
      x: Math.min(display.width - selectedWidget.width, selectedWidget.x + 4),
      y: Math.min(display.height - selectedWidget.height, selectedWidget.y + 4),
      sequenceOrder: (currentScreen?.widgets.length || 0) + 1,
      animationDelayMs: (selectedWidget.animationDelayMs ?? 0) + 200,
    };

    setScreens(prev => {
      const updated = [...prev];
      const screen = updated[activeScreenIndex];
      if (screen) {
        screen.widgets = [...screen.widgets, newWidget];
      }
      return updated;
    });
    setSelectedWidgetId(newWidget.id);
  };

  // Add new screen
  const handleAddScreen = () => {
    const newScreen: Screen = {
      id: `screen_${Date.now()}`,
      name: `Ekran ${screens.length + 1}`,
      widgets: [],
      animationSequenceEnabled: true,
      screenTransition: 'fade',
    };
    setScreens(prev => [...prev, newScreen]);
    setActiveScreenIndex(screens.length);
  };

  // Duplicate current screen
  const handleDuplicateScreen = () => {
    const dup: Screen = {
      id: `screen_${Date.now()}`,
      name: `${currentScreen.name} (Kopia)`,
      widgets: JSON.parse(JSON.stringify(currentScreen.widgets)),
      animationSequenceEnabled: currentScreen.animationSequenceEnabled ?? true,
      screenTransition: currentScreen.screenTransition || 'fade',
    };
    setScreens(prev => [...prev, dup]);
    setActiveScreenIndex(screens.length);
  };

  // Delete current screen
  const handleDeleteScreen = () => {
    if (screens.length <= 1) return;
    setScreens(prev => prev.filter((_, i) => i !== activeScreenIndex));
    setActiveScreenIndex(Math.max(0, activeScreenIndex - 1));
  };

  // Re-sequence timing automatically
  const handleAutoStaggerTiming = () => {
    setScreens(prev => {
      const updated = [...prev];
      const screen = updated[activeScreenIndex];
      if (screen) {
        const sorted = [...screen.widgets].sort((a, b) => (a.sequenceOrder ?? 1) - (b.sequenceOrder ?? 1));
        const newWidgets = sorted.map((w, idx) => ({
          ...w,
          sequenceOrder: idx + 1,
          animationDelayMs: idx * 250,
          animationDurationMs: w.animationDurationMs || 500,
        }));
        screen.widgets = newWidgets;
      }
      return updated;
    });
    setTimelineTimeMs(0);
    setIsPlayingTimeline(true);
  };

  // Move sequence order up or down
  const handleMoveSequenceOrder = (widgetId: string, direction: 'up' | 'down') => {
    setScreens(prev => {
      const updated = [...prev];
      const screen = updated[activeScreenIndex];
      if (!screen) return updated;

      const sorted = [...screen.widgets].sort((a, b) => (a.sequenceOrder ?? 1) - (b.sequenceOrder ?? 1));
      const idx = sorted.findIndex(w => w.id === widgetId);
      if (idx === -1) return updated;

      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= sorted.length) return updated;

      const tempOrder = sorted[idx].sequenceOrder ?? (idx + 1);
      sorted[idx].sequenceOrder = sorted[targetIdx].sequenceOrder ?? (targetIdx + 1);
      sorted[targetIdx].sequenceOrder = tempOrder;

      const tempDelay = sorted[idx].animationDelayMs ?? 0;
      sorted[idx].animationDelayMs = sorted[targetIdx].animationDelayMs ?? 0;
      sorted[targetIdx].animationDelayMs = tempDelay;

      screen.widgets = sorted;
      return updated;
    });
  };

  // Scale ratio for editor canvas
  const scale = 3.2;

  // Pointer Drag Handlers
  const handlePointerDown = (e: React.PointerEvent, widget: UIWidget, isResize = false) => {
    e.stopPropagation();
    setSelectedWidgetId(widget.id);

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    setDragState({
      type: isResize ? 'resize' : 'move',
      widgetId: widget.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: widget.x,
      initialY: widget.y,
      initialW: widget.width,
      initialH: widget.height,
    });

    setActiveDragCoords({
      x: widget.x,
      y: widget.y,
      w: widget.width,
      h: widget.height,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return;

    const deltaX = (e.clientX - dragState.startX) / scale;
    const deltaY = (e.clientY - dragState.startY) / scale;

    if (dragState.type === 'move') {
      const rawX = dragState.initialX + deltaX;
      const rawY = dragState.initialY + deltaY;

      const snappedX = Math.round(rawX / gridSnap) * gridSnap;
      const snappedY = Math.round(rawY / gridSnap) * gridSnap;

      const clampedX = Math.max(0, Math.min(snappedX, display.width - dragState.initialW));
      const clampedY = Math.max(0, Math.min(snappedY, display.height - dragState.initialH));

      setActiveDragCoords({
        x: clampedX,
        y: clampedY,
        w: dragState.initialW,
        h: dragState.initialH,
      });

      updateSelectedWidget({ x: clampedX, y: clampedY });
    } else if (dragState.type === 'resize') {
      const rawW = dragState.initialW + deltaX;
      const rawH = dragState.initialH + deltaY;

      const snappedW = Math.round(rawW / gridSnap) * gridSnap;
      const snappedH = Math.round(rawH / gridSnap) * gridSnap;

      const clampedW = Math.max(8, Math.min(snappedW, display.width - dragState.initialX));
      const clampedH = Math.max(8, Math.min(snappedH, display.height - dragState.initialY));

      setActiveDragCoords({
        x: dragState.initialX,
        y: dragState.initialY,
        w: clampedW,
        h: clampedH,
      });

      updateSelectedWidget({ width: clampedW, height: clampedH });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragState) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture lost
      }
      setDragState(null);
      setActiveDragCoords(null);
    }
  };

  // Keyboard nudge handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedWidget) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const step = e.shiftKey ? 1 : gridSnap;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        updateSelectedWidget({ x: Math.max(0, selectedWidget.x - step) });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        updateSelectedWidget({ x: Math.min(display.width - selectedWidget.width, selectedWidget.x + step) });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        updateSelectedWidget({ y: Math.max(0, selectedWidget.y - step) });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        updateSelectedWidget({ y: Math.min(display.height - selectedWidget.height, selectedWidget.y + step) });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteWidget();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWidget, gridSnap, display.width, display.height]);

  // Compute live animation preview style for a widget
  const getWidgetAnimationStyle = (widget: UIWidget) => {
    if (!isPlayingTimeline && timelineTimeMs === 0) {
      return { opacity: 1, transform: 'none', isHidden: false, charSlice: undefined };
    }

    const delay = widget.animationDelayMs ?? 0;
    const duration = widget.animationDurationMs ?? 500;
    const animType = widget.animationType ?? 'fade_in';
    const elapsed = timelineTimeMs - delay;

    if (elapsed < 0) {
      return {
        opacity: isPlayingTimeline ? 0 : 0.2,
        transform: 'none',
        isHidden: isPlayingTimeline,
        charSlice: 0,
      };
    }

    if (elapsed >= duration) {
      return { opacity: 1, transform: 'none', isHidden: false, charSlice: undefined };
    }

    const p = Math.min(1, Math.max(0, elapsed / duration));
    const ease = 1 - Math.pow(1 - p, 3);

    switch (animType) {
      case 'fade_in':
        return { opacity: ease, transform: 'none', isHidden: false };
      case 'slide_left':
        return { opacity: ease, transform: `translateX(${(1 - ease) * -35}px)`, isHidden: false };
      case 'slide_right':
        return { opacity: ease, transform: `translateX(${(1 - ease) * 35}px)`, isHidden: false };
      case 'slide_up':
        return { opacity: ease, transform: `translateY(${(1 - ease) * 25}px)`, isHidden: false };
      case 'slide_down':
        return { opacity: ease, transform: `translateY(${(1 - ease) * -25}px)`, isHidden: false };
      case 'zoom_in':
        return { opacity: ease, transform: `scale(${0.3 + 0.7 * ease})`, isHidden: false };
      case 'typewriter':
        return {
          opacity: 1,
          transform: 'none',
          isHidden: false,
          charSlice: Math.ceil(p * (widget.label?.length || 10)),
        };
      default:
        return { opacity: 1, transform: 'none', isHidden: false };
    }
  };

  // Alignment helpers
  const handleAlign = (alignment: 'centerX' | 'centerY') => {
    if (!selectedWidget) return;

    if (alignment === 'centerX') {
      updateSelectedWidget({
        x: Math.round(((display.width - selectedWidget.width) / 2) / gridSnap) * gridSnap,
      });
    } else if (alignment === 'centerY') {
      updateSelectedWidget({
        y: Math.round(((display.height - selectedWidget.height) / 2) / gridSnap) * gridSnap,
      });
    }
  };

  // Sorted widgets by sequence order for timeline view
  const sortedWidgets = [...(currentScreen?.widgets || [])].sort(
    (a, b) => (a.sequenceOrder ?? 1) - (b.sequenceOrder ?? 1)
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Screen Manager Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-sm">
        {/* Screen Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500 font-mono mr-2">Ekrany:</span>
          {screens.map((screen, idx) => (
            <button
              key={screen.id}
              onClick={() => {
                setActiveScreenIndex(idx);
                setSelectedWidgetId(screen.widgets[0]?.id || null);
                setTimelineTimeMs(0);
                setIsPlayingTimeline(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeScreenIndex === idx
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              {screen.name}
            </button>
          ))}
          <button
            onClick={handleAddScreen}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
            title="Dodaj nowy pusty ekran"
           aria-label="Dodaj nowy pusty ekran">
            <Plus className="ui-icon-sm" aria-hidden="true" />
            <span>{t('editor.newScreen')}</span>
          </button>
        </div>

        {/* Screen Actions & Live Sim Dock Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLiveSimDock(!showLiveSimDock)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors border ${
              showLiveSimDock 
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60 font-semibold' 
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="Pokaż/ukryj podręczny panel symulatora czujników"
          >
            <SlidersHorizontal className="ui-icon-sm text-cyan-400" aria-hidden="true" />
            <span>{t('editor.liveTelemetry')} {showLiveSimDock ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={handleDuplicateScreen}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
            title="Duplikuj obecny ekran"
           aria-label="Duplikuj obecny ekran">
            <Copy className="ui-icon-sm" aria-hidden="true" />
            <span className="hidden sm:inline">{t('editor.clone')}</span>
          </button>
          {screens.length > 1 && (
            <button
              onClick={handleDeleteScreen}
              className="p-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 rounded-lg text-xs transition-colors"
              title="Usuń obecny ekran"
             aria-label="Usuń obecny ekran">
              <Trash2 className="ui-icon-sm" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Mini Live Simulator Dock (Interactive Quick Sensor Tweaker) */}
      {showLiveSimDock && simState && setSimState && (
        <div className="p-3 bg-slate-900/90 border border-cyan-800/40 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs font-mono shadow-md">
          <div className="flex items-center gap-2">
            <RadioTower className="ui-icon-sm text-cyan-400 animate-pulse" aria-hidden="true" />
            <span className="text-slate-200 font-bold">Podręczna Telemetria Symulatora:</span>
            <span className="ui-type-micro text-slate-400 hidden sm:inline">(Zmień wartość, aby sprawdzić reakcję elementów graficznych na żywo)</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* PIR Toggle */}
            <button
              onClick={() => setSimState(prev => ({ ...prev, pirActive: !prev.pirActive }))}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all text-xs ${
                simState.pirActive
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              <Zap className="ui-icon-sm text-rose-400 shrink-0" aria-hidden="true" />
              <span>PIR (GPIO 14): {simState.pirActive ? 'RUCH' : 'Cisza'}</span>
            </button>

            {/* Ambient Lux Slider */}
            <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs">
              <Sun className="ui-icon-sm text-amber-400 shrink-0" aria-hidden="true" />
              <span className="text-slate-400">LDR:</span>
              <span className="text-amber-300 font-bold w-12">{simState.ambientLux} lx</span>
              <input
                type="range"
                min="0"
                max="1000"
                step="25"
                value={simState.ambientLux}
                onChange={e => {
                  const val = Number(e.target.value);
                  setSimState(prev => ({ ...prev, ambientLux: val }));
                }}
                className="w-20 accent-amber-400 cursor-pointer"
              />
            </div>

            {/* Temperature Slider */}
            <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs">
              <Thermometer className="ui-icon-sm text-cyan-400 shrink-0" aria-hidden="true" />
              <span className="text-slate-400">DHT:</span>
              <span className="text-cyan-300 font-bold w-12">{simState.temperature.toFixed(1)}°C</span>
              <input
                type="range"
                min="0"
                max="45"
                step="0.5"
                value={simState.temperature}
                onChange={e => {
                  const val = Number(e.target.value);
                  setSimState(prev => ({ ...prev, temperature: val }));
                }}
                className="w-20 accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Potentiometer ADC */}
            <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400">POT:</span>
              <span className="text-emerald-300 font-bold w-12">{simState.potAdc}</span>
              <input
                type="range"
                min="0"
                max="4095"
                step="100"
                value={simState.potAdc}
                onChange={e => {
                  const val = Number(e.target.value);
                  setSimState(prev => ({ ...prev, potAdc: val }));
                }}
                className="w-20 accent-emerald-400 cursor-pointer"
              />
            </div>

            {/* USB-C Cable Toggle */}
            <button
              onClick={() => setSimState(prev => ({ ...prev, usbConnected: !prev.usbConnected }))}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all text-xs ${
                simState.usbConnected
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60'
                  : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}
            >
              <Cable className="ui-icon-sm text-cyan-400 shrink-0" aria-hidden="true" />
              <span>USB-C: {simState.usbConnected ? 'WPIĘTY' : 'ODŁĄCZONY'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main 3-Column Layout: Toolbox | Canvas Stage & Timeline | Property Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Widget Toolbox (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
              {t('editor.palette')}
            </h3>
            <span className="ui-type-micro text-slate-500">{t('editor.paletteHint')}</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => handleAddWidget('cyber_pet')}
              className="flex items-center gap-3 p-2.5 bg-slate-950 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-700/60 rounded-xl text-left transition-all group"
            >
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20">
                <Eye className="ui-icon-sm" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-200">Cyber-Zwierzak (Oczy)</div>
                <div className="ui-type-micro text-slate-400">Reaguje na ruch PIR i czujniki światła</div>
              </div>
            </button>

            <button
              onClick={() => handleAddWidget('text')}
              className="flex items-center gap-3 p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-all group"
            >
              <div className="p-2 rounded-lg bg-slate-800 text-slate-300 group-hover:text-white">
                <Type className="ui-icon-sm" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-200">Tekst / Czujnik Live</div>
                <div className="ui-type-micro text-slate-400">Bindowanie z pirActive, lux, temp, pot</div>
              </div>
            </button>

            <button
              onClick={() => handleAddWidget('clock')}
              className="flex items-center gap-3 p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-all group"
            >
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Clock className="ui-icon-sm" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-200">Zegar NTP & Data</div>
                <div className="ui-type-micro text-slate-400">Czas rzeczywisty z symulatora</div>
              </div>
            </button>

            <button
              onClick={() => handleAddWidget('gauge')}
              className="flex items-center gap-3 p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-all group"
            >
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Gauge className="ui-icon-sm" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-200">Wskaźnik / Gauge</div>
                <div className="ui-type-micro text-slate-400">Wizualizuje LDR, ADC lub Temperaturę</div>
              </div>
            </button>

            <button
              onClick={() => handleAddWidget('progress_bar')}
              className="flex items-center gap-3 p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-all group"
            >
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                <Activity className="ui-icon-sm" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-200">Pasek Postępu Czujnika</div>
                <div className="ui-type-micro text-slate-400">Horyzontalne wypełnienie analogowe</div>
              </div>
            </button>

            <button
              onClick={() => handleAddWidget('sparkline')}
              className="flex items-center gap-3 p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-all group"
            >
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                <Activity className="ui-icon-sm" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-200">Wykres Liniowy</div>
                <div className="ui-type-micro text-slate-400">Historia pomiarów czujnika</div>
              </div>
            </button>

            <button
              onClick={() => handleAddWidget('weather')}
              className="flex items-center gap-3 p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-all group"
            >
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <CloudSun className="ui-icon-sm" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-200">Widget Pogody</div>
                <div className="ui-type-micro text-slate-400">Prognoza z ikoną i temperaturą</div>
              </div>
            </button>

            <button
              onClick={() => handleAddWidget('pc_monitor')}
              className="flex items-center gap-3 p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-all group"
            >
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                <Cpu className="ui-icon-sm" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-200">Monitor Zasobów PC</div>
                <div className="ui-type-micro text-slate-400">CPU, RAM, GPU i Dysk na żywo</div>
              </div>
            </button>

            <button
              onClick={() => handleAddWidget('menu')}
              className="flex items-center gap-3 p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-all group"
            >
              <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
                <List className="ui-icon-sm" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-200">Menu Nawigacyjne</div>
                <div className="ui-type-micro text-slate-400">Lista pozycji dla przycisków lub enkodera</div>
              </div>
            </button>

            <button
              onClick={() => handleAddWidget('battery_wifi')}
              className="flex items-center gap-3 p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-all group"
            >
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Wifi className="ui-icon-sm" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-200">Status WiFi & Baterii</div>
                <div className="ui-type-micro text-slate-400">Pasek baterii i ikona zasięgu</div>
              </div>
            </button>
          </div>
        </div>

        {/* Center Column: Interactive Canvas Stage & Animation Sequencer (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {/* Canvas Box */}
          <div className="flex flex-col items-center p-5 bg-slate-900 border border-slate-800 rounded-2xl relative shadow-xl">
            {/* Stage Controls Strip */}
            <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-4 pb-2 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-200">{currentScreen?.name}</span>
                <span className="text-slate-500 font-mono">({display.width}x{display.height} px)</span>
              </div>
              
              {/* Quick Actions & Snap */}
              <div className="flex items-center gap-3">
                {selectedWidget && (
                  <div className="hidden sm:flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button
                      onClick={() => handleAlign('centerX')}
                      className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-cyan-400 font-mono transition-colors"
                      title="Wyśrodkuj w poziomie (Center X)"
                    >
                      <AlignCenter className="ui-icon-sm" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => handleAlign('centerY')}
                      className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-cyan-400 font-mono transition-colors"
                      title="Wyśrodkuj w pionie (Center Y)"
                    >
                      <Maximize2 className="ui-icon-sm rotate-45" aria-hidden="true" />
                    </button>
                    <div className="w-px h-3 bg-slate-800 mx-0.5" />
                    <button
                      onClick={handleDuplicateWidget}
                      className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
                      title="Duplikuj element"
                     aria-label="Duplikuj element">
                      <Copy className="ui-icon-sm" aria-hidden="true" />
                    </button>
                    <button
                      onClick={handleDeleteWidget}
                      className="p-1.5 hover:bg-rose-950/60 rounded text-slate-400 hover:text-rose-400 transition-colors"
                      title="Usuń element"
                     aria-label="Usuń element">
                      <Trash2 className="ui-icon-sm" aria-hidden="true" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 ui-type-micro">Siatka:</span>
                  <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded border border-slate-800 ui-type-micro font-mono">
                    {[1, 2, 4, 8].map(s => (
                      <button
                        key={s}
                        onClick={() => setGridSnap(s)}
                        className={`px-1.5 py-0.5 rounded ${gridSnap === s ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                      >
                        {s}px
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Screen Canvas Container */}
            <div 
              className="p-4 bg-slate-950 border-2 border-slate-800 rounded-xl shadow-2xl relative flex items-center justify-center select-none"
              style={{ minHeight: display.height * scale + 48 }}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {/* The Pixel Viewport */}
              <div
                className="relative bg-black rounded border border-cyan-500/30 overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                style={{
                  width: display.width * scale,
                  height: display.height * scale,
                }}
                onClick={() => setSelectedWidgetId(null)}
              >
                {/* Background Grid Mesh */}
                <div 
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage: `linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)`,
                    backgroundSize: `${gridSnap * scale}px ${gridSnap * scale}px`,
                  }}
                />

                {/* Alignment Crosshair Guide Lines when Dragging */}
                {activeDragCoords && (
                  <>
                    <div 
                      className="absolute top-0 bottom-0 border-l border-cyan-400/60 pointer-events-none z-30"
                      style={{ left: activeDragCoords.x * scale }}
                    />
                    <div 
                      className="absolute top-0 bottom-0 border-r border-cyan-400/60 pointer-events-none z-30"
                      style={{ left: (activeDragCoords.x + activeDragCoords.w) * scale }}
                    />
                    <div 
                      className="absolute left-0 right-0 border-t border-cyan-400/60 pointer-events-none z-30"
                      style={{ top: activeDragCoords.y * scale }}
                    />
                    <div 
                      className="absolute left-0 right-0 border-b border-cyan-400/60 pointer-events-none z-30"
                      style={{ top: (activeDragCoords.y + activeDragCoords.h) * scale }}
                    />
                  </>
                )}

                {/* Render Draggable / Selectable / Animated Widgets with Real-Time Sensor Data */}
                {currentScreen?.widgets.map(w => {
                  const isSelected = w.id === selectedWidgetId;
                  const isDraggingThis = dragState?.widgetId === w.id;
                  const anim = getWidgetAnimationStyle(w);
                  const sensorData = getWidgetLiveValue(w);

                  return (
                    <div
                      key={w.id}
                      onPointerDown={(e) => handlePointerDown(e, w, false)}
                      style={{
                        left: w.x * scale,
                        top: w.y * scale,
                        width: w.width * scale,
                        height: w.height * scale,
                        opacity: isDraggingThis ? 0.9 : anim.opacity,
                        transform: isDraggingThis ? 'none' : anim.transform,
                        transition: isDraggingThis ? 'none' : 'opacity 0.05s linear, transform 0.05s ease-out',
                      }}
                      className={`absolute select-none cursor-move rounded-sm flex flex-col justify-center ${
                        isSelected
                          ? 'border-2 border-cyan-400 bg-cyan-500/20 shadow-[0_0_14px_#06b6d4] z-20 ring-1 ring-cyan-300'
                          : 'border border-dashed border-cyan-500/40 hover:border-cyan-400/80 bg-cyan-950/20 z-10'
                      }`}
                    >
                      {/* Widget Content Preview with Live Sensor Visualization */}
                      <div className="w-full h-full p-1 overflow-hidden pointer-events-none text-cyan-300 font-mono ui-type-micro">
                        {w.type === 'cyber_pet' && (
                          <div className="flex items-center justify-around h-full">
                            <div className={`w-1/3 h-3/4 rounded-full flex items-center justify-center transition-all ${
                              simState?.pirActive ? 'bg-rose-400 scale-110 shadow-[0_0_8px_#f43f5e]' : 'bg-cyan-400'
                            }`}>
                              <div className="w-1.5 h-1.5 bg-black rounded-full" />
                            </div>
                            <div className={`w-1/3 h-3/4 rounded-full flex items-center justify-center transition-all ${
                              simState?.pirActive ? 'bg-rose-400 scale-110 shadow-[0_0_8px_#f43f5e]' : 'bg-cyan-400'
                            }`}>
                              <div className="w-1.5 h-1.5 bg-black rounded-full" />
                            </div>
                          </div>
                        )}

                        {w.type === 'text' && (
                          <div className="leading-none font-medium truncate flex items-center gap-1">
                            {w.binding !== 'none' && (
                              <span className={`w-1.5 h-1.5 rounded-full inline-block ${sensorData.isHigh ? 'bg-rose-400 animate-pulse' : 'bg-cyan-400'}`} />
                            )}
                            <span>
                              {anim.charSlice !== undefined 
                                ? sensorData.text.slice(0, anim.charSlice)
                                : sensorData.text}
                            </span>
                          </div>
                        )}

                        {w.type === 'clock' && (
                          <div className="font-bold ui-type-micro leading-tight">
                            {simState?.simulatedTime || '12:34:56'}
                          </div>
                        )}

                        {w.type === 'gauge' && (
                          <div className="border border-cyan-400 h-full rounded p-0.5 flex items-center justify-between ui-type-micro bg-slate-950/60">
                            <span className="truncate max-w-[60%]">{w.label || w.binding || 'GAUGE'}</span>
                            <span className="font-bold text-cyan-200">{sensorData.text}</span>
                          </div>
                        )}

                        {w.type === 'progress_bar' && (
                          <div className="border border-cyan-400 h-full p-0.5 bg-slate-950/60 flex flex-col justify-between">
                            <div className="flex justify-between items-center text-[7px] leading-none mb-0.5">
                              <span className="truncate">{w.label || w.binding || 'Pasek'}</span>
                              <span>{sensorData.text}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-900 rounded-sm overflow-hidden border border-cyan-900">
                              <div 
                                className={`h-full transition-all duration-150 ${sensorData.isHigh ? 'bg-rose-400' : 'bg-cyan-400'}`}
                                style={{ width: `${sensorData.fillPercent}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {w.type === 'sparkline' && (
                          <div className="border border-cyan-400/70 h-full flex items-end p-0.5 gap-0.5 bg-slate-950/40">
                            <div className="flex-1 bg-cyan-400" style={{ height: `${Math.max(15, (sensorData.fillPercent * 0.4))}%` }} />
                            <div className="flex-1 bg-cyan-400" style={{ height: `${Math.max(25, (sensorData.fillPercent * 0.7))}%` }} />
                            <div className="flex-1 bg-cyan-400" style={{ height: `${Math.max(10, (sensorData.fillPercent * 0.5))}%` }} />
                            <div className="flex-1 bg-cyan-400" style={{ height: `${sensorData.fillPercent}%` }} />
                          </div>
                        )}

                        {w.type === 'weather' && (
                          <div className="flex items-center gap-1">
                            <span className="ui-type-micro">☀️</span>
                            <span>{simState ? `${simState.temperature.toFixed(1)}°C` : '18.5°C'}</span>
                          </div>
                        )}

                        {w.type === 'pc_monitor' && (
                          <div className="ui-type-micro leading-tight">
                            <div>CPU: 42% RAM: 68%</div>
                            <div>GPU: 35% DYSK: 64%</div>
                          </div>
                        )}

                        {w.type === 'menu' && (
                          <div className="ui-type-micro leading-tight">
                            <div className="font-bold underline">{w.menuTitle}</div>
                            <div>&gt; 1. WiFi</div>
                            <div>&nbsp;&nbsp;2. Jasność</div>
                          </div>
                        )}

                        {w.type === 'battery_wifi' && (
                          <div className="flex items-center gap-1 ui-type-micro">
                            <span>[85%]</span>
                            <span>WiFi</span>
                          </div>
                        )}
                      </div>

                      {/* Sensor Binding Pin Badge */}
                      {w.binding && w.binding !== 'none' && (
                        <div className="absolute bottom-0.5 right-0.5 px-1 bg-slate-950/90 border border-emerald-500/60 text-[7px] font-mono text-emerald-300 font-bold rounded pointer-events-none flex items-center gap-0.5">
                          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
                          <span>{w.binding}</span>
                        </div>
                      )}

                      {/* Sequence Order Badge */}
                      <div className="absolute top-0.5 left-0.5 px-1 bg-slate-900/90 border border-cyan-500/60 ui-type-micro font-mono text-cyan-300 font-bold rounded pointer-events-none">
                        #{w.sequenceOrder ?? 1}
                      </div>

                      {/* Coordinate indicator when selected or dragged */}
                      {isSelected && (
                        <div className="absolute -top-6 left-0 px-1.5 py-0.5 bg-cyan-400 text-slate-950 font-mono ui-type-micro font-bold rounded shadow-md pointer-events-none whitespace-nowrap z-30">
                          X:{w.x} Y:{w.y} ({w.width}x{w.height})
                        </div>
                      )}

                      {/* Corner Resize Handle */}
                      {isSelected && (
                        <div
                          onPointerDown={(e) => handlePointerDown(e, w, true)}
                          className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-cyan-400 border border-slate-950 rounded-sm cursor-nwse-resize z-30 shadow flex items-center justify-center hover:scale-125 transition-transform"
                          title="Przeciągnij, aby zmienić rozmiar"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Instruction strip */}
            <div className="mt-3 ui-type-micro font-mono text-slate-400 flex flex-wrap items-center justify-between w-full px-2">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400">●</span>
                <span>Przeciągaj elementy myszką po ekranie (snap {gridSnap}px)</span>
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                <span>Strzałki: precyzyjne przesuwanie</span>
                <span>·</span>
                <span>Del: usuwanie</span>
              </div>
            </div>
          </div>

          {/* Animation Timeline & Sequencer Panel */}
          <div className="flex flex-col gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
            {/* Timeline Control Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Film className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                  Oś Czasu i Sekwencja Animacji
                </h3>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlayingTimeline(!isPlayingTimeline)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isPlayingTimeline
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md'
                  }`}
                >
                  {isPlayingTimeline ? <Pause className="ui-icon-sm fill-current" aria-hidden="true" /> : <Play className="ui-icon-sm fill-current" aria-hidden="true" />}
                  <span>{isPlayingTimeline ? 'Pauza' : 'Odtwórz animację'}</span>
                </button>

                <button
                  onClick={() => {
                    setTimelineTimeMs(0);
                    setIsPlayingTimeline(false);
                  }}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
                  title="Od początku (Reset czasu)"
                >
                  <RotateCcw className="ui-icon-sm" aria-hidden="true" />
                </button>

                <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 ui-type-micro font-mono">
                  {[0.5, 1, 2].map(speed => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`px-1.5 py-0.5 rounded ${playbackSpeed === speed ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400'}`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleAutoStaggerTiming}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/50 rounded-lg text-xs transition-colors font-medium"
                  title="Automatycznie ustaw opóźnienia krok po kroku (+250ms)"
                 aria-label="Automatycznie ustaw opóźnienia krok po kroku (+250ms)">
                  <Sparkles className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                  <span className="hidden sm:inline">Kaskada +250ms</span>
                </button>
              </div>
            </div>

            {/* Scrubber & Time Indicator */}
            <div className="flex flex-col gap-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <Timer className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                  <span className="text-slate-300">Aktualny czas odtworzenia:</span>
                  <span className="text-cyan-400 font-bold">{(timelineTimeMs / 1000).toFixed(2)}s</span>
                </div>
                <span className="text-slate-500">Całość sekwencji: {(maxSequenceDurationMs / 1000).toFixed(2)}s</span>
              </div>

              {/* Scrubber Slider */}
              <input
                type="range"
                min="0"
                max={maxSequenceDurationMs}
                step="20"
                value={timelineTimeMs}
                onChange={e => {
                  setTimelineTimeMs(Number(e.target.value));
                  setIsPlayingTimeline(false);
                }}
                className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />

              {/* Millisecond ticks */}
              <div className="flex justify-between ui-type-micro font-mono text-slate-500 px-0.5">
                <span>0.0s (Start)</span>
                <span>0.5s</span>
                <span>1.0s</span>
                <span>1.5s</span>
                <span>2.0s</span>
                <span>{(maxSequenceDurationMs / 1000).toFixed(1)}s</span>
              </div>
            </div>

            {/* Gantt-style Sequencer Track for each widget */}
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {sortedWidgets.map((widget) => {
                const isSelected = widget.id === selectedWidgetId;
                const delay = widget.animationDelayMs ?? 0;
                const duration = widget.animationDurationMs ?? 500;
                const end = delay + duration;
                const leftPercent = Math.min(100, (delay / maxSequenceDurationMs) * 100);
                const widthPercent = Math.min(100 - leftPercent, (duration / maxSequenceDurationMs) * 100);

                return (
                  <div
                    key={widget.id}
                    onClick={() => setSelectedWidgetId(widget.id)}
                    className={`flex flex-col gap-1.5 p-2 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/70 shadow-sm'
                        : 'bg-slate-950/70 hover:bg-slate-950 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-slate-800 text-cyan-400 font-mono font-bold ui-type-micro rounded">
                          #{widget.sequenceOrder ?? 1}
                        </span>
                        <span className="font-medium text-slate-200 truncate max-w-[130px]">
                          {widget.label || widget.type}
                        </span>
                        {widget.binding && widget.binding !== 'none' && (
                          <span className="ui-type-micro font-mono text-emerald-400 bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-800/60">
                            {widget.binding}
                          </span>
                        )}
                        <span className="ui-type-micro font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          {widget.animationType || 'fade_in'}
                        </span>
                      </div>

                      {/* Reorder and Timing pills */}
                      <div className="flex items-center gap-2">
                        <span className="ui-type-micro font-mono text-slate-400">
                          {delay}ms → {end}ms
                        </span>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleMoveSequenceOrder(widget.id, 'up')}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-cyan-400"
                            title="Przesuń wyżej w kolejności"
                          >
                            <ArrowUp className="ui-icon-sm" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => handleMoveSequenceOrder(widget.id, 'down')}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-cyan-400"
                            title="Przesuń niżej w kolejności"
                          >
                            <ArrowDown className="ui-icon-sm" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Bar Track */}
                    <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden relative border border-slate-800">
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                        style={{ left: `${Math.min(100, (timelineTimeMs / maxSequenceDurationMs) * 100)}%` }}
                      />
                      <div 
                        className={`absolute top-0 bottom-0 rounded-full ${
                          isSelected ? 'bg-cyan-400 shadow-[0_0_8px_#06b6d4]' : 'bg-cyan-600'
                        }`}
                        style={{
                          left: `${leftPercent}%`,
                          width: `${Math.max(4, widthPercent)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Property Inspector (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
              <Settings2 className="ui-icon-sm text-cyan-400" aria-hidden="true" />
              Właściwości Elementu
            </h3>
            {selectedWidget && (
              <button
                onClick={handleDeleteWidget}
                className="p-1.5 hover:bg-rose-950/60 rounded text-rose-400 hover:text-rose-200 transition-colors"
                title="Usuń ten element"
               aria-label="Usuń ten element">
                <Trash2 className="ui-icon-sm" aria-hidden="true" />
              </button>
            )}
          </div>

          {selectedWidget ? (
            <div className="flex flex-col gap-4 text-xs">
              {/* Type Badge */}
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800 font-mono ui-type-micro">
                <span className="text-slate-400">Typ:</span>
                <span className="text-cyan-400 font-bold uppercase">{selectedWidget.type}</span>
              </div>

              {/* Coordinates Steppers */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1 p-2 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="ui-type-micro font-mono text-slate-400">Pozycja X (px)</span>
                  <input
                    type="number"
                    value={selectedWidget.x}
                    min={0}
                    max={display.width - selectedWidget.width}
                    step={gridSnap}
                    onChange={e => updateSelectedWidget({ x: Math.max(0, Number(e.target.value)) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-cyan-300 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1 p-2 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="ui-type-micro font-mono text-slate-400">Pozycja Y (px)</span>
                  <input
                    type="number"
                    value={selectedWidget.y}
                    min={0}
                    max={display.height - selectedWidget.height}
                    step={gridSnap}
                    onChange={e => updateSelectedWidget({ y: Math.max(0, Number(e.target.value)) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-cyan-300 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1 p-2 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="ui-type-micro font-mono text-slate-400">Szerokość W (px)</span>
                  <input
                    type="number"
                    value={selectedWidget.width}
                    min={6}
                    max={display.width}
                    step={gridSnap}
                    onChange={e => updateSelectedWidget({ width: Math.max(6, Number(e.target.value)) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-cyan-300 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1 p-2 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="ui-type-micro font-mono text-slate-400">Wysokość H (px)</span>
                  <input
                    type="number"
                    value={selectedWidget.height}
                    min={6}
                    max={display.height}
                    step={gridSnap}
                    onChange={e => updateSelectedWidget({ height: Math.max(6, Number(e.target.value)) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-cyan-300 text-xs"
                  />
                </div>
              </div>

              {/* SECTION: PRZYPISANIE CZUJNIKÓW SPRZĘTOWYCH ESP32 (HARDWARE SENSORS BINDING) */}
              <div className="flex flex-col gap-3 p-3 bg-slate-950 rounded-xl border border-emerald-800/50 shadow-inner">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs font-mono">
                    <Radio className="ui-icon-sm text-emerald-400" aria-hidden="true" />
                    <span>Czujnik Sprzętowy ESP32</span>
                  </div>
                  {selectedWidget.binding && selectedWidget.binding !== 'none' ? (
                    <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 text-xs font-mono rounded font-bold">
                      POŁĄCZONY
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-900 text-slate-500 border border-slate-800 text-xs font-mono rounded">
                      Statyczny
                    </span>
                  )}
                </div>

                {/* Sensor Selector Dropdown */}
                <div>
                  <label className="ui-type-micro text-slate-400">Przypisz czujnik lub wejście do tego elementu:</label>
                  <select
                    value={selectedWidget.binding || 'none'}
                    onChange={e => {
                      const newBinding = e.target.value as WidgetBinding;
                      let extraPatch: Partial<UIWidget> = { binding: newBinding };
                      if (newBinding === 'pirActive') {
                        extraPatch = { ...extraPatch, label: 'RUCH PIR', sensorActiveLabel: 'RUCH WYKRYTY!', sensorInactiveLabel: 'Cisza (brak ruchu)' };
                      } else if (newBinding === 'ambientLux') {
                        extraPatch = { ...extraPatch, label: 'Światło LDR', minVal: 0, maxVal: 1000, unit: 'lx' };
                      } else if (newBinding === 'temperature') {
                        extraPatch = { ...extraPatch, label: 'Temp DHT', minVal: 0, maxVal: 50, unit: '°C' };
                      } else if (newBinding === 'potAdc') {
                        extraPatch = { ...extraPatch, label: 'Potencjometr', minVal: 0, maxVal: 4095, unit: 'ADC' };
                      }
                      updateSelectedWidget(extraPatch);
                    }}
                    className="w-full mt-1 bg-slate-900 border border-emerald-700/60 rounded px-2 py-1.5 text-slate-200 text-xs font-medium focus:ring-1 focus:ring-emerald-400"
                  >
                    <optgroup label="Czujniki Sprzętowe ESP32 (GPIO)">
                      <option value="pirActive">⚡ Czujnik ruchu PIR (GPIO 14 - Cyfrowy)</option>
                      <option value="ambientLux">☀️ Czujnik światła LDR (GPIO 36 - ADC / lx)</option>
                      <option value="temperature">🌡️ Czujnik temperatury DHT22 / BME280 (°C)</option>
                      <option value="humidity">💧 Czujnik wilgotności powietrza (%)</option>
                      <option value="potAdc">🎛️ Potencjometr analogowy ADC (GPIO 34 / 0-4095)</option>
                      <option value="bootPressed">🔘 Przycisk BOOT (GPIO 0)</option>
                      <option value="userBtn1Pressed">🔘 Przycisk funkcyjny BTN1 (GPIO 35)</option>
                      <option value="encoderVal">🔄 Enkoder obrotowy EC11 (Impulsy)</option>
                    </optgroup>
                    <optgroup label="Porty & Łączność ESP32">
                      <option value="usbConnected">🔌 Kabel USB-C do PC (Podłączony / Brak)</option>
                      <option value="bluetoothConnected">📡 Łączność Bluetooth / BLE</option>
                    </optgroup>
                    <optgroup label="Telemetria PC & Zegar">
                      <option value="cpu">💻 Obciążenie CPU PC (%)</option>
                      <option value="ram">🧠 Pamięć RAM PC (%)</option>
                      <option value="gpu">🎮 Karta graficzna GPU (%)</option>
                      <option value="disk">💾 Dysk systemowy C: (%)</option>
                      <option value="time">⏱️ Czas NTP (HH:MM:SS)</option>
                      <option value="date">📅 Data NTP (RRRR-MM-DD)</option>
                    </optgroup>
                    <optgroup label="Inne">
                      <option value="none">Brak (Tekst lub grafika statyczna)</option>
                    </optgroup>
                  </select>
                </div>

                {/* Live Readout Pill */}
                {selectedWidget.binding && selectedWidget.binding !== 'none' && (
                  <div className="p-2 bg-slate-900/90 rounded-lg border border-emerald-800/60 flex items-center justify-between ui-type-micro font-mono">
                    <span className="text-slate-400">Aktualny odczyt:</span>
                    <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {getWidgetLiveValue(selectedWidget).text}
                    </span>
                  </div>
                )}

                {/* Specific sensor options */}
                {(selectedWidget.binding === 'pirActive' || selectedWidget.binding === 'pir' || selectedWidget.binding === 'usbConnected') && (
                  <div className="flex flex-col gap-2 pt-1 border-t border-slate-800">
                    <div>
                      <label className="ui-type-micro text-slate-400">Tekst gdy stan aktywny (HIGH):</label>
                      <input
                        type="text"
                        value={selectedWidget.sensorActiveLabel || ''}
                        placeholder={selectedWidget.binding === 'pirActive' ? 'RUCH WYKRYTY!' : 'POŁĄCZONO'}
                        onChange={e => updateSelectedWidget({ sensorActiveLabel: e.target.value })}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="ui-type-micro text-slate-400">Tekst gdy stan nieaktywny (LOW):</label>
                      <input
                        type="text"
                        value={selectedWidget.sensorInactiveLabel || ''}
                        placeholder={selectedWidget.binding === 'pirActive' ? 'Brak ruchu' : 'Rozłączono'}
                        onChange={e => updateSelectedWidget({ sensorInactiveLabel: e.target.value })}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                      />
                    </div>
                  </div>
                )}

                {(selectedWidget.binding === 'ambientLux' || selectedWidget.binding === 'lux' || selectedWidget.binding === 'potAdc' || selectedWidget.binding === 'pot' || selectedWidget.binding === 'temperature' || selectedWidget.binding === 'temp') && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                    <div>
                      <label className="ui-type-micro text-slate-400">Min skali:</label>
                      <input
                        type="number"
                        value={selectedWidget.minVal ?? 0}
                        onChange={e => updateSelectedWidget({ minVal: Number(e.target.value) })}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="ui-type-micro text-slate-400">Max skali:</label>
                      <input
                        type="number"
                        value={selectedWidget.maxVal ?? (selectedWidget.binding === 'potAdc' ? 4095 : 1000)}
                        onChange={e => updateSelectedWidget({ maxVal: Number(e.target.value) })}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="ui-type-micro text-slate-400">Jednostka pomiarowa:</label>
                      <input
                        type="text"
                        value={selectedWidget.unit || ''}
                        placeholder="lx, °C, ADC, %"
                        onChange={e => updateSelectedWidget({ unit: e.target.value })}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* CARD: Kolejność i Animacja Pojawiania Się */}
              <div className="flex flex-col gap-3 p-3 bg-slate-950 rounded-xl border border-cyan-800/40 shadow-inner">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-cyan-300 font-semibold text-xs font-mono">
                    <Sparkles className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                    <span>Animacja & Sekwencja</span>
                  </div>
                  <span className="px-2 py-0.5 bg-cyan-950 text-cyan-400 font-mono text-xs rounded border border-cyan-800 font-medium">
                    Krok #{selectedWidget.sequenceOrder ?? 1}
                  </span>
                </div>

                {/* Sequence Step Input */}
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                    <span>Kolejność w sekwencji:</span>
                    <span className="text-cyan-400 font-mono font-bold">#{selectedWidget.sequenceOrder ?? 1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMoveSequenceOrder(selectedWidget.id, 'up')}
                      className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-slate-200 text-xs flex items-center justify-center gap-1.5 font-medium transition-colors"
                      title="Pokaż wcześniej w sekwencji"
                    >
                      <ArrowUp className="ui-icon-sm" aria-hidden="true" />
                      <span>Wcześniej</span>
                    </button>
                    <button
                      onClick={() => handleMoveSequenceOrder(selectedWidget.id, 'down')}
                      className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-slate-200 text-xs flex items-center justify-center gap-1.5 font-medium transition-colors"
                      title="Pokaż później w sekwencji"
                    >
                      <ArrowDown className="ui-icon-sm" aria-hidden="true" />
                      <span>Później</span>
                    </button>
                  </div>
                </div>

                {/* Animation Type */}
                <div>
                  <label className="ui-type-micro text-slate-400">Styl wejścia animacji:</label>
                  <select
                    value={selectedWidget.animationType || 'fade_in'}
                    onChange={e => updateSelectedWidget({ animationType: e.target.value as WidgetAnimationType })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200 text-xs font-medium"
                  >
                    <option value="none">Brak (Pojawia się natychmiast)</option>
                    <option value="fade_in">Płynne wygaszanie (Fade In)</option>
                    <option value="slide_left">Wjazd od lewej (Slide Left)</option>
                    <option value="slide_right">Wjazd od prawej (Slide Right)</option>
                    <option value="slide_up">Wjazd od dołu (Slide Up)</option>
                    <option value="slide_down">Wjazd od góry (Slide Down)</option>
                    <option value="zoom_in">Pop-in / Powiększenie (Zoom In)</option>
                    <option value="typewriter">Maszyna do pisania (Typewriter)</option>
                  </select>
                </div>

                {/* Delay (Opóźnienie) */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between ui-type-micro">
                    <span className="text-slate-400">Czas opóźnienia rozpoczęcia:</span>
                    <span className="font-mono text-cyan-400 font-bold">
                      {selectedWidget.animationDelayMs ?? 0} ms ({((selectedWidget.animationDelayMs ?? 0) / 1000).toFixed(2)}s)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3000"
                    step="50"
                    value={selectedWidget.animationDelayMs ?? 0}
                    onChange={e => updateSelectedWidget({ animationDelayMs: Number(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Duration (Czas trwania) */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between ui-type-micro">
                    <span className="text-slate-400">Czas trwania animacji:</span>
                    <span className="font-mono text-cyan-400 font-bold">
                      {selectedWidget.animationDurationMs ?? 500} ms ({((selectedWidget.animationDurationMs ?? 500) / 1000).toFixed(2)}s)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="2000"
                    step="50"
                    value={selectedWidget.animationDurationMs ?? 500}
                    onChange={e => updateSelectedWidget({ animationDurationMs: Number(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Loop Effect */}
                <div>
                  <label className="ui-type-micro text-slate-400">Efekt pętli po wejściu:</label>
                  <select
                    value={selectedWidget.animationLoop || 'none'}
                    onChange={e => updateSelectedWidget({ animationLoop: e.target.value as WidgetAnimationLoop })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200 text-xs"
                  >
                    <option value="none">Brak (Statyczny)</option>
                    <option value="pulse">Pulsowanie jasności (Pulse)</option>
                    <option value="blink">Mruganie (Blink)</option>
                    <option value="bounce">Podskok (Bounce)</option>
                  </select>
                </div>
              </div>

              {/* Specific Properties: Cyber-Pet */}
              {selectedWidget.type === 'cyber_pet' && (
                <div className="flex flex-col gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="font-semibold text-slate-300">Styl i Nastrój Zwierzaka</span>
                  <div>
                    <label className="ui-type-micro text-slate-400">Domyślny nastrój:</label>
                    <select
                      value={selectedWidget.petMood || 'neutral'}
                      onChange={e => updateSelectedWidget({ petMood: e.target.value as PetMood })}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
                    >
                      <option value="neutral">Neutralny (Mruga & rozgląda się)</option>
                      <option value="happy">Wesoły (^ _ ^)</option>
                      <option value="surprised">Zaskoczony (O _ O)</option>
                      <option value="yawn">Ziewający (Senny)</option>
                      <option value="sleep">Śpiący (Zzz)</option>
                      <option value="angry">Zły (&gt; _ &lt;)</option>
                    </select>
                  </div>
                  <div>
                    <label className="ui-type-micro text-slate-400">Kształt oczu:</label>
                    <select
                      value={selectedWidget.petEyeStyle || 'robot_capsule'}
                      onChange={e => updateSelectedWidget({ petEyeStyle: e.target.value as PetEyeStyle })}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
                    >
                      <option value="robot_capsule">Kapsuły Robota (Coji/Vector)</option>
                      <option value="cute_round">Okrągłe Maskotki</option>
                      <option value="pixel_arcade">Pikselowe Retro</option>
                      <option value="cyber_visor">Cyber Wizjer</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Specific Properties: Text */}
              {selectedWidget.type === 'text' && (
                <div className="flex flex-col gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div>
                    <label className="ui-type-micro text-slate-400">Własny tekst (gdy bez czujnika):</label>
                    <input
                      type="text"
                      value={selectedWidget.label || ''}
                      onChange={e => updateSelectedWidget({ label: e.target.value })}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="ui-type-micro text-slate-400">Krój czcionki:</label>
                    <select
                      value={selectedWidget.font || 'u8g2_8x13'}
                      onChange={e => updateSelectedWidget({ font: e.target.value as WidgetFont })}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
                    >
                      <option value="u8g2_8x13">U8g2 8x13 (Standardowy)</option>
                      <option value="pixel_5x7">Pixel 5x7 (Kompaktowy)</option>
                      <option value="tom_thumb">TomThumb 3x5 (Mikro)</option>
                      <option value="jetbrains_mono">JetBrains Mono</option>
                      <option value="press_start_2p">Press Start 2P (Retro)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Specific Properties: Clock */}
              {selectedWidget.type === 'clock' && (
                <div className="flex flex-col gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="ui-type-micro text-slate-300">Format godziny:</span>
                    <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded border border-slate-800 ui-type-micro font-mono">
                      <button
                        type="button"
                        onClick={() => updateSelectedWidget({ clockFormat: '24h' })}
                        className={`px-2 py-0.5 rounded ${
                          (selectedWidget.clockFormat ?? '24h') === '24h'
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'text-slate-400'
                        }`}
                      >
                        24h
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedWidget({ clockFormat: '12h' })}
                        className={`px-2 py-0.5 rounded ${
                          selectedWidget.clockFormat === '12h'
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'text-slate-400'
                        }`}
                      >
                        12h AM/PM
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="ui-type-micro text-slate-300">Pokaż sekundy (:SS):</span>
                    <input
                      type="checkbox"
                      checked={selectedWidget.showSeconds ?? true}
                      onChange={e => updateSelectedWidget({ showSeconds: e.target.checked })}
                      className="rounded accent-cyan-400"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="ui-type-micro text-slate-300">Pokaż datę kalendarzową:</span>
                    <input
                      type="checkbox"
                      checked={selectedWidget.showDate ?? false}
                      onChange={e => updateSelectedWidget({ showDate: e.target.checked })}
                      className="rounded accent-cyan-400"
                    />
                  </div>
                </div>
              )}

              {/* Specific Properties: Gauge */}
              {selectedWidget.type === 'gauge' && (
                <div className="flex flex-col gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div>
                    <label className="ui-type-micro text-slate-400">Tytuł wskaźnika:</label>
                    <input
                      type="text"
                      value={selectedWidget.label || ''}
                      onChange={e => updateSelectedWidget({ label: e.target.value })}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500 gap-2">
              <Sliders className="ui-icon-lg text-slate-600" aria-hidden="true" />
              <p className="text-xs">Zaznacz lub przeciągnij element na ekranie, aby przypisać czujniki sprzętowe lub edytować parametry.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
