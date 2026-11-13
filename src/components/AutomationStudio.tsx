import React, { useState, useEffect, useRef } from 'react';
import { 
  AutomationRule, 
  TriggerType, 
  ActionType, 
  PetMood, 
  PetBehaviorType,
  PetTimelineStep,
  Screen, 
  HardwareSimState 
} from '../types';
import { 
  Zap, 
  Plus, 
  Trash2, 
  Play, 
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Sliders, 
  Code, 
  Sparkles, 
  Clock, 
  Eye, 
  Sun, 
  Activity, 
  ArrowRight,
  Layers,
  Film,
  Copy,
  Check,
  MoveUp,
  MoveDown,
  Wand2,
  Tv,
  Smile,
  Compass,
  Moon,
  Flame,
  Coffee,
  ChevronDown,
  ChevronUp,
  Usb,
  Thermometer,
  CheckCircle2
} from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';

interface AutomationStudioProps {
  automations: AutomationRule[];
  setAutomations: React.Dispatch<React.SetStateAction<AutomationRule[]>>;
  screens: Screen[];
  simState: HardwareSimState;
  setSimState: React.Dispatch<React.SetStateAction<HardwareSimState>>;
}

type StudioTab = 'visual_blocks' | 'script_dsl' | 'timeline';

// Szybkie presety czasu
const TIME_PRESETS = [
  { label: '06:30 Rano', value: '06:30' },
  { label: '08:00 Praca', value: '08:00' },
  { label: '12:00 Południe', value: '12:00' },
  { label: '18:00 Wieczór', value: '18:00' },
  { label: '22:00 Noc', value: '22:00' },
  { label: '23:30 Cisza', value: '23:30' },
];

// Szybkie presety jasności
const BRIGHTNESS_PRESETS = [
  { label: '10% Noc', value: 10 },
  { label: '25% Ciemno', value: 25 },
  { label: '50% Średnia', value: 50 },
  { label: '75% Jasno', value: 75 },
  { label: '100% Maks', value: 100 },
];

// Szybkie presety progu światła LDR
const LUX_PRESETS = [
  { label: '10 lx (Mrok)', value: 10 },
  { label: '35 lx (Zmierzch)', value: 35 },
  { label: '150 lx (Pokój)', value: 150 },
  { label: '500 lx (Biuro)', value: 500 },
];

// Szybkie presety temperatury
const TEMP_PRESETS = [
  { label: '20°C', value: 20 },
  { label: '25°C', value: 25 },
  { label: '30°C', value: 30 },
  { label: '35°C', value: 35 },
];

// Domyślny 3-minutowy (180s) zrównoważony timeline zachowań robota
const DEFAULT_TIMELINE_STEPS: PetTimelineStep[] = [
  { id: 'step_1', behavior: 'sleep', name: 'Głęboki sen (Zzz)', durationSec: 25, description: 'Robot śpi z zamkniętymi oczami i unoszącym się Zzz' },
  { id: 'step_2', behavior: 'yawn', name: 'Ziewnięcie poranne', durationSec: 10, description: 'Powolne otwarcie oczu i szerokie ziewnięcie' },
  { id: 'step_3', behavior: 'blink', name: 'Mruganie i rozbudzanie', durationSec: 10, description: 'Szybkie serie mrugnięć rozjaśniających matrycę' },
  { id: 'step_4', behavior: 'look_around', name: 'Rozglądanie się (Skaner)', durationSec: 25, description: 'Płynne wahadłowe wędrowanie wzrokiem po otoczeniu' },
  { id: 'step_5', behavior: 'look_left', name: 'Zerkanie w lewo', durationSec: 15, description: 'Skupienie wzroku na lewej krawędzi obudowy' },
  { id: 'step_6', behavior: 'look_right', name: 'Zerkanie w prawo', durationSec: 15, description: 'Weryfikacja prawej strony pomieszczenia' },
  { id: 'step_7', behavior: 'look_up', name: 'Patrzenie do góry', durationSec: 20, description: 'Oczy skierowane w górę (np. ku sufitowi / użytkownikowi)' },
  { id: 'step_8', behavior: 'surprised', name: 'Zaskoczenie O_O', durationSec: 10, description: 'Wielkie rozszerzone źrenice po wykryciu obiektu' },
  { id: 'step_9', behavior: 'crazy', name: 'Zaczyna wariować!', durationSec: 15, description: 'Ekscytacja, wibrujące oczy, skaczące źrenice' },
  { id: 'step_10', behavior: 'dizzy', name: 'Zakręcenie / Wirowanie', durationSec: 10, description: 'Oczy wirujące w koło po szaleńczym tańcu' },
  { id: 'step_11', behavior: 'happy', name: 'Uśmiech ^_^', durationSec: 15, description: 'Radosne wygięte łuki i zadowolenie ze spotkania' },
  { id: 'step_12', behavior: 'neutral', name: 'Czuwanie w gotowości', durationSec: 10, description: 'Stabilne spojrzenie kapsułowe, oczekiwanie na komendy' },
];

