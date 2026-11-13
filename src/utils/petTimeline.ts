import type { PetBehaviorType, PetTimelineStep } from '../types';

type T = (key: string) => string;

function step(
  id: string,
  behavior: PetBehaviorType,
  nameKey: string,
  descKey: string,
  durationSec: number,
  t: T,
): PetTimelineStep {
  return {
    id,
    behavior,
    name: t(nameKey),
    description: t(descKey),
    durationSec,
  };
}

/** Default ~3 min balanced cyber-pet timeline (localized). */
export function buildDefaultTimeline(t: T): PetTimelineStep[] {
  return [
    step('step_1', 'sleep', 'pet.step.deepSleep.name', 'pet.step.deepSleep.desc', 25, t),
    step('step_2', 'yawn', 'pet.step.morningYawn.name', 'pet.step.morningYawn.desc', 10, t),
    step('step_3', 'blink', 'pet.step.blinkWake.name', 'pet.step.blinkWake.desc', 10, t),
    step('step_4', 'look_around', 'pet.step.lookAroundScan.name', 'pet.step.lookAroundScan.desc', 25, t),
    step('step_5', 'look_left', 'pet.step.lookLeft.name', 'pet.step.lookLeft.desc', 15, t),
    step('step_6', 'look_right', 'pet.step.lookRight.name', 'pet.step.lookRight.desc', 15, t),
    step('step_7', 'look_up', 'pet.step.lookUp.name', 'pet.step.lookUp.desc', 20, t),
    step('step_8', 'surprised', 'pet.step.surprised.name', 'pet.step.surprised.desc', 10, t),
    step('step_9', 'crazy', 'pet.step.crazy.name', 'pet.step.crazy.desc', 15, t),
    step('step_10', 'dizzy', 'pet.step.dizzy.name', 'pet.step.dizzy.desc', 10, t),
    step('step_11', 'happy', 'pet.step.happy.name', 'pet.step.happy.desc', 15, t),
    step('step_12', 'neutral', 'pet.step.neutralWatch.name', 'pet.step.neutralWatch.desc', 10, t),
  ];
}

export type PetPresetKey = 'morning_wake' | 'curious_explorer' | 'evening_sleep' | 'crazy_party';

