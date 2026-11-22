import { useSyncExternalStore } from 'react';
import type { RunResult } from './types';
import { LAST_LEVEL } from './levels';

/**
 * Local player progression: level records, stars, DIGO totals and settings.
 *
 * Stored in localStorage so a run survives a reload. The server keeps the
 * authoritative leaderboard; this store is the player's own campaign save.
 */

export type Quality = 'high' | 'medium' | 'low';
export type ControlMode = 'drag' | 'buttons' | 'both';

export interface Settings {
  music: number;
  sfx: number;
  haptics: boolean;
  quality: Quality;
  control: ControlMode;
  reducedMotion: boolean;
}

export interface LevelRecord {
  stars: number;
  best: number;
  cleared: boolean;
  digo: number;
}

export interface Progress {
  version: number;
  name: string;
  digo: number;
  levels: Record<string, LevelRecord>;
  unlocked: number;
  achievements: string[];
  settings: Settings;
  lastLevel: number;
}

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_run', title: 'First Steps', desc: 'Complete your first level.', icon: 'flag' },
  { id: 'no_hit', title: 'Untouchable', desc: 'Clear a level without taking a hit.', icon: 'shield' },
  { id: 'combo25', title: 'Chain Reaction', desc: 'Reach a 25x combo.', icon: 'bolt' },
  { id: 'stars9', title: 'Rising Star', desc: 'Earn 9 stars in total.', icon: 'star' },
  { id: 'digo500', title: 'Treasure Hunter', desc: 'Collect 500 DIGO in total.', icon: 'coin' },
  { id: 'world2', title: 'Neon Traveller', desc: 'Clear the Cyberpunk Neon City levels.', icon: 'globe' },
  { id: 'boss', title: 'Bomb Defuser', desc: 'Clear a level packed with every hazard.', icon: 'bomb' },
  { id: 'finish', title: 'DIGO Champion', desc: `Clear all ${LAST_LEVEL} campaign levels.`, icon: 'crown' },
];

const KEY = 'digo.progress.v2';

const defaultProgress: Progress = {
  version: 2,
  name: 'Player',
  digo: 0,
  levels: {},
  unlocked: 1,
  achievements: [],
  lastLevel: 1,
  settings: {
    music: 0.4,
    sfx: 0.7,
    haptics: true,
    quality: 'high',
    control: 'both',
    reducedMotion: false,
  },
};

let progress: Progress = { ...defaultProgress };
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* storage may be unavailable */
  }
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Progress>;
      progress = {
        ...defaultProgress,
        ...parsed,
        settings: { ...defaultProgress.settings, ...(parsed.settings ?? {}) },
        levels: parsed.levels ?? {},
        achievements: parsed.achievements ?? [],
      };
    }
  } catch {
    progress = { ...defaultProgress };
  }
  emit();
  return progress;
}

export function getProgress(): Progress {
  return progress;
}

export function subscribeProgress(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribeProgress, getProgress, getProgress);
}

export function totalStars(p: Progress = progress): number {
  return Object.values(p.levels).reduce((sum, r) => sum + r.stars, 0);
}

export function totalBestScore(p: Progress = progress): number {
  return Object.values(p.levels).reduce((sum, r) => sum + r.best, 0);
}

export function levelRecord(id: number, p: Progress = progress): LevelRecord {
  return p.levels[String(id)] ?? { stars: 0, best: 0, cleared: false, digo: 0 };
}

export function isUnlocked(id: number, p: Progress = progress): boolean {
  return id <= p.unlocked;
}

export function updateSettings(patch: Partial<Settings>): void {
  progress = { ...progress, settings: { ...progress.settings, ...patch } };
  persist();
  emit();
}

export function setName(name: string): void {
  progress = { ...progress, name: name.trim().slice(0, 18) || 'Player' };
  persist();
  emit();
}

export function setLastLevel(id: number): void {
  progress = { ...progress, lastLevel: id };
  persist();
  emit();
}

export function resetProgress(): void {
  progress = { ...defaultProgress, settings: progress.settings };
  persist();
  emit();
}

export interface RecordOutcome {
  newBest: boolean;
  unlockedNext: number | null;
  newAchievements: Achievement[];
  previousStars: number;
}

/** Applies a finished run to the save file and unlocks the next level. */
export function recordRun(result: RunResult): RecordOutcome {
  const key = String(result.level);
  const previous = levelRecord(result.level);
  const newBest = result.total > previous.best;
  const stars = Math.max(previous.stars, result.stars);

  const levels: Record<string, LevelRecord> = {
    ...progress.levels,
    [key]: {
      stars,
      best: Math.max(previous.best, result.total),
      cleared: previous.cleared || result.victory,
      digo: Math.max(previous.digo, result.digo),
    },
  };

  let unlocked = progress.unlocked;
  let unlockedNext: number | null = null;
  if (result.victory) {
    const next = Math.min(LAST_LEVEL, result.level + 1);
    if (next > unlocked) {
      unlocked = next;
      unlockedNext = next;
    }
  }

  const digo = progress.digo + result.digo;
  const starsTotal = Object.values(levels).reduce((sum, r) => sum + r.stars, 0);
  const clearedAll = Object.values(levels).filter((r) => r.cleared).length >= LAST_LEVEL;
  const world2Cleared = [4, 5, 6].every((id) => levels[String(id)]?.cleared);

  const earned = new Set(progress.achievements);
  const newAchievements: Achievement[] = [];
  const unlock = (id: string, condition: boolean): void => {
    if (!condition || earned.has(id)) return;
    earned.add(id);
    const found = ACHIEVEMENTS.find((a) => a.id === id);
    if (found) newAchievements.push(found);
  };

  unlock('first_run', result.victory);
  unlock('no_hit', result.victory && result.hits === 0);
  unlock('combo25', result.maxCombo >= 25);
  unlock('stars9', starsTotal >= 9);
  unlock('digo500', digo >= 500);
  unlock('world2', world2Cleared);
  unlock('boss', result.victory && result.hits === 0 && result.level >= 9);
  unlock('finish', clearedAll);

  progress = {
    ...progress,
    levels,
    unlocked,
    digo,
    achievements: [...earned],
    lastLevel: result.level,
  };
  persist();
  emit();

  return { newBest, unlockedNext, newAchievements, previousStars: previous.stars };
}
