import type { ModeId } from './types';

export interface ModeObjective {
  metric: 'coins' | 'score' | 'time' | 'diamonds' | 'hits' | 'boss';
  target: number;
  label: string;
}

export interface ModeDef {
  id: ModeId;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  /** Seconds of play. null = never ends on its own. */
  duration: number | null;
  spawnRateMultiplier: number;
  speedMultiplier: number;
  dangerBias: number;
  lives: number;
  bossAtStart: boolean;
  bossInterval: number | null;
  objective: ModeObjective | null;
  accent: string;
}

export const MODES: ModeDef[] = [
  {
    id: 'endless',
    name: 'Endless Survival',
    tagline: 'How long can DIGO last?',
    description:
      'The classic run. Hazards fall forever and every 45 seconds DIGO faces a boss. Difficulty keeps climbing.',
    icon: '♾️',
    duration: null,
    spawnRateMultiplier: 1,
    speedMultiplier: 1,
    dangerBias: 0,
    lives: 3,
    bossAtStart: false,
    bossInterval: 45,
    objective: null,
    accent: '#22d3ee',
  },
  {
    id: 'time',
    name: 'Time Challenge',
    tagline: '60 seconds of pure greed',
    description:
      'Sixty seconds on the clock. Rewards spawn thick and fast — bank as much score as you can before time runs out.',
    icon: '⏱️',
    duration: 60,
    spawnRateMultiplier: 1.45,
    speedMultiplier: 1.1,
    dangerBias: -0.05,
    lives: 2,
    bossAtStart: false,
    bossInterval: null,
    objective: { metric: 'score', target: 1200, label: 'Score 1200 points' },
    accent: '#ffd166',
  },
  {
    id: 'mission',
    name: 'Mission Mode',
    tagline: 'Complete the objective',
    description:
      'A targeted operation. Collect 30 gold coins while staying alive. Finish the objective to earn bonus XP.',
    icon: '🎯',
    duration: null,
    spawnRateMultiplier: 1.15,
    speedMultiplier: 1.05,
    dangerBias: 0.05,
    lives: 2,
    bossAtStart: false,
    bossInterval: 70,
    objective: { metric: 'coins', target: 30, label: 'Collect 30 gold coins' },
    accent: '#4dffa6',
  },
  {
    id: 'boss',
    name: 'Boss Survival',
    tagline: 'Break the guardian',
    description:
      'A DIGO Guardian appears immediately. Collect Legendary Relics to damage it while dodging everything it throws down.',
    icon: '👹',
    duration: null,
    spawnRateMultiplier: 1.2,
    speedMultiplier: 1.05,
    dangerBias: 0.1,
    lives: 3,
    bossAtStart: true,
    bossInterval: 40,
    objective: { metric: 'boss', target: 3, label: 'Defeat 3 guardians' },
    accent: '#ff2d55',
  },
  {
    id: 'daily',
    name: 'Daily Challenge',
    tagline: 'One shared seed, one score',
    description:
      'Everyone plays the same seeded run today: heavier hazards, double points and no second chances.',
    icon: '📅',
    duration: 75,
    spawnRateMultiplier: 1.3,
    speedMultiplier: 1.15,
    dangerBias: 0.12,
    lives: 1,
    bossAtStart: false,
    bossInterval: 35,
    objective: { metric: 'score', target: 1500, label: 'Score 1500 points' },
    accent: '#c07bff',
  },
];

export const MODE_MAP: Record<ModeId, ModeDef> = MODES.reduce(
  (acc, m) => {
    acc[m.id] = m;
    return acc;
  },
  {} as Record<ModeId, ModeDef>,
);

/** Stable per-day seed for the daily challenge (UTC date). */
export function dailySeed(date = new Date()): number {
  const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function dailyKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`;
}