export function buildPresetTimeline(presetKey: PetPresetKey, t: T): PetTimelineStep[] {
  const now = Date.now();
  const mk = (
    i: number,
    behavior: PetBehaviorType,
    nameKey: string,
    descKey: string,
    durationSec: number,
  ): PetTimelineStep =>
    step(`step_${now}_${i}`, behavior, nameKey, descKey, durationSec, t);

  switch (presetKey) {
    case 'morning_wake':
      return [
        mk(1, 'sleep', 'pet.preset.morning.1.name', 'pet.preset.morning.1.desc', 35),
        mk(2, 'yawn', 'pet.preset.morning.2.name', 'pet.preset.morning.2.desc', 15),
        mk(3, 'blink', 'pet.preset.morning.3.name', 'pet.preset.morning.3.desc', 15),
        mk(4, 'look_around', 'pet.preset.morning.4.name', 'pet.preset.morning.4.desc', 30),
        mk(5, 'look_up', 'pet.preset.morning.5.name', 'pet.preset.morning.5.desc', 25),
        mk(6, 'happy', 'pet.preset.morning.6.name', 'pet.preset.morning.6.desc', 30),
        mk(7, 'neutral', 'pet.preset.morning.7.name', 'pet.preset.morning.7.desc', 30),
      ];
    case 'curious_explorer':
      return [
        mk(1, 'neutral', 'pet.preset.curious.1.name', 'pet.preset.curious.1.desc', 30),
        mk(2, 'look_around', 'pet.preset.curious.2.name', 'pet.preset.curious.2.desc', 45),
        mk(3, 'look_left', 'pet.preset.curious.3.name', 'pet.preset.curious.3.desc', 30),
        mk(4, 'look_right', 'pet.preset.curious.4.name', 'pet.preset.curious.4.desc', 30),
        mk(5, 'look_up', 'pet.preset.curious.5.name', 'pet.preset.curious.5.desc', 35),
        mk(6, 'surprised', 'pet.preset.curious.6.name', 'pet.preset.curious.6.desc', 20),
        mk(7, 'crazy', 'pet.preset.curious.7.name', 'pet.preset.curious.7.desc', 30),
        mk(8, 'dizzy', 'pet.preset.curious.8.name', 'pet.preset.curious.8.desc', 25),
        mk(9, 'yawn', 'pet.preset.curious.9.name', 'pet.preset.curious.9.desc', 25),
        mk(10, 'sleep', 'pet.preset.curious.10.name', 'pet.preset.curious.10.desc', 30),
      ];
    case 'evening_sleep':
      return [
        mk(1, 'neutral', 'pet.preset.evening.1.name', 'pet.preset.evening.1.desc', 40),
        mk(2, 'look_around', 'pet.preset.evening.2.name', 'pet.preset.evening.2.desc', 35),
        mk(3, 'yawn', 'pet.preset.evening.3.name', 'pet.preset.evening.3.desc', 25),
        mk(4, 'look_left', 'pet.preset.evening.4.name', 'pet.preset.evening.4.desc', 25),
        mk(5, 'yawn', 'pet.preset.evening.5.name', 'pet.preset.evening.5.desc', 25),
        mk(6, 'blink', 'pet.preset.evening.6.name', 'pet.preset.evening.6.desc', 30),
        mk(7, 'sleep', 'pet.preset.evening.7.name', 'pet.preset.evening.7.desc', 60),
      ];
    case 'crazy_party':
      return [
        mk(1, 'neutral', 'pet.preset.party.1.name', 'pet.preset.party.1.desc', 15),
        mk(2, 'surprised', 'pet.preset.party.2.name', 'pet.preset.party.2.desc', 15),
        mk(3, 'crazy', 'pet.preset.party.3.name', 'pet.preset.party.3.desc', 35),
        mk(4, 'dizzy', 'pet.preset.party.4.name', 'pet.preset.party.4.desc', 25),
        mk(5, 'look_around', 'pet.preset.party.5.name', 'pet.preset.party.5.desc', 15),
        mk(6, 'happy', 'pet.preset.party.6.name', 'pet.preset.party.6.desc', 15),
      ];
  }
}

type PoolItem = {
  mood: PetBehaviorType;
  nameKey: string;
  descKey: string;
  durMin: number;
  durMax: number;
};