export const AutomationStudio: React.FC<AutomationStudioProps> = ({
  automations,
  setAutomations,
  screens,
  simState,
  setSimState,
}) => {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<StudioTab>('visual_blocks');
  const [isAddingRule, setIsAddingRule] = useState<boolean>(false);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  // New rule form state
  const [newName, setNewName] = useState<string>('Nowa automatyzacja');
  const [newTriggerType, setNewTriggerType] = useState<TriggerType>('pir_motion');
  const [newTriggerPin, setNewTriggerPin] = useState<number>(14);
  const [newTriggerThreshold, setNewTriggerThreshold] = useState<number>(20);
  const [newTriggerTime, setNewTriggerTime] = useState<string>('22:00');
  const [newActionType, setNewActionType] = useState<ActionType>('set_pet_mood');
  const [newActionMood, setNewActionMood] = useState<PetMood>('surprised');
  const [newActionScreenId, setNewActionScreenId] = useState<string>(screens[0]?.id || '');
  const [newActionBrightness, setNewActionBrightness] = useState<number>(20);

  // ==============================================================================
  //  STAN DLA OSI CZASU I GENERATORA ZACHOWAŃ CYBER-ZWIERZAKA
  // ==============================================================================
  const [timelineSteps, setTimelineSteps] = useState<PetTimelineStep[]>(DEFAULT_TIMELINE_STEPS);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [syncWithSimulator, setSyncWithSimulator] = useState<boolean>(true);
  const [generatorMinutes, setGeneratorMinutes] = useState<number>(3);
  const [generatorPersonality, setGeneratorPersonality] = useState<'balanced' | 'crazy' | 'sleepy' | 'curious'>('balanced');
  const [copiedCpp, setCopiedCpp] = useState<boolean>(false);

  // Formularz dodawania nowego kroku
  const [newStepBehavior, setNewStepBehavior] = useState<PetBehaviorType>('look_around');
  const [newStepDuration, setNewStepDuration] = useState<number>(20);
  const [newStepName, setNewStepName] = useState<string>('Płynne rozglądanie się');
  const [newStepDesc, setNewStepDesc] = useState<string>('Oczy wodzą w lewo i prawo');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Całkowity czas osi czasu
  const totalDurationSec = timelineSteps.reduce((acc, step) => acc + step.durationSec, 0);

  // Obliczenie timingów każdego kroku (start i end w sekundach)
  let cumulativeTime = 0;
  const timedSteps = timelineSteps.map(step => {
    const start = cumulativeTime;
    const end = cumulativeTime + step.durationSec;
    cumulativeTime = end;
    return {
      ...step,
      start,
      end
    };
  });

  const currentActiveStep = timedSteps.find(s => currentTimeSec >= s.start && currentTimeSec < s.end) 
    || timedSteps[timedSteps.length - 1] 
    || timedSteps[0];

  // Pętla odtwarzacza osi czasu
  useEffect(() => {
    if (!isPlaying || totalDurationSec <= 0) return;

    const interval = setInterval(() => {
      setCurrentTimeSec(prev => {
        const stepIncrement = 0.1 * playbackSpeed;
        const nextTime = prev + stepIncrement;
        if (nextTime >= totalDurationSec) {
          return 0;
        }
        return nextTime;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, totalDurationSec]);

  // Synchronizacja z symulatorem ESP32
  useEffect(() => {
    if (syncWithSimulator && currentActiveStep && activeTab === 'timeline') {
      setSimState(prev => {
        if (prev.activePetMood === currentActiveStep.behavior) return prev;
        return {
          ...prev,
          activePetMood: currentActiveStep.behavior as PetMood,
          lastTriggerFired: `Oś Czasu [${formatTime(currentTimeSec)}]: ${currentActiveStep.name}`
        };
      });
    }
  }, [currentActiveStep?.behavior, syncWithSimulator, currentTimeSec, activeTab, setSimState]);

  // Canvas OLED render loop
  useEffect(() => {
    if (activeTab !== 'timeline') return;
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const mood = currentActiveStep?.behavior || 'neutral';

      ctx.fillStyle = '#050811';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      const eyeW = 44;
      const eyeH = 48;
      const leftX = w / 2 - eyeW - 14;
      const rightX = w / 2 + 14;
      const eyeY = (h - eyeH) / 2;

      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#38bdf8';

      if (mood === 'sleep') {
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(leftX, eyeY + eyeH / 2);
        ctx.lineTo(leftX + eyeW, eyeY + eyeH / 2);
        ctx.moveTo(rightX, eyeY + eyeH / 2);
        ctx.lineTo(rightX + eyeW, eyeY + eyeH / 2);
        ctx.stroke();

        const t = (Date.now() / 400) % 3;
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = '#a78bfa';
        ctx.fillText('Z', rightX + eyeW + 4, eyeY + 12 - t * 4);
        ctx.font = 'bold 10px monospace';
        ctx.fillText('z', rightX + eyeW + 12, eyeY + 4 - t * 4);
      } else if (mood === 'yawn') {
        ctx.beginPath();
        ctx.roundRect(leftX, eyeY + 8, eyeW, eyeH - 16, 6);
        ctx.roundRect(rightX, eyeY + 8, eyeW, eyeH - 16, 6);
        ctx.fill();

        const mouthPulse = Math.sin(Date.now() / 300) * 2;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(w / 2, eyeY + eyeH - 2, 7 + mouthPulse, 0, Math.PI * 2);
        ctx.stroke();
      } else if (mood === 'happy') {
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(leftX + eyeW / 2, eyeY + eyeH / 2 + 6, eyeW / 2 - 2, Math.PI, 0, false);
        ctx.arc(rightX + eyeW / 2, eyeY + eyeH / 2 + 6, eyeW / 2 - 2, Math.PI, 0, false);
        ctx.stroke();
      } else if (mood === 'surprised') {
        ctx.beginPath();
        ctx.roundRect(leftX - 2, eyeY - 4, eyeW + 4, eyeH + 8, 12);
        ctx.roundRect(rightX - 2, eyeY - 4, eyeW + 4, eyeH + 8, 12);
        ctx.fill();

        ctx.fillStyle = '#050811';
        ctx.beginPath();
        ctx.arc(leftX + eyeW / 2, eyeY + eyeH / 2, 6, 0, Math.PI * 2);
        ctx.arc(rightX + eyeW / 2, eyeY + eyeH / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (mood === 'blink') {
        ctx.fillRect(leftX, eyeY + eyeH / 2 - 2, eyeW, 4);
        ctx.fillRect(rightX, eyeY + eyeH / 2 - 2, eyeW, 4);
      } else if (mood === 'look_up') {
        ctx.beginPath();
        ctx.roundRect(leftX, eyeY, eyeW, eyeH, 10);
        ctx.roundRect(rightX, eyeY, eyeW, eyeH, 10);
        ctx.fill();

        ctx.fillStyle = '#050811';
        ctx.beginPath();
        ctx.arc(leftX + eyeW / 2, eyeY + 12, 6, 0, Math.PI * 2);
        ctx.arc(rightX + eyeW / 2, eyeY + 12, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (mood === 'look_left') {
        ctx.beginPath();
        ctx.roundRect(leftX, eyeY, eyeW, eyeH, 10);
        ctx.roundRect(rightX, eyeY, eyeW, eyeH, 10);
        ctx.fill();

        ctx.fillStyle = '#050811';
        ctx.beginPath();
        ctx.arc(leftX + 10, eyeY + eyeH / 2, 6, 0, Math.PI * 2);
        ctx.arc(rightX + 10, eyeY + eyeH / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (mood === 'look_right') {
        ctx.beginPath();
        ctx.roundRect(leftX, eyeY, eyeW, eyeH, 10);
        ctx.roundRect(rightX, eyeY, eyeW, eyeH, 10);
        ctx.fill();

        ctx.fillStyle = '#050811';
        ctx.beginPath();
        ctx.arc(leftX + eyeW - 10, eyeY + eyeH / 2, 6, 0, Math.PI * 2);
        ctx.arc(rightX + eyeW - 10, eyeY + eyeH / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (mood === 'look_around') {
        const t = Date.now() / 400;
        const sweep = Math.sin(t) * (eyeW / 3);

        ctx.beginPath();
        ctx.roundRect(leftX, eyeY, eyeW, eyeH, 10);
        ctx.roundRect(rightX, eyeY, eyeW, eyeH, 10);
        ctx.fill();

        ctx.fillStyle = '#050811';
        ctx.beginPath();
        ctx.arc(leftX + eyeW / 2 + sweep, eyeY + eyeH / 2, 6, 0, Math.PI * 2);
        ctx.arc(rightX + eyeW / 2 + sweep, eyeY + eyeH / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (mood === 'crazy' || mood === 'dizzy') {
        const t = Date.now() / 150;
        const offX = Math.cos(t) * (eyeW / 3.4);
        const offY = Math.sin(t) * (eyeH / 3.4);
        const bounce = Math.sin(Date.now() / 80) * 3;

        ctx.fillStyle = mood === 'crazy' ? '#f43f5e' : '#ec4899';
        ctx.beginPath();
        ctx.roundRect(leftX, eyeY + bounce, eyeW, eyeH, 10);
        ctx.roundRect(rightX, eyeY - bounce, eyeW, eyeH, 10);
        ctx.fill();

        ctx.fillStyle = '#050811';
        ctx.beginPath();
        ctx.arc(leftX + eyeW / 2 + offX, eyeY + bounce + eyeH / 2 + offY, 6, 0, Math.PI * 2);
        ctx.arc(rightX + eyeW / 2 - offX, eyeY - bounce + eyeH / 2 - offY, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(leftX - 6 + (t % 10), eyeY - 4, 3, 3);
        ctx.fillRect(rightX + eyeW + 4, eyeY + eyeH - (t % 10), 3, 3);
      } else if (mood === 'angry') {
        ctx.beginPath();
        ctx.moveTo(leftX, eyeY + 4);
        ctx.lineTo(leftX + eyeW, eyeY + 16);
        ctx.lineTo(leftX + eyeW, eyeY + eyeH);
        ctx.lineTo(leftX, eyeY + eyeH - 6);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(rightX + eyeW, eyeY + 4);
        ctx.lineTo(rightX, eyeY + 16);
        ctx.lineTo(rightX, eyeY + eyeH);
        ctx.lineTo(rightX + eyeW, eyeY + eyeH - 6);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.roundRect(leftX, eyeY, eyeW, eyeH, 10);
        ctx.roundRect(rightX, eyeY, eyeW, eyeH, 10);
        ctx.fill();

        ctx.fillStyle = '#050811';
        ctx.beginPath();
        ctx.arc(leftX + eyeW / 2, eyeY + eyeH / 2, 5, 0, Math.PI * 2);
        ctx.arc(rightX + eyeW / 2, eyeY + eyeH / 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [currentActiveStep?.behavior, activeTab]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getBehaviorBadgeColor = (behavior: PetBehaviorType) => {
    switch (behavior) {
      case 'look_around': return 'bg-cyan-950 text-cyan-300 border-cyan-800';
      case 'look_up': return 'bg-sky-950 text-sky-300 border-sky-800';
      case 'look_left':
      case 'look_right': return 'bg-teal-950 text-teal-300 border-teal-800';
      case 'yawn': return 'bg-amber-950 text-amber-300 border-amber-800';
      case 'sleep': return 'bg-purple-950 text-purple-300 border-purple-800';
      case 'crazy': return 'bg-rose-950 text-rose-300 border-rose-800';
      case 'dizzy': return 'bg-pink-950 text-pink-300 border-pink-800';
      case 'happy': return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      case 'surprised': return 'bg-yellow-950 text-yellow-300 border-yellow-800';
      case 'blink': return 'bg-indigo-950 text-indigo-300 border-indigo-800';
      case 'angry': return 'bg-red-950 text-red-300 border-red-800';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  // ==============================================================================
  //  METODY EDYCJI I ZARZĄDZANIA REGUŁAMI (VISUAL BLOCKS)
  // ==============================================================================

  // Aktualizuj dowolny parametr reguły w locie
  const handleUpdateRule = (id: string, updater: (r: AutomationRule) => AutomationRule) => {
    setAutomations(prev => prev.map(r => r.id === id ? updater(r) : r));
  };

  // Włącz/Wyłącz regułę
  const handleToggleRule = (id: string) => {
    setAutomations(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  // Usuń regułę
  const handleDeleteRule = (id: string) => {
    setAutomations(prev => prev.filter(r => r.id !== id));
  };

  // Duplikuj regułę
  const handleDuplicateRule = (rule: AutomationRule) => {
    const duplicated: AutomationRule = {
      ...rule,
      id: `rule_${Date.now()}`,
      name: `${rule.name} (Kopia)`,
    };
    setAutomations(prev => [...prev, duplicated]);
    setExpandedRuleId(duplicated.id);
  };

  // Szybkie dodanie reguły z szablonu (1 kliknięcie)
  const handleAddFromTemplate = (templateKey: string) => {
    let newRule: AutomationRule;

    if (templateKey === 'night_dim') {
      newRule = {
        id: `rule_${Date.now()}`,
        name: '🌙 Nocne ściemnianie (22:00 -> 15% + Ziewanie)',
        enabled: true,
        trigger: { type: 'time_is', time: '22:00' },
        action: { type: 'set_brightness', brightness: 15, petMood: 'yawn' }
      };
    } else if (templateKey === 'morning_wake') {
      newRule = {
        id: `rule_${Date.now()}`,
        name: '☀️ Poranne wybudzenie (07:00 -> 85% + Radość)',
        enabled: true,
        trigger: { type: 'time_is', time: '07:00' },
        action: { type: 'wake_display', brightness: 85, petMood: 'happy' }
      };
    } else if (templateKey === 'pir_look_around') {
      newRule = {
        id: `rule_${Date.now()}`,
        name: '👀 Reakcja PIR (Ruch -> Rozglądanie się)',
        enabled: true,
        trigger: { type: 'pir_motion', gpioPin: 14 },
        action: { type: 'set_pet_mood', petMood: 'look_around' }
      };
    } else if (templateKey === 'usb_pc_monitor') {
      newRule = {
        id: `rule_${Date.now()}`,
        name: '🔌 Kabel USB-C (Wpięto -> Ekran Monitora PC)',
        enabled: true,
        trigger: { type: 'usb_connected' },
        action: { type: 'switch_screen', targetScreenId: screens[2]?.id || screens[0]?.id }
      };
    } else if (templateKey === 'dusk_lux') {
      newRule = {
        id: `rule_${Date.now()}`,
        name: '💡 Zmierzch LDR (< 35 lx -> Jasność 25%)',
        enabled: true,
        trigger: { type: 'light_lux_below', threshold: 35 },
        action: { type: 'set_brightness', brightness: 25 }
      };
    } else if (templateKey === 'temp_alarm') {
      newRule = {
        id: `rule_${Date.now()}`,
        name: '🔥 Alarm gorąca (> 30°C -> Szaleństwo zwierzaka)',
        enabled: true,
        trigger: { type: 'temp_above', threshold: 30 },
        action: { type: 'set_pet_mood', petMood: 'crazy' }
      };
    } else {
      return;
    }

    setAutomations(prev => [...prev, newRule]);
    setExpandedRuleId(newRule.id);
  };

  // Testuj regułę w symulatorze
  const handleTestRule = (rule: AutomationRule) => {
    setSimState(prev => {
      let nextMood = prev.activePetMood;
      let nextScreenIdx = prev.currentScreenIndex;
      let nextAwake = prev.isDisplayAwake;

      if (rule.action.type === 'set_pet_mood' && rule.action.petMood) {
        nextMood = rule.action.petMood;
      }
      if (rule.action.type === 'switch_screen') {
        if (rule.action.targetScreenId) {
          const foundIdx = screens.findIndex(s => s.id === rule.action.targetScreenId);
          if (foundIdx >= 0) nextScreenIdx = foundIdx;
        } else {
          nextScreenIdx = (prev.currentScreenIndex + 1) % screens.length;
        }
      }
      if (rule.action.type === 'wake_display') {
        nextAwake = true;
      }
      if (rule.action.type === 'set_brightness' && rule.action.brightness !== undefined) {
        if (rule.action.petMood) {
          nextMood = rule.action.petMood;
        }
      }

      return {
        ...prev,
        activePetMood: nextMood,
        currentScreenIndex: nextScreenIdx,
        isDisplayAwake: nextAwake,
        lastTriggerFired: `Ręczny test reguły: "${rule.name}"`,
      };
    });
  };

  // Zapisz nową regułę z kreatora
  const handleCreateRule = () => {
    const newRule: AutomationRule = {
      id: `rule_${Date.now()}`,
      name: newName,
      enabled: true,
      trigger: {
        type: newTriggerType,
        gpioPin: newTriggerPin,
        threshold: newTriggerThreshold,
        time: newTriggerTime,
      },
      action: {
        type: newActionType,
        petMood: newActionMood,
        targetScreenId: newActionScreenId,
        brightness: newActionBrightness,
      },
    };

    setAutomations(prev => [...prev, newRule]);
    setIsAddingRule(false);
    setExpandedRuleId(newRule.id);
  };

  // ==============================================================================
  //  METODY OSI CZASU
  // ==============================================================================
  const handleApplyPreset = (presetKey: string) => {
    let steps: PetTimelineStep[] = [];

    if (presetKey === 'morning_wake') {
      steps = [
        { id: `step_${Date.now()}_1`, behavior: 'sleep', name: 'Głęboki sen nocy', durationSec: 35, description: 'Robot regeneruje baterie, Zzz' },
        { id: `step_${Date.now()}_2`, behavior: 'yawn', name: 'Wielkie ziewnięcie', durationSec: 15, description: 'Otwarcie ust i rozciąganie serwomechanizmów' },
        { id: `step_${Date.now()}_3`, behavior: 'blink', name: 'Mruganie na powitanie', durationSec: 15, description: 'Trzykrotne mrugnięcie' },
        { id: `step_${Date.now()}_4`, behavior: 'look_around', name: 'Rozglądanie się', durationSec: 30, description: 'Skanowanie poziome pokoju' },
        { id: `step_${Date.now()}_5`, behavior: 'look_up', name: 'Spoglądanie ku światłu', durationSec: 25, description: 'Oczy skierowane w górę na lampę/okno' },
        { id: `step_${Date.now()}_6`, behavior: 'happy', name: 'Radość z nowego dnia', durationSec: 30, description: 'Uśmiechnięte oczy ^_^' },
        { id: `step_${Date.now()}_7`, behavior: 'neutral', name: 'Gotowość do pracy', durationSec: 30, description: 'Czuwanie w trybie asystenta' }
      ];
    } else if (presetKey === 'curious_explorer') {
      steps = [
        { id: `step_${Date.now()}_1`, behavior: 'neutral', name: 'Spokojna obserwacja', durationSec: 30, description: 'Oczekiwanie na bodziec' },
        { id: `step_${Date.now()}_2`, behavior: 'look_around', name: 'Szczegółowe skanowanie', durationSec: 45, description: 'Płynny ruch gałek ocznych w lewo i prawo' },
        { id: `step_${Date.now()}_3`, behavior: 'look_left', name: 'Fokus na lewy obiekt', durationSec: 30, description: 'Zauważenie ruchu po lewej stronie' },
        { id: `step_${Date.now()}_4`, behavior: 'look_right', name: 'Fokus na prawy obiekt', durationSec: 30, description: 'Weryfikacja drugiego obiektu' },
        { id: `step_${Date.now()}_5`, behavior: 'look_up', name: 'Spojrzenie na twarz człowieka', durationSec: 35, description: 'Podniesienie wzroku ku użytkownikowi' },
        { id: `step_${Date.now()}_6`, behavior: 'surprised', name: 'Wielkie zaskoczenie O_O', durationSec: 20, description: 'Rozszerzone źrenice robota' },
        { id: `step_${Date.now()}_7`, behavior: 'crazy', name: 'Ekscytacja odkryciem!', durationSec: 30, description: 'Zaczyna wariować ze szczęścia, skaczące oczy' },
        { id: `step_${Date.now()}_8`, behavior: 'dizzy', name: 'Wirujące oczy', durationSec: 25, description: 'Obrót źrenic dookoła po intensywnym tańcu' },
        { id: `step_${Date.now()}_9`, behavior: 'yawn', name: 'Zmęczenie po badaniach', durationSec: 25, description: 'Powolne ziewnięcie' },
        { id: `step_${Date.now()}_10`, behavior: 'sleep', name: 'Krótka drzemka regeneracyjna', durationSec: 30, description: 'Odpoczynek przed kolejną misją' }
      ];
    } else if (presetKey === 'evening_sleep') {
      steps = [
        { id: `step_${Date.now()}_1`, behavior: 'neutral', name: 'Spokojny wieczór', durationSec: 40, description: 'Przygaszone czuwanie robota' },
        { id: `step_${Date.now()}_2`, behavior: 'look_around', name: 'Leniwe rozglądanie się', durationSec: 35, description: 'Powolne ruchy wzroku' },
        { id: `step_${Date.now()}_3`, behavior: 'yawn', name: 'Pierwsze ziewnięcie', durationSec: 25, description: 'Głębokie ziewnięcie wieczorne' },
        { id: `step_${Date.now()}_4`, behavior: 'look_left', name: 'Ospałe spojrzenie w bok', durationSec: 25, description: 'Spadek poziomu energii' },
        { id: `step_${Date.now()}_5`, behavior: 'yawn', name: 'Drugie potężne ziewnięcie', durationSec: 25, description: 'Przygotowanie do uśpienia' },
        { id: `step_${Date.now()}_6`, behavior: 'blink', name: 'Ciężkie opadające powieki', durationSec: 30, description: 'Wolne, ciężkie mrugnięcia' },
        { id: `step_${Date.now()}_7`, behavior: 'sleep', name: 'Zapadnięcie w głęboki sen Zzz', durationSec: 60, description: 'Uśpienie procesora, animowane Zzz' }
      ];
    } else if (presetKey === 'crazy_party') {
      steps = [
        { id: `step_${Date.now()}_1`, behavior: 'neutral', name: 'Odliczanie do imprezy', durationSec: 15, description: 'Cisza przed burzą' },
        { id: `step_${Date.now()}_2`, behavior: 'surprised', name: 'Aktywacja Party Mode!', durationSec: 15, description: 'Oczy O_O w rytm muzyki' },
        { id: `step_${Date.now()}_3`, behavior: 'crazy', name: 'ZACZYNA TOTALNIE WARIOWAĆ!', durationSec: 35, description: 'Wibrujące oczy, skoki i błyski neonowe' },
        { id: `step_${Date.now()}_4`, behavior: 'dizzy', name: 'Wirujące hipnotyczne źrenice', durationSec: 25, description: 'Kosmiczny obrót 360 stopni' },
        { id: `step_${Date.now()}_5`, behavior: 'look_around', name: 'Błyskawiczny skan parkietu', durationSec: 15, description: 'Ruch z prędkością światła' },
        { id: `step_${Date.now()}_6`, behavior: 'happy', name: 'Super uśmiech robotyczny ^_^', durationSec: 15, description: 'Finałowy zadowolony grymas' }
      ];
    }

    setTimelineSteps(steps);
    setCurrentTimeSec(0);
    setIsPlaying(true);
  };

  const handleGenerateCustomTimeline = () => {
    const targetTotalSec = generatorMinutes * 60;
    const generated: PetTimelineStep[] = [];
    let currentTotal = 0;
    let stepIndex = 1;

    const poolByPersonality: Record<string, { mood: PetBehaviorType; name: string; desc: string; durMin: number; durMax: number }[]> = {
      balanced: [
        { mood: 'neutral', name: 'Czuwanie neutralne', desc: 'Gotowość do pracy', durMin: 15, durMax: 30 },
        { mood: 'look_around', name: 'Rozglądanie się', desc: 'Płynne wodzenie wzrokiem', durMin: 20, durMax: 40 },
        { mood: 'look_left', name: 'Zerkanie w lewo', desc: 'Sprawdzenie lewej strony', durMin: 10, durMax: 20 },
        { mood: 'look_right', name: 'Zerkanie w prawo', desc: 'Sprawdzenie prawej strony', durMin: 10, durMax: 20 },
        { mood: 'look_up', name: 'Patrzenie w górę', desc: 'Oczy ku sufitowi', durMin: 15, durMax: 25 },
        { mood: 'blink', name: 'Mruganie', desc: 'Nawilżanie matrycy OLED', durMin: 10, durMax: 15 },
        { mood: 'happy', name: 'Uśmiech ^_^', desc: 'Zadowolenie', durMin: 15, durMax: 25 },
        { mood: 'yawn', name: 'Ziewnięcie', desc: 'Krótki spadek energii', durMin: 10, durMax: 20 },
        { mood: 'sleep', name: 'Krótki sen Zzz', desc: 'Drzemka mikroprocesora', durMin: 20, durMax: 40 },
      ],
      crazy: [
        { mood: 'crazy', name: 'Zwierzak wariuje!', desc: 'Ekscytacja i chaos', durMin: 15, durMax: 35 },
        { mood: 'dizzy', name: 'Zakręcone wirujące oczy', desc: 'Wirowanie źrenic w koło', durMin: 15, durMax: 25 },
        { mood: 'look_around', name: 'Szybkie rozglądanie się', desc: 'Błyskawiczne ruchy', durMin: 15, durMax: 25 },
        { mood: 'surprised', name: 'Wielkie oczy O_O', desc: 'Szok i zdziwienie', durMin: 10, durMax: 20 },
        { mood: 'happy', name: 'Dziki uśmiech robota', desc: 'Pełna euforia', durMin: 15, durMax: 25 },
        { mood: 'look_up', name: 'Wystrzał wzroku w górę', desc: 'Wypatrywanie fajerwerków', durMin: 10, durMax: 20 }
      ],
      sleepy: [
        { mood: 'sleep', name: 'Głęboki sen Zzz', desc: 'Cichy relaks z chrapaniem', durMin: 30, durMax: 60 },
        { mood: 'yawn', name: 'Wielkie ziewnięcie', desc: 'Otwarta buźka robota', durMin: 15, durMax: 30 },
        { mood: 'blink', name: 'Powolne mrugnięcie', desc: 'Opadające powieki', durMin: 10, durMax: 20 },
        { mood: 'look_around', name: 'Zaspane rozglądanie się', desc: 'Leniwy ruch wzroku', durMin: 20, durMax: 35 },
        { mood: 'look_up', name: 'Patrzenie w sufit z łóżka', desc: 'Rozmyślanie o gwiazdach', durMin: 15, durMax: 25 }
      ],
      curious: [
        { mood: 'look_around', name: 'Rozglądanie się po pokoju', desc: 'Skanowanie 180 stopni', durMin: 25, durMax: 45 },
        { mood: 'look_left', name: 'Ciekawe zerkanie w lewo', desc: 'Co tam stoi na biurku?', durMin: 15, durMax: 30 },
        { mood: 'look_right', name: 'Ciekawe zerkanie w prawo', desc: 'Ktoś właśnie podszedł?', durMin: 15, durMax: 30 },
        { mood: 'look_up', name: 'Badanie sufitu i światła', desc: 'Pomiar luksów otoczenia', durMin: 20, durMax: 35 },
        { mood: 'surprised', name: 'Zaskoczenie nowym obiektem', desc: 'Powiększone źrenice', durMin: 10, durMax: 20 },
        { mood: 'happy', name: 'Satysfakcja z odkrycia', desc: 'Uśmiech małego robota', durMin: 15, durMax: 25 },
        { mood: 'neutral', name: 'Analiza danych z sensorów', desc: 'Chwila skupienia', durMin: 15, durMax: 30 }
      ]
    };

    const pool = poolByPersonality[generatorPersonality] || poolByPersonality.balanced;

    while (currentTotal < targetTotalSec) {
      const template = pool[Math.floor(Math.random() * pool.length)];
      const remainingSec = targetTotalSec - currentTotal;
      let dur = Math.floor(Math.random() * (template.durMax - template.durMin + 1)) + template.durMin;

      if (dur > remainingSec || remainingSec < 15) {
        dur = remainingSec;
      }

      generated.push({
        id: `gen_step_${stepIndex}_${Date.now()}`,
        behavior: template.mood,
        name: template.name,
        durationSec: dur,
        description: template.desc
      });

      currentTotal += dur;
      stepIndex++;
    }

    setTimelineSteps(generated);
    setCurrentTimeSec(0);
    setIsPlaying(true);
  };

  const handleMoveStep = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= timelineSteps.length) return;
    const newSteps = [...timelineSteps];
    const temp = newSteps[idx];
    newSteps[idx] = newSteps[targetIdx];
    newSteps[targetIdx] = temp;
    setTimelineSteps(newSteps);
  };

  const handleDeleteStep = (id: string) => {
    if (timelineSteps.length <= 1) return;
    setTimelineSteps(prev => prev.filter(s => s.id !== id));
  };

  const handleDurationChange = (id: string, newSec: number) => {
    const cleanSec = Math.max(2, Math.min(600, newSec || 5));
    setTimelineSteps(prev => prev.map(s => s.id === id ? { ...s, durationSec: cleanSec } : s));
  };

  const handleBehaviorChange = (id: string, newBeh: PetBehaviorType) => {
    setTimelineSteps(prev => prev.map(s => s.id === id ? { ...s, behavior: newBeh } : s));
  };

  const handleAddStep = () => {
    const newStep: PetTimelineStep = {
      id: `step_${Date.now()}`,
      behavior: newStepBehavior,
      durationSec: Math.max(2, newStepDuration),
      name: newStepName || 'Nowe zachowanie',
      description: newStepDesc || 'Własny krok w sekwencji zwierzaka'
    };
    setTimelineSteps(prev => [...prev, newStep]);
  };

  const generateCppTimelineCode = () => {
    const moodToCppConst: Record<PetBehaviorType, string> = {
      look_around: 'MOOD_LOOK_AROUND',
      look_up: 'MOOD_LOOK_UP',
      look_left: 'MOOD_LOOK_LEFT',
      look_right: 'MOOD_LOOK_RIGHT',
      yawn: 'MOOD_YAWN',
      sleep: 'MOOD_SLEEP',
      crazy: 'MOOD_CRAZY',
      dizzy: 'MOOD_DIZZY',
      happy: 'MOOD_HAPPY',
      surprised: 'MOOD_SURPRISED',
      blink: 'MOOD_BLINK',
      angry: 'MOOD_ANGRY',
      neutral: 'MOOD_NEUTRAL'
    };

    const stepsCpp = timelineSteps.map(s => {
      const cppConst = moodToCppConst[s.behavior] || 'MOOD_NEUTRAL';
      const ms = s.durationSec * 1000;
      return `  { ${cppConst}, ${ms}UL, "${s.name}" }, // ${s.durationSec}s: ${s.description}`;
    }).join('\n');

    return `// ==============================================================================
//  OŚ CZASU ZACHOWAŃ CYBER-ZWIERZAKA DLA ESP32 (Łączny czas: ${formatTime(totalDurationSec)})
// ==============================================================================

struct PetTimelineStep {
  PetMood mood;
  unsigned long durationMs;
  const char* stepName;
};

// Zdefiniowana sekwencja zachowań (nieblokująca pętla millis)
const PetTimelineStep PET_TIMELINE_ROUTINE[] = {
${stepsCpp}
};

const int PET_TIMELINE_STEPS_COUNT = sizeof(PET_TIMELINE_ROUTINE) / sizeof(PET_TIMELINE_ROUTINE[0]);
int currentTimelineIndex = 0;
unsigned long lastTimelineStepMillis = 0;

// Wywołaj tę funkcję wewnątrz loop() swojego ESP32:
void updatePetTimeline() {
  unsigned long currentMillis = millis();
  
  if (currentMillis - lastTimelineStepMillis >= PET_TIMELINE_ROUTINE[currentTimelineIndex].durationMs) {
    lastTimelineStepMillis = currentMillis;
    currentTimelineIndex = (currentTimelineIndex + 1) % PET_TIMELINE_STEPS_COUNT;
    
    currentPetMood = PET_TIMELINE_ROUTINE[currentTimelineIndex].mood;
    
    Serial.print(F("[CYBER-PET OŚ CZASU] Nowe zachowanie: "));
    Serial.print(PET_TIMELINE_ROUTINE[currentTimelineIndex].stepName);
    Serial.print(F(" (trwanie: "));
    Serial.print(PET_TIMELINE_ROUTINE[currentTimelineIndex].durationMs / 1000);
    Serial.println(F("s)"));
  }
}`;
  };

  const handleCopyCpp = () => {
    navigator.clipboard.writeText(generateCppTimelineCode());
    setCopiedCpp(true);
    setTimeout(() => setCopiedCpp(false), 2500);
  };

  const generateDslText = () => {
    return automations.map(r => {
      let trigStr = '';
      if (r.trigger.type === 'pir_motion') trigStr = `ON pir_motion(GPIO_${r.trigger.gpioPin || 14})`;
      else if (r.trigger.type === 'light_lux_below') trigStr = `ON ambient_light < ${r.trigger.threshold || 20} lx`;
      else if (r.trigger.type === 'temp_above') trigStr = `ON temperature > ${r.trigger.threshold || 30} °C`;
      else if (r.trigger.type === 'time_is') trigStr = `ON clock_time == "${r.trigger.time || '22:00'}"`;
      else if (r.trigger.type === 'boot_button_pressed') trigStr = `ON button_press(GPIO_0)`;
      else if (r.trigger.type === 'usb_connected') trigStr = `ON usb_cable_connected()`;
      else trigStr = `ON event(${r.trigger.type})`;

      let actStr = '';
      if (r.action.type === 'set_pet_mood') actStr = `set_pet_mood("${r.action.petMood}")`;
      else if (r.action.type === 'switch_screen') actStr = `switch_screen("${r.action.targetScreenId || 'NEXT'}")`;
      else if (r.action.type === 'set_brightness') actStr = `set_screen_brightness(${r.action.brightness}%)`;
      else if (r.action.type === 'wake_display') actStr = `wake_display()`;
      else actStr = `execute_action(${r.action.type})`;

      return `# Reguła: ${r.name} [${r.enabled ? 'AKTYWNA' : 'WYŁĄCZONA'}]\n${trigStr} DO\n    ${actStr}\n    notify_console("Reguła wykonana: ${r.name}")\nEND\n`;
    }).join('\n');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner / Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl">
        <div>
          <h2 className="ui-type-title text-slate-100 flex items-center gap-2">
            <Zap className="ui-icon-sm text-cyan-400" aria-hidden="true" />
            {t('auto.title')}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('auto.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('visual_blocks')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'visual_blocks' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="ui-icon-sm" aria-hidden="true" />
              <span>{t('auto.tabBlocks')}</span>
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'timeline' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Film className="ui-icon-sm" aria-hidden="true" />
              <span>{t('auto.tabTimeline')}</span>
            </button>
            <button
              onClick={() => setActiveTab('script_dsl')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'script_dsl' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code className="ui-icon-sm" aria-hidden="true" />
              <span>{t('auto.tabDsl')}</span>
            </button>
          </div>

          <button
            onClick={() => setIsAddingRule(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-sm"
          >
            <Plus className="ui-icon-sm" aria-hidden="true" />
            <span>{t('auto.newRule')}</span>
          </button>
        </div>
      </div>

      {/* ============================================================================== */}
      {/*  ZAKŁADKA 1: KLOCKI REGUŁ (VISUAL BLOCKS Z ŁATWĄ EDYCJĄ PARAMETRÓW)            */}
      {/* ============================================================================== */}
      {activeTab === 'visual_blocks' ? (
        <div className="flex flex-col gap-5">
          {/* Szybkie Gotowe Szablony Reguł (1-Kliknięcie) */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Wand2 className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                {t('auto.quickTemplates')}
              </span>
              <span className="ui-type-micro text-cyan-400 font-mono">{t('auto.quickTemplatesHint')}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <button
                type="button"
                onClick={() => handleAddFromTemplate('night_dim')}
                className="cursor-pointer p-2.5 min-h-[5.5rem] bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-500/60 rounded-xl text-left transition-all flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between">
                  <Moon className="ui-icon-sm text-slate-300" aria-hidden="true" />
                  <Plus className="ui-icon-sm text-slate-500 group-hover:text-slate-300 transition-colors" aria-hidden="true" />
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold text-slate-200 group-hover:text-slate-100">{t('auto.tpl.night')}</div>
                  <div className="text-xs text-slate-400 mt-0.5">22:00 → 15% + Sen</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAddFromTemplate('morning_wake')}
                className="cursor-pointer p-2.5 min-h-[5.5rem] bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/50 rounded-xl text-left transition-all flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between">
                  <Sun className="ui-icon-sm text-amber-400" aria-hidden="true" />
                  <Plus className="ui-icon-sm text-slate-500 group-hover:text-amber-400 transition-colors" aria-hidden="true" />
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold text-slate-200 group-hover:text-amber-300">{t('auto.tpl.morning')}</div>
                  <div className="text-xs text-slate-400 mt-0.5">07:00 → 85% + ^_^</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAddFromTemplate('pir_look_around')}
                className="cursor-pointer p-2.5 min-h-[5.5rem] bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/50 rounded-xl text-left transition-all flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between">
                  <Eye className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                  <Plus className="ui-icon-sm text-slate-500 group-hover:text-cyan-400 transition-colors" aria-hidden="true" />
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold text-slate-200 group-hover:text-cyan-300">{t('auto.tpl.pir')}</div>
                  <div className="text-xs text-slate-400 mt-0.5">GPIO 14</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAddFromTemplate('usb_pc_monitor')}
                className="cursor-pointer p-2.5 min-h-[5.5rem] bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/50 rounded-xl text-left transition-all flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between">
                  <Usb className="ui-icon-sm text-emerald-400" aria-hidden="true" />
                  <Plus className="ui-icon-sm text-slate-500 group-hover:text-emerald-400 transition-colors" aria-hidden="true" />
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold text-slate-200 group-hover:text-emerald-300">{t('auto.tpl.usb')}</div>
                  <div className="text-xs text-slate-400 mt-0.5">USB-C</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAddFromTemplate('dusk_lux')}
                className="cursor-pointer p-2.5 min-h-[5.5rem] bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-teal-500/50 rounded-xl text-left transition-all flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between">
                  <Sliders className="ui-icon-sm text-teal-400" aria-hidden="true" />
                  <Plus className="ui-icon-sm text-slate-500 group-hover:text-teal-400 transition-colors" aria-hidden="true" />
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold text-slate-200 group-hover:text-teal-300">LDR &lt; 35 lx</div>
                  <div className="text-xs text-slate-400 mt-0.5">→ 25%</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAddFromTemplate('temp_alarm')}
                className="cursor-pointer p-2.5 min-h-[5.5rem] bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-rose-500/50 rounded-xl text-left transition-all flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between">
                  <Flame className="ui-icon-sm text-rose-400" aria-hidden="true" />
                  <Plus className="ui-icon-sm text-slate-500 group-hover:text-rose-400 transition-colors" aria-hidden="true" />
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold text-slate-200 group-hover:text-rose-300">{t('auto.tpl.temp')}</div>
                  <div className="text-xs text-slate-400 mt-0.5">&gt; 30°C</div>
                </div>
              </button>
            </div>
          </div>

          {/* Kreator Nowej Reguły (Rozwijany) */}
          {isAddingRule && (
            <div className="p-5 bg-slate-900 border-2 border-cyan-500/50 rounded-2xl shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="ui-type-title text-slate-100 flex items-center gap-2">
                  <Sparkles className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                  {t('auto.ruleCreator')}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddingRule(false)}
                  className="cursor-pointer text-xs text-slate-400 hover:text-slate-200"
                >
                  {t('common.cancel')}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Rule Name */}
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-400 block mb-1">{t('auto.ruleCreator')}:</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                    placeholder="np. Zwierzak mruga po wykryciu ruchu"
                  />
                </div>

                {/* Trigger (Kiedy) */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-3">
                  <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider font-mono">
                    1. KIEDY (Wyzwalacz / Trigger):
                  </span>
                  <div>
                    <label className="ui-type-micro text-slate-400">Typ zdarzenia:</label>
                    <select
                      value={newTriggerType}
                      onChange={e => setNewTriggerType(e.target.value as TriggerType)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                    >
                      <option value="time_is">Zegar Czasu Rzeczywistego NTP == Godzina</option>
                      <option value="pir_motion">Czujnik Ruchu PIR (Wykryto obecność)</option>
                      <option value="light_lux_below">Czujnik Światła LDR &lt; Próg lux (Ciemność)</option>
                      <option value="boot_button_pressed">Wciśnięcie Przycisku BOOT (GPIO 0)</option>
                      <option value="temp_above">Temperatura DHT22 &gt; Próg °C</option>
                      <option value="usb_connected">Podłączenie Kabla USB-C do komputera</option>
                    </select>
                  </div>

                  {newTriggerType === 'time_is' && (
                    <div className="flex flex-col gap-2">
                      <label className="ui-type-micro text-slate-400">Ustaw godzinę (HH:MM):</label>
                      <input
                        type="time"
                        value={newTriggerTime}
                        onChange={e => setNewTriggerTime(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {TIME_PRESETS.map(preset => (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => setNewTriggerTime(preset.value)}
                            className={`px-2 py-0.5 rounded ui-type-micro font-mono transition-colors ${
                              newTriggerTime === preset.value
                                ? 'bg-cyan-500 text-slate-950 font-bold'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {newTriggerType === 'light_lux_below' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between ui-type-micro">
                        <span className="text-slate-400">Próg jasności (lux):</span>
                        <span className="font-mono text-cyan-400 font-bold">{newTriggerThreshold} lx</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1000"
                        step="10"
                        value={newTriggerThreshold}
                        onChange={e => setNewTriggerThreshold(Number(e.target.value))}
                        className="w-full accent-cyan-400"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {LUX_PRESETS.map(preset => (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => setNewTriggerThreshold(preset.value)}
                            className={`px-2 py-0.5 rounded ui-type-micro font-mono transition-colors ${
                              newTriggerThreshold === preset.value
                                ? 'bg-cyan-500 text-slate-950 font-bold'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {newTriggerType === 'temp_above' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between ui-type-micro">
                        <span className="text-slate-400">Próg temperatury:</span>
                        <span className="font-mono text-rose-400 font-bold">{newTriggerThreshold} °C</span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="45"
                        value={newTriggerThreshold}
                        onChange={e => setNewTriggerThreshold(Number(e.target.value))}
                        className="w-full accent-rose-400"
                      />
                      <div className="flex gap-1.5">
                        {TEMP_PRESETS.map(p => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setNewTriggerThreshold(p.value)}
                            className={`px-2 py-0.5 rounded ui-type-micro font-mono transition-colors ${
                              newTriggerThreshold === p.value
                                ? 'bg-rose-500 text-slate-950 font-bold'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {newTriggerType === 'pir_motion' && (
                    <div className="flex flex-col gap-1.5">
                      <label className="ui-type-micro text-slate-400">Pin wejściowy PIR:</label>
                      <div className="flex flex-wrap gap-1.5">
                        {[14, 13, 12, 27, 4].map(pin => (
                          <button
                            key={pin}
                            type="button"
                            onClick={() => setNewTriggerPin(pin)}
                            className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors ${
                              newTriggerPin === pin 
                                ? 'bg-cyan-500 text-slate-950' 
                                : 'bg-slate-900 text-slate-400 border border-slate-800'
                            }`}
                          >
                            GPIO {pin}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action (To wtedy) */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-3">
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider font-mono">
                    2. TO WTEDY (Akcja / Action):
                  </span>
                  <div>
                    <label className="ui-type-micro text-slate-400">Typ akcji:</label>
                    <select
                      value={newActionType}
                      onChange={e => setNewActionType(e.target.value as ActionType)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                    >
                      <option value="set_brightness">Zmień jasność ekranu (PWM)</option>
                      <option value="set_pet_mood">Ustaw nastrój Cyber-Zwierzaka</option>
                      <option value="switch_screen">Przełącz aktywny ekran LCD/OLED</option>
                      <option value="wake_display">Wybudź urządzenie ze stanu uśpienia</option>
                    </select>
                  </div>

                  {newActionType === 'set_brightness' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between ui-type-micro">
                        <span className="text-slate-400">Poziom jasności ekranu:</span>
                        <span className="font-mono text-cyan-400 font-bold">{newActionBrightness}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={newActionBrightness}
                        onChange={e => setNewActionBrightness(Number(e.target.value))}
                        className="w-full accent-cyan-400"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {BRIGHTNESS_PRESETS.map(preset => (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => setNewActionBrightness(preset.value)}
                            className={`px-2 py-0.5 rounded ui-type-micro font-mono transition-colors ${
                              newActionBrightness === preset.value
                                ? 'bg-cyan-500 text-slate-950 font-bold'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {newActionType === 'set_pet_mood' && (
                    <div>
                      <label className="ui-type-micro text-slate-400 block mb-1">Nastrój / Zachowanie zwierzaka:</label>
                      <select
                        value={newActionMood}
                        onChange={e => setNewActionMood(e.target.value as PetMood)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                      >
                        <option value="look_around">Rozglądanie się (Look around)</option>
                        <option value="look_up">Patrzenie do góry (Look up)</option>
                        <option value="look_left">Zerkanie w lewo (Look left)</option>
                        <option value="look_right">Zerkanie w prawo (Look right)</option>
                        <option value="yawn">Ziewanie (Yawn)</option>
                        <option value="sleep">Zasypianie / Sen (Zzz)</option>
                        <option value="crazy">Zaczyna wariować (Crazy)</option>
                        <option value="dizzy">Zakręcone oczy (Dizzy)</option>
                        <option value="happy">Szczęśliwy ^_^</option>
                        <option value="surprised">Zaskoczony O_O</option>
                        <option value="blink">Mruga</option>
                        <option value="angry">Zły &gt;_&lt;</option>
                        <option value="neutral">Neutralny</option>
                      </select>
                    </div>
                  )}

                  {newActionType === 'switch_screen' && (
                    <div>
                      <label className="ui-type-micro text-slate-400 block mb-1">Docelowy ekran:</label>
                      <select
                        value={newActionScreenId}
                        onChange={e => setNewActionScreenId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                      >
                        {screens.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setIsAddingRule(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleCreateRule}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow"
                >
                  Zapisz Regułę
                </button>
              </div>
            </div>
          )}

          {/* Lista Klocków Reguł z Bezpośrednią Edycją Parametrów */}
          <div className="flex flex-col gap-3">
            {automations.map(rule => {
              const isExpanded = expandedRuleId === rule.id;

              return (
                <div
                  key={rule.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    rule.enabled 
                      ? 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-md' 
                      : 'bg-slate-900/50 border-slate-800/50 opacity-65'
                  }`}
                >
                  {/* Nagłówek Reguły */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => handleToggleRule(rule.id)}
                        className="w-4 h-4 text-cyan-500 rounded bg-slate-950 border-slate-700 focus:ring-0 cursor-pointer"
                        title={rule.enabled ? 'Wyłącz regułę' : 'Włącz regułę'}
                      />
                      
                      {/* Inline Rule Name */}
                      <input
                        type="text"
                        value={rule.name}
                        onChange={e => handleUpdateRule(rule.id, r => ({ ...r, name: e.target.value }))}
                        className="bg-transparent border border-transparent hover:border-slate-700 focus:border-cyan-500 rounded px-2 py-0.5 text-xs font-bold text-slate-100 flex-1 transition-colors"
                      />

                      <span className={`ui-type-micro font-mono px-2 py-0.5 rounded ${
                        rule.enabled ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {rule.enabled ? 'AKTYWNA' : 'WYŁĄCZONA'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleTestRule(rule)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                        title="Uruchom regułę w symulatorze"
                      >
                        <Play className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                        <span>Testuj</span>
                      </button>

                      <button
                        onClick={() => handleDuplicateRule(rule)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
                        title="Duplikuj regułę"
                      >
                        <Copy className="ui-icon-sm" aria-hidden="true" />
                      </button>

                      <button
                        onClick={() => setExpandedRuleId(isExpanded ? null : rule.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
                        title="Rozwiń szybką edycję parametrów"
                      >
                        <Sliders className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                        {isExpanded ? <ChevronUp className="ui-icon-sm" aria-hidden="true" /> : <ChevronDown className="ui-icon-sm" aria-hidden="true" />}
                      </button>

                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-2 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                        title="Usuń"
                      >
                        <Trash2 className="ui-icon-sm" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Rozwijany / Bezpośredni Panel Edycji Parametrów Reguły */}
                  <div className="mt-3.5 flex flex-col gap-3">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                      {/* LEWA STRONA: PARAMETRY KIEDY (Trigger) */}
                      <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-2.5">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                          <span className="text-xs font-bold text-cyan-400 uppercase font-mono flex items-center gap-2">
                            <Sparkles className="ui-icon-sm" aria-hidden="true" />
                            JEŚLI (Wyzwalacz):
                          </span>
                          <select
                            value={rule.trigger.type}
                            onChange={e => handleUpdateRule(rule.id, r => ({
                              ...r,
                              trigger: { ...r.trigger, type: e.target.value as TriggerType }
                            }))}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 ui-type-micro text-slate-200"
                          >
                            <option value="time_is">Godzina NTP == Czas</option>
                            <option value="pir_motion">Ruch PIR (GPIO)</option>
                            <option value="light_lux_below">Światło LDR &lt; lux</option>
                            <option value="boot_button_pressed">Przycisk BOOT (GPIO 0)</option>
                            <option value="temp_above">Temperatura &gt; °C</option>
                            <option value="usb_connected">Wpięcie Kabla USB-C</option>
                          </select>
                        </div>

                        {/* Parametry zależne od Triggera */}
                        {rule.trigger.type === 'time_is' && (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="ui-type-micro text-slate-400">Ustaw godzinę:</span>
                              <input
                                type="time"
                                value={rule.trigger.time || '22:00'}
                                onChange={e => handleUpdateRule(rule.id, r => ({
                                  ...r,
                                  trigger: { ...r.trigger, time: e.target.value }
                                }))}
                                className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-cyan-300 font-mono"
                              />
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {TIME_PRESETS.map(p => (
                                <button
                                  key={p.value}
                                  type="button"
                                  onClick={() => handleUpdateRule(rule.id, r => ({
                                    ...r,
                                    trigger: { ...r.trigger, time: p.value }
                                  }))}
                                  className={`px-2 py-0.5 rounded ui-type-micro font-mono transition-colors ${
                                    rule.trigger.time === p.value
                                      ? 'bg-cyan-500 text-slate-950 font-bold'
                                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                                  }`}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {rule.trigger.type === 'light_lux_below' && (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="ui-type-micro text-slate-400">Próg światła (lux):</span>
                              <span className="font-mono text-cyan-300 font-bold">{rule.trigger.threshold ?? 20} lx</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1000"
                              step="5"
                              value={rule.trigger.threshold ?? 20}
                              onChange={e => handleUpdateRule(rule.id, r => ({
                                ...r,
                                trigger: { ...r.trigger, threshold: Number(e.target.value) }
                              }))}
                              className="w-full accent-cyan-400"
                            />
                            <div className="flex flex-wrap gap-1">
                              {LUX_PRESETS.map(p => (
                                <button
                                  key={p.value}
                                  type="button"
                                  onClick={() => handleUpdateRule(rule.id, r => ({
                                    ...r,
                                    trigger: { ...r.trigger, threshold: p.value }
                                  }))}
                                  className={`px-2 py-0.5 rounded ui-type-micro font-mono transition-colors ${
                                    rule.trigger.threshold === p.value
                                      ? 'bg-cyan-500 text-slate-950 font-bold'
                                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                                  }`}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {rule.trigger.type === 'pir_motion' && (
                          <div className="flex items-center justify-between">
                            <span className="ui-type-micro text-slate-400">Pin czujnika ruchu:</span>
                            <div className="flex gap-1">
                              {[14, 13, 12, 27, 4].map(pin => (
                                <button
                                  key={pin}
                                  type="button"
                                  onClick={() => handleUpdateRule(rule.id, r => ({
                                    ...r,
                                    trigger: { ...r.trigger, gpioPin: pin }
                                  }))}
                                  className={`px-2 py-0.5 rounded ui-type-micro font-mono ${
                                    (rule.trigger.gpioPin || 14) === pin
                                      ? 'bg-cyan-500 text-slate-950 font-bold'
                                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                                  }`}
                                >
                                  GPIO {pin}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {rule.trigger.type === 'temp_above' && (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="ui-type-micro text-slate-400">Próg temperatury:</span>
                              <span className="font-mono text-rose-400 font-bold">{rule.trigger.threshold ?? 30} °C</span>
                            </div>
                            <input
                              type="range"
                              min="15"
                              max="45"
                              value={rule.trigger.threshold ?? 30}
                              onChange={e => handleUpdateRule(rule.id, r => ({
                                ...r,
                                trigger: { ...r.trigger, threshold: Number(e.target.value) }
                              }))}
                              className="w-full accent-rose-400"
                            />
                            <div className="flex gap-1">
                              {TEMP_PRESETS.map(p => (
                                <button
                                  key={p.value}
                                  type="button"
                                  onClick={() => handleUpdateRule(rule.id, r => ({
                                    ...r,
                                    trigger: { ...r.trigger, threshold: p.value }
                                  }))}
                                  className={`px-2 py-0.5 rounded ui-type-micro font-mono ${
                                    rule.trigger.threshold === p.value
                                      ? 'bg-rose-500 text-slate-950 font-bold'
                                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                                  }`}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {rule.trigger.type === 'usb_connected' && (
                          <div className="text-xs text-slate-400 flex items-center gap-2">
                            <Usb className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                            <span>Wykrywanie podłączenia kabla USB-C do portu COM/komputera</span>
                          </div>
                        )}

                        {rule.trigger.type === 'boot_button_pressed' && (
                          <div className="text-xs text-slate-400 flex items-center gap-2">
                            <Zap className="ui-icon-sm text-amber-400" aria-hidden="true" />
                            <span>Wciśnięcie przycisku BOOT na płytce (GPIO 0)</span>
                          </div>
                        )}
                      </div>

                      {/* PRAWA STRONA: PARAMETRY TO WTEDY (Action) */}
                      <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-2.5">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                          <span className="text-xs font-bold text-emerald-400 uppercase font-mono flex items-center gap-2">
                            <Activity className="ui-icon-sm" aria-hidden="true" />
                            TO WTEDY (Akcja):
                          </span>
                          <select
                            value={rule.action.type}
                            onChange={e => handleUpdateRule(rule.id, r => ({
                              ...r,
                              action: { ...r.action, type: e.target.value as ActionType }
                            }))}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 ui-type-micro text-slate-200"
                          >
                            <option value="set_brightness">Zmień jasność ekranu (PWM)</option>
                            <option value="set_pet_mood">Zmień nastrój zwierzaka</option>
                            <option value="switch_screen">Przełącz ekran</option>
                            <option value="wake_display">Wybudź urządzenie</option>
                          </select>
                        </div>

                        {/* Parametry zależne od Akcji */}
                        {rule.action.type === 'set_brightness' && (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="ui-type-micro text-slate-400">Jasność ekranu:</span>
                              <span className="font-mono text-cyan-300 font-bold">{rule.action.brightness ?? 20}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={rule.action.brightness ?? 20}
                              onChange={e => handleUpdateRule(rule.id, r => ({
                                ...r,
                                action: { ...r.action, brightness: Number(e.target.value) }
                              }))}
                              className="w-full accent-cyan-400"
                            />
                            <div className="flex flex-wrap gap-1">
                              {BRIGHTNESS_PRESETS.map(p => (
                                <button
                                  key={p.value}
                                  type="button"
                                  onClick={() => handleUpdateRule(rule.id, r => ({
                                    ...r,
                                    action: { ...r.action, brightness: p.value }
                                  }))}
                                  className={`px-2 py-0.5 rounded ui-type-micro font-mono transition-colors ${
                                    rule.action.brightness === p.value
                                      ? 'bg-cyan-500 text-slate-950 font-bold'
                                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                                  }`}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {rule.action.type === 'set_pet_mood' && (
                          <div className="flex flex-col gap-1.5">
                            <label className="ui-type-micro text-slate-400">Wybierz nastrój zwierzaka:</label>
                            <select
                              value={rule.action.petMood || 'neutral'}
                              onChange={e => handleUpdateRule(rule.id, r => ({
                                ...r,
                                action: { ...r.action, petMood: e.target.value as PetMood }
                              }))}
                              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200"
                            >
                              <option value="look_around">Rozglądanie się (Look around)</option>
                              <option value="look_up">Patrzenie do góry (Look up)</option>
                              <option value="look_left">Zerkanie w lewo (Look left)</option>
                              <option value="look_right">Zerkanie w prawo (Look right)</option>
                              <option value="yawn">Ziewanie (Yawn)</option>
                              <option value="sleep">Sen (Zzz)</option>
                              <option value="crazy">Zaczyna wariować (Crazy)</option>
                              <option value="dizzy">Zakręcone oczy (Dizzy)</option>
                              <option value="happy">Uśmiech ^_^</option>
                              <option value="surprised">Zaskoczenie O_O</option>
                              <option value="blink">Mruganie</option>
                              <option value="angry">Zły &gt;_&lt;</option>
                              <option value="neutral">Neutralny</option>
                            </select>
                          </div>
                        )}

                        {rule.action.type === 'switch_screen' && (
                          <div className="flex flex-col gap-1.5">
                            <label className="ui-type-micro text-slate-400">Wybierz docelowy ekran:</label>
                            <select
                              value={rule.action.targetScreenId || screens[0]?.id}
                              onChange={e => handleUpdateRule(rule.id, r => ({
                                ...r,
                                action: { ...r.action, targetScreenId: e.target.value }
                              }))}
                              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200"
                            >
                              {screens.map((s, idx) => (
                                <option key={s.id} value={s.id}>
                                  Ekran #{idx + 1}: {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {rule.action.type === 'wake_display' && (
                          <div className="text-xs text-slate-400 flex items-center gap-2">
                            <Sun className="ui-icon-sm text-amber-400" aria-hidden="true" />
                            <span>Wybudzenie ekranu ze stanu uśpienia (Wakeup) i reset timera aktywności</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeTab === 'timeline' ? (
        /* ============================================================================== */
        /*  ZAKŁADKA 2: OŚ CZASU I GENERATOR ZACHOWAŃ ZWIERZAKA (TIMELINE)               */
        /* ============================================================================== */
        <div className="flex flex-col gap-6">
          {/* Sekcja 1: Generator Scenariuszy i Presety */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Lewa kolumna: Szybkie Gotowe Presety (Wielominutowe) */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Wand2 className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                  {t('auto.presets')}
                </span>
                <span className="ui-type-micro text-cyan-400 font-mono">1×</span>
              </div>
              <p className="ui-type-micro text-slate-400">
                {t('auto.timelineHint')}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() => handleApplyPreset('morning_wake')}
                  className="flex flex-col text-left p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-400 flex items-center gap-2">
                      <Sun className="ui-icon-sm text-amber-400" aria-hidden="true" />
                      Poranne Przebudzenie
                    </span>
                    <span className="text-xs font-mono text-cyan-400 font-bold px-2 py-0.5 bg-cyan-950/60 rounded">3 min</span>
                  </div>
                  <span className="text-xs text-slate-400 mt-1 line-clamp-2">
                    Sen $\rightarrow$ ziewanie $\rightarrow$ mruganie $\rightarrow$ rozglądanie się $\rightarrow$ patrzenie w górę $\rightarrow$ radość.
                  </span>
                </button>

                <button
                  onClick={() => handleApplyPreset('curious_explorer')}
                  className="flex flex-col text-left p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-400 flex items-center gap-2">
                      <Compass className="ui-icon-sm text-teal-400" aria-hidden="true" />
                      Ciekawski Robot
                    </span>
                    <span className="text-xs font-mono text-cyan-400 font-bold px-2 py-0.5 bg-cyan-950/60 rounded">5 min</span>
                  </div>
                  <span className="text-xs text-slate-400 mt-1 line-clamp-2">
                    Rozglądanie $\rightarrow$ zerkanie w lewo/prawo $\rightarrow$ w górę $\rightarrow$ wariuje $\rightarrow$ wirujące oczy $\rightarrow$ ziewnięcie.
                  </span>
                </button>

                <button
                  onClick={() => handleApplyPreset('evening_sleep')}
                  className="flex flex-col text-left p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-400 flex items-center gap-2">
                      <Moon className="ui-icon-sm text-purple-400" aria-hidden="true" />
                      Wieczorne Zasypianie
                    </span>
                    <span className="text-xs font-mono text-cyan-400 font-bold px-2 py-0.5 bg-cyan-950/60 rounded">4 min</span>
                  </div>
                  <span className="text-xs text-slate-400 mt-1 line-clamp-2">
                    Czuwanie $\rightarrow$ ziewanie $\rightarrow$ ciężkie powieki $\rightarrow$ drugie ziewnięcie $\rightarrow$ głęboki sen z Zzz.
                  </span>
                </button>

                <button
                  onClick={() => handleApplyPreset('crazy_party')}
                  className="flex flex-col text-left p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-400 flex items-center gap-2">
                      <Flame className="ui-icon-sm text-rose-400" aria-hidden="true" />
                      Pełne Szaleństwo!
                    </span>
                    <span className="text-xs font-mono text-cyan-400 font-bold px-2 py-0.5 bg-cyan-950/60 rounded">2 min</span>
                  </div>
                  <span className="text-xs text-slate-400 mt-1 line-clamp-2">
                    Zaskoczenie $\rightarrow$ zaczyna wariować $\rightarrow$ wirówka źrenic $\rightarrow$ błyskawiczny skan $\rightarrow$ uśmiech.
                  </span>
                </button>
              </div>
            </div>

            {/* Środkowa kolumna: Generator Własnego Harmonogramu */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="ui-icon-sm text-emerald-400" aria-hidden="true" />
                    Generator Czasowy
                  </span>
                  <span className="ui-type-micro text-emerald-400 font-mono">Algorytmiczny</span>
                </div>
                <p className="ui-type-micro text-slate-400 mt-1">
                  Wygeneruj spersonalizowany harmonogram zachowań o żądanym czasie trwania i temperamencie:
                </p>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="ui-type-micro font-medium text-slate-400 block mb-1">Długość osi czasu:</label>
                    <select
                      value={generatorMinutes}
                      onChange={e => setGeneratorMinutes(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 font-mono"
                    >
                      <option value={1}>1 minuta (60s)</option>
                      <option value={2}>2 minuty (120s)</option>
                      <option value={3}>3 minuty (180s)</option>
                      <option value={5}>5 minut (300s)</option>
                      <option value={10}>10 minut (600s)</option>
                    </select>
                  </div>

                  <div>
                    <label className="ui-type-micro font-medium text-slate-400 block mb-1">Temperament zwierzaka:</label>
                    <select
                      value={generatorPersonality}
                      onChange={e => setGeneratorPersonality(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100"
                    >
                      <option value="balanced">Zrównoważony</option>
                      <option value="curious">Ciekawski / Odkrywca</option>
                      <option value="crazy">Nadpobudliwy / Szalony</option>
                      <option value="sleepy">Senny / Leniwy</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={handleGenerateCustomTimeline}
                className="w-full mt-2 py-2 px-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="ui-icon-sm text-slate-950" aria-hidden="true" />
                <span>Wygeneruj Harmonogram ({generatorMinutes} min)</span>
              </button>
            </div>

            {/* Prawa kolumna: Live Ekran OLED Robot Face Preview */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-between gap-3">
              <div className="w-full flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Tv className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                  Wirtualna Matryca Robot Face
                </span>
                <span className="ui-type-micro font-mono px-2 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800 rounded">
                  {currentActiveStep?.behavior?.toUpperCase() || 'NEUTRAL'}
                </span>
              </div>

              {/* Canvas Ekranika */}
              <div className="relative p-2 bg-slate-950 border-2 border-slate-800 rounded-xl shadow-inner flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={220}
                  height={100}
                  className="rounded-lg shadow-lg border border-cyan-500/20"
                />
                <div className="absolute top-3 left-4 ui-type-micro font-mono text-cyan-400/70 tracking-wider">
                  SSD1306 OLED 128x64
                </div>
                <div className="absolute bottom-3 right-4 ui-type-micro font-mono font-bold text-cyan-300">
                  {formatTime(currentTimeSec)} / {formatTime(totalDurationSec)}
                </div>
              </div>

              {/* Informacja o aktualnym zachowaniu */}
              <div className="w-full flex items-center justify-between text-xs px-1">
                <div className="flex flex-col">
                  <span className="text-slate-400 ui-type-micro">Aktualne zachowanie:</span>
                  <span className="text-slate-100 font-bold truncate max-w-[140px]">
                    {currentActiveStep?.name || 'Czuwanie'}
                  </span>
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer ui-type-micro text-slate-300">
                  <input
                    type="checkbox"
                    checked={syncWithSimulator}
                    onChange={e => setSyncWithSimulator(e.target.checked)}
                    className="rounded text-cyan-500 focus:ring-0 focus:outline-none ui-focus-ring"
                  />
                  <span>Sync z ESP32</span>
                </label>
              </div>
            </div>
          </div>

          {/* Sekcja 2: Kontroler Odtwarzania i Scrubber Osi Czasu */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Przyciski Odtwarzacza */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`p-2.5 rounded-xl font-bold transition-all shadow flex items-center gap-1.5 text-xs ${
                    isPlaying 
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' 
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  }`}
                  title={isPlaying ? 'Pauza' : 'Odtwarzaj'}
                >
                  {isPlaying ? <Pause className="ui-icon-sm fill-current" aria-hidden="true" /> : <Play className="ui-icon-sm fill-current" aria-hidden="true" />}
                  <span>{isPlaying ? 'Pauza' : 'Odtwarzaj'}</span>
                </button>

                <button
                  onClick={() => setCurrentTimeSec(0)}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors text-xs flex items-center gap-1"
                  title="Przewiń do 00:00"
                >
                  <RotateCcw className="ui-icon-sm" aria-hidden="true" />
                  <span className="hidden sm:inline">Od początku</span>
                </button>

                <button
                  onClick={() => {
                    const currentIndex = timedSteps.findIndex(s => currentTimeSec >= s.start && currentTimeSec < s.end);
                    if (currentIndex > 0) {
                      setCurrentTimeSec(timedSteps[currentIndex - 1].start);
                    } else {
                      setCurrentTimeSec(0);
                    }
                  }}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
                  title="Poprzedni krok"
                >
                  <SkipBack className="ui-icon-sm" aria-hidden="true" />
                </button>

                <button
                  onClick={() => {
                    const currentIndex = timedSteps.findIndex(s => currentTimeSec >= s.start && currentTimeSec < s.end);
                    if (currentIndex >= 0 && currentIndex < timedSteps.length - 1) {
                      setCurrentTimeSec(timedSteps[currentIndex + 1].start);
                    }
                  }}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
                  title="Następny krok"
                >
                  <SkipForward className="ui-icon-sm" aria-hidden="true" />
                </button>
              </div>

              {/* Wyświetlacz czasu i prędkość odtwarzania */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 font-mono text-sm px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <Clock className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                  <span className="text-cyan-400 font-bold">{formatTime(currentTimeSec)}</span>
                  <span className="text-slate-500">/</span>
                  <span className="text-slate-400">{formatTime(totalDurationSec)}</span>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                  <span className="ui-type-micro text-slate-500 uppercase px-2 font-mono">Prędkość:</span>
                  {[1, 2, 5, 10].map(speed => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`px-2 py-1 rounded-lg font-mono font-bold text-xs transition-colors ${
                        playbackSpeed === speed 
                          ? 'bg-cyan-500 text-slate-950' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Wizualny segmentowy pasek osi czasu (Timeline Bar) */}
            <div className="relative w-full mt-2">
              <div className="w-full h-8 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex relative">
                {timedSteps.map((step, idx) => {
                  const widthPercent = (step.durationSec / totalDurationSec) * 100;
                  const isCurrent = currentTimeSec >= step.start && currentTimeSec < step.end;

                  return (
                    <div
                      key={step.id || idx}
                      onClick={() => setCurrentTimeSec(step.start)}
                      style={{ width: `${widthPercent}%` }}
                      className={`h-full border-r border-slate-900/80 cursor-pointer relative group transition-all flex items-center px-1.5 overflow-hidden ${
                        isCurrent 
                          ? 'bg-cyan-500/30 ring-2 ring-cyan-400 z-10' 
                          : 'bg-slate-800/40 hover:bg-slate-700/60'
                      }`}
                      title={`${step.name} (${step.durationSec}s) - kliknij aby przeskoczyć`}
                    >
                      <span className="ui-type-micro font-medium text-slate-300 truncate select-none group-hover:text-cyan-300">
                        {step.name}
                      </span>
                    </div>
                  );
                })}

                {/* Kursor Scrubbera (Głowica Odtwarzacza) */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] z-20 pointer-events-none transition-all duration-75"
                  style={{ left: `${(currentTimeSec / (totalDurationSec || 1)) * 100}%` }}
                />
              </div>

              {/* Płynny suwak Scrubbera */}
              <input
                type="range"
                min={0}
                max={Math.max(1, totalDurationSec)}
                step={0.5}
                value={currentTimeSec}
                onChange={e => setCurrentTimeSec(parseFloat(e.target.value))}
                className="w-full mt-1.5 accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Sekcja 3: Lista Kroków i Edytor Sekwencji */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Lewe 2 kolumny: Tabela/Karty kroków */}
            <div className="lg:col-span-2 p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                  Kroki Sekwencji Zachowań ({timelineSteps.length} kroków • {formatTime(totalDurationSec)})
                </span>
                <span className="ui-type-micro text-slate-400">
                  Edytuj czas, kolejność lub zachowanie
                </span>
              </div>

              <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
                {timedSteps.map((step, index) => {
                  const isCurrent = currentTimeSec >= step.start && currentTimeSec < step.end;

                  return (
                    <div
                      key={step.id || index}
                      className={`p-3 rounded-xl border transition-all flex flex-wrap items-center justify-between gap-3 ${
                        isCurrent 
                          ? 'bg-slate-950 border-cyan-500 shadow-md ring-1 ring-cyan-500/40' 
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <span className="text-xs font-mono font-bold text-slate-500 w-6">
                          #{index + 1}
                        </span>

                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-100">
                              {step.name}
                            </span>
                            <span className={`ui-type-micro font-mono px-2 py-0.5 rounded border uppercase ${getBehaviorBadgeColor(step.behavior)}`}>
                              {step.behavior}
                            </span>
                          </div>
                          <span className="ui-type-micro text-slate-400 mt-0.5">
                            {step.description}
                          </span>
                        </div>
                      </div>

                      {/* Zmiana czasu trwania i zachowania */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="ui-type-micro text-slate-400">Trwanie:</span>
                          <input
                            type="number"
                            min={2}
                            max={600}
                            value={step.durationSec}
                            onChange={e => handleDurationChange(step.id, Number(e.target.value))}
                            className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 font-mono text-center"
                          />
                          <span className="text-xs font-mono text-slate-400">sek</span>
                        </div>

                        <select
                          value={step.behavior}
                          onChange={e => handleBehaviorChange(step.id, e.target.value as PetBehaviorType)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                        >
                          <option value="look_around">Rozglądanie się</option>
                          <option value="look_up">Patrzenie do góry</option>
                          <option value="look_left">Zerkanie w lewo</option>
                          <option value="look_right">Zerkanie w prawo</option>
                          <option value="yawn">Ziewanie</option>
                          <option value="sleep">Sen (Zzz)</option>
                          <option value="crazy">Zaczyna wariować</option>
                          <option value="dizzy">Zakręcenie / Wirowanie</option>
                          <option value="happy">Uśmiech ^_^</option>
                          <option value="surprised">Zaskoczenie O_O</option>
                          <option value="blink">Mruganie</option>
                          <option value="angry">Groźne spojrzenie</option>
                          <option value="neutral">Neutralne czuwanie</option>
                        </select>

                        {/* Reorder and Delete buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMoveStep(index, 'up')}
                            disabled={index === 0}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded-lg transition-colors"
                            title="Przesuń w górę"
                          >
                            <MoveUp className="ui-icon-sm" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => handleMoveStep(index, 'down')}
                            disabled={index === timedSteps.length - 1}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded-lg transition-colors"
                            title="Przesuń w dół"
                          >
                            <MoveDown className="ui-icon-sm" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => handleDeleteStep(step.id)}
                            disabled={timelineSteps.length <= 1}
                            className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 disabled:opacity-30 rounded-lg transition-colors"
                            title="Usuń krok"
                          >
                            <Trash2 className="ui-icon-sm" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Prawa kolumna: Formularz dodania nowego kroku do osi */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Plus className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                    Dodaj Krok do Osi
                  </span>
                </div>

                <div className="flex flex-col gap-3 mt-3">
                  <div>
                    <label className="ui-type-micro font-medium text-slate-400 block mb-1">Zachowanie:</label>
                    <select
                      value={newStepBehavior}
                      onChange={e => {
                        const beh = e.target.value as PetBehaviorType;
                        setNewStepBehavior(beh);
                        if (beh === 'look_around') { setNewStepName('Płynne rozglądanie się'); setNewStepDesc('Robot wodzi wzrokiem po otoczeniu'); }
                        else if (beh === 'look_up') { setNewStepName('Patrzenie w sufit'); setNewStepDesc('Oczy skierowane wysoko w górę'); }
                        else if (beh === 'look_left') { setNewStepName('Zerkanie w lewo'); setNewStepDesc('Skanowanie lewego sektora'); }
                        else if (beh === 'look_right') { setNewStepName('Zerkanie w prawo'); setNewStepDesc('Skanowanie prawego sektora'); }
                        else if (beh === 'yawn') { setNewStepName('Głębokie ziewnięcie'); setNewStepDesc('Otwarcie ust i przymknięcie oczu'); }
                        else if (beh === 'sleep') { setNewStepName('Zasypianie i sen'); setNewStepDesc('Zamknięte oczy z animacją Zzz'); }
                        else if (beh === 'crazy') { setNewStepName('Zaczyna wariować!'); setNewStepDesc('Chaos, wibrujące oczy, skaczące źrenice'); }
                        else if (beh === 'dizzy') { setNewStepName('Wirujące oczy'); setNewStepDesc('Źrenice wirujące w kółko'); }
                        else if (beh === 'happy') { setNewStepName('Radosny uśmiech ^_^'); setNewStepDesc('Wygięte łuki i zadowolenie'); }
                        else if (beh === 'surprised') { setNewStepName('Wielkie zaskoczenie O_O'); setNewStepDesc('Szerokie oczy z małą źrenicą'); }
                        else if (beh === 'blink') { setNewStepName('Szybkie mrugnięcie'); setNewStepDesc('Przymrużenie powiek'); }
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100"
                    >
                      <option value="look_around">Rozglądanie się (Look around)</option>
                      <option value="look_up">Patrzenie do góry (Look up)</option>
                      <option value="look_left">Zerkanie w lewo (Look left)</option>
                      <option value="look_right">Zerkanie w prawo (Look right)</option>
                      <option value="yawn">Ziewanie (Yawn)</option>
                      <option value="sleep">Sen z Zzz (Sleep)</option>
                      <option value="crazy">Zaczyna wariować (Crazy mode)</option>
                      <option value="dizzy">Zakręcenie / Wirujące oczy (Dizzy)</option>
                      <option value="happy">Uśmiech ^_^ (Happy)</option>
                      <option value="surprised">Zaskoczenie O_O (Surprised)</option>
                      <option value="blink">Mruganie (Blink)</option>
                      <option value="angry">Zły robot (Angry)</option>
                      <option value="neutral">Neutralne czuwanie (Neutral)</option>
                    </select>
                  </div>

                  <div>
                    <label className="ui-type-micro font-medium text-slate-400 block mb-1">Czas trwania (sekundy):</label>
                    <input
                      type="number"
                      min={2}
                      max={600}
                      value={newStepDuration}
                      onChange={e => setNewStepDuration(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="ui-type-micro font-medium text-slate-400 block mb-1">Etykieta kroku:</label>
                    <input
                      type="text"
                      value={newStepName}
                      onChange={e => setNewStepName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                      placeholder="np. Zwierzak ziewa"
                    />
                  </div>

                  <div>
                    <label className="ui-type-micro font-medium text-slate-400 block mb-1">Opis zachowania:</label>
                    <input
                      type="text"
                      value={newStepDesc}
                      onChange={e => setNewStepDesc(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                      placeholder="np. Przymyka oczy i otwiera buźkę"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleAddStep}
                className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow"
              >
                <Plus className="ui-icon-sm" aria-hidden="true" />
                <span>Dodaj ten krok na koniec</span>
              </button>
            </div>
          </div>

          {/* Sekcja 4: Gotowy Kod C++ dla ESP32 (Arduino IDE) */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Code className="ui-icon-sm text-cyan-400" aria-hidden="true" />
                  Kod C++ Osi Czasu dla ESP32 (Non-blocking state machine millis)
                </span>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  Wklej ten fragment do pliku projektu .ino w Arduino IDE, aby automatycznie odtwarzać sekwencję w pętli loop().
                </span>
              </div>

              <button
                onClick={handleCopyCpp}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                {copiedCpp ? <Check className="ui-icon-sm text-emerald-400" aria-hidden="true" /> : <Copy className="ui-icon-sm text-slate-400" aria-hidden="true" />}
                <span>{copiedCpp ? 'Skopiowano!' : 'Kopiuj kod C++'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed max-h-60 selection:bg-cyan-500/30">
              {generateCppTimelineCode()}
            </pre>
          </div>
        </div>
      ) : (
        /* ============================================================================== */
        /*  ZAKŁADKA 3: JĘZYK SKRYPTOWY (DSL)                                             */
        /* ============================================================================== */
        <div className="flex flex-col gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
            <span className="text-slate-400 font-mono">Skrypt zdarzeń ESP32 Automation DSL:</span>
            <span className="ui-type-micro text-slate-500">Auto-kompilowane do pętli loop() w C++</span>
          </div>
          <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed selection:bg-cyan-500/30">
            {generateDslText()}
          </pre>
        </div>
      )}
    </div>
  );
};