const POOLS: Record<string, PoolItem[]> = {
  balanced: [
    { mood: 'neutral', nameKey: 'pet.gen.neutral.name', descKey: 'pet.gen.neutral.desc', durMin: 15, durMax: 30 },
    { mood: 'look_around', nameKey: 'pet.gen.lookAround.name', descKey: 'pet.gen.lookAround.desc', durMin: 20, durMax: 40 },
    { mood: 'look_left', nameKey: 'pet.gen.lookLeft.name', descKey: 'pet.gen.lookLeft.desc', durMin: 10, durMax: 20 },
    { mood: 'look_right', nameKey: 'pet.gen.lookRight.name', descKey: 'pet.gen.lookRight.desc', durMin: 10, durMax: 20 },
    { mood: 'look_up', nameKey: 'pet.gen.lookUp.name', descKey: 'pet.gen.lookUp.desc', durMin: 15, durMax: 25 },
    { mood: 'blink', nameKey: 'pet.gen.blink.name', descKey: 'pet.gen.blink.desc', durMin: 10, durMax: 15 },
    { mood: 'happy', nameKey: 'pet.gen.happy.name', descKey: 'pet.gen.happy.desc', durMin: 15, durMax: 25 },
    { mood: 'yawn', nameKey: 'pet.gen.yawn.name', descKey: 'pet.gen.yawn.desc', durMin: 10, durMax: 20 },
    { mood: 'sleep', nameKey: 'pet.gen.sleep.name', descKey: 'pet.gen.sleep.desc', durMin: 20, durMax: 40 },
  ],
  crazy: [
    { mood: 'crazy', nameKey: 'pet.gen.crazy.name', descKey: 'pet.gen.crazy.desc', durMin: 15, durMax: 35 },
    { mood: 'dizzy', nameKey: 'pet.gen.dizzy.name', descKey: 'pet.gen.dizzy.desc', durMin: 15, durMax: 25 },
    { mood: 'look_around', nameKey: 'pet.gen.lookAroundFast.name', descKey: 'pet.gen.lookAroundFast.desc', durMin: 15, durMax: 25 },
    { mood: 'surprised', nameKey: 'pet.gen.surprised.name', descKey: 'pet.gen.surprised.desc', durMin: 10, durMax: 20 },
    { mood: 'happy', nameKey: 'pet.gen.happyWild.name', descKey: 'pet.gen.happyWild.desc', durMin: 15, durMax: 25 },
    { mood: 'look_up', nameKey: 'pet.gen.lookUpBlast.name', descKey: 'pet.gen.lookUpBlast.desc', durMin: 10, durMax: 20 },
  ],
  sleepy: [
    { mood: 'sleep', nameKey: 'pet.gen.deepSleep.name', descKey: 'pet.gen.deepSleep.desc', durMin: 30, durMax: 60 },
    { mood: 'yawn', nameKey: 'pet.gen.bigYawn.name', descKey: 'pet.gen.bigYawn.desc', durMin: 15, durMax: 30 },
    { mood: 'blink', nameKey: 'pet.gen.slowBlink.name', descKey: 'pet.gen.slowBlink.desc', durMin: 10, durMax: 20 },
    { mood: 'look_around', nameKey: 'pet.gen.sleepyLook.name', descKey: 'pet.gen.sleepyLook.desc', durMin: 20, durMax: 35 },
    { mood: 'look_up', nameKey: 'pet.gen.ceilingLook.name', descKey: 'pet.gen.ceilingLook.desc', durMin: 15, durMax: 25 },
  ],
  curious: [
    { mood: 'look_around', nameKey: 'pet.gen.roomScan.name', descKey: 'pet.gen.roomScan.desc', durMin: 25, durMax: 45 },
    { mood: 'look_left', nameKey: 'pet.gen.curiousLeft.name', descKey: 'pet.gen.curiousLeft.desc', durMin: 15, durMax: 30 },
    { mood: 'look_right', nameKey: 'pet.gen.curiousRight.name', descKey: 'pet.gen.curiousRight.desc', durMin: 15, durMax: 30 },
    { mood: 'look_up', nameKey: 'pet.gen.ceilingStudy.name', descKey: 'pet.gen.ceilingStudy.desc', durMin: 20, durMax: 35 },
    { mood: 'surprised', nameKey: 'pet.gen.newObject.name', descKey: 'pet.gen.newObject.desc', durMin: 10, durMax: 20 },
    { mood: 'happy', nameKey: 'pet.gen.discoveryHappy.name', descKey: 'pet.gen.discoveryHappy.desc', durMin: 15, durMax: 25 },
    { mood: 'neutral', nameKey: 'pet.gen.analyze.name', descKey: 'pet.gen.analyze.desc', durMin: 15, durMax: 30 },
  ],
};

export function generateCustomTimeline(
  minutes: number,
  personality: 'balanced' | 'crazy' | 'sleepy' | 'curious',
  t: T,
): PetTimelineStep[] {
  const targetTotalSec = minutes * 60;
  const generated: PetTimelineStep[] = [];
  let currentTotal = 0;
  let stepIndex = 1;
  const pool = POOLS[personality] || POOLS.balanced;

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
      name: t(template.nameKey),
      description: t(template.descKey),
      durationSec: dur,
    });
    currentTotal += dur;
    stepIndex++;
  }

  return generated;
}
