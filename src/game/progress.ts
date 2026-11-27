import { useSyncExternalStore } from 'react';
import type { RunResult } from './types';
import { LAST_LEVEL } from './levels';
import { ACHIEVEMENT_POINTS } from './rewards';

/**
 * Local player progression: level records, stars, DIGO totals, lifetime totals
 * and settings.
 *
 * Stored in localStorage so a run survives a reload. The server keeps the
 * authoritative leaderboard; this store is the player's own campaign save.
 *
 * Lifetime values (points, DIGO, bonuses, cleared levels) are *never* reset by
 * starting a new journey after level 100: only the current campaign progress
 * (`levels`, `unlocked`, `lastLevel`, `campaignComplete`) restarts, while
 * `lifetime`, `digo`, `achievements` and `cyclesCompleted` carry over.
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

export interface Lifetime {
  /** Every point ever earned, including bonuses and achievement awards. */
  points: number;
  /** Every DIGO ever collected. */
  digo: number;
  /** Sum of all completion bonuses ever paid. */
  bonus: number;
  /** Total level victories across all journeys. */
  levelsCleared: number;
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
  /** 1-based number of the journey currently in progress. */
  cycle: number;
  /** How many times all 100 levels have been completed. */
  cyclesCompleted: number;
  /** True while the player is sitting on the level-100 completion screen. */
  campaignComplete: boolean;
  lifetime: Lifetime;
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
  { id: 'chapter2', title: 'Neon Traveller', desc: 'Clear all ten Neon District levels.', icon: 'globe' },
  { id: 'boss', title: 'Bomb Defuser', desc: 'Clear a level packed with every hazard.', icon: 'bomb' },
  { id: 'halfway', title: 'Halfway Hero', desc: 'Clear 50 campaign levels.', icon: 'flag' },
  { id: 'finish', title: 'DIGO Champion', desc: `Clear all ${LAST_LEVEL} campaign levels.`, icon: 'crown' },
  { id: 'cycle2', title: 'Eternal Runner', desc: 'Complete all 100 levels a second time.', icon: 'crown' },
  { id: 'lifetime100k', title: 'Point Legend', desc: 'Bank 100,000 lifetime points.', icon: 'trophy' },
];

const KEY = 'digo.progress.v3';
const LEGACY_KEY = 'digo.progress.v2';

const emptyLifetime: Lifetime = { points: 0, digo: 0, bonus: 0, levelsCleared: 0 };

const defaultProgress: Progress = {
  version: 3,
  name: 'Player',
  digo: 0,
  levels: {},
  unlocked: 1,
  achievements: [],
  lastLevel: 1,
  cycle: 1,
  cyclesCompleted: 0,
  campaignComplete: false,
  lifetime: { ...emptyLifetime },
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

function readSaved(): string | null {
  try {
    return localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
}

export function loadProgress(): Progress {
  try {
    const raw = readSaved();
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Progress>;
      const levels = parsed.levels ?? {};
      const saved = parsed.lifetime;
      const lifetime: Lifetime =
        saved && typeof saved.points === 'number'
          ? {
              points: saved.points,
              digo: saved.digo ?? 0,
              bonus: saved.bonus ?? 0,
              levelsCleared: saved.levelsCleared ?? 0,
            }
          : // Migrating from v2: best scores are the closest record of earned points.
            {
              points: Object.values(levels).reduce((sum, r) => sum + (r.best ?? 0), 0),
              digo: parsed.digo ?? 0,
              bonus: 0,
              levelsCleared: Object.values(levels).filter((r) => r.cleared).length,
            };

      progress = {
        ...defaultProgress,
        ...parsed,
        version: 3,
        settings: { ...defaultProgress.settings, ...(parsed.settings ?? {}) },
        levels,
        achievements: parsed.achievements ?? [],
        cycle: parsed.cycle ?? (parsed.cyclesCompleted ?? 0) + 1,
        cyclesCompleted: parsed.cyclesCompleted ?? 0,
        campaignComplete: Boolean(parsed.campaignComplete),
        lifetime,
      };
    }
  } catch {
    progress = { ...defaultProgress };
  }
  emit();
  return progress;
}

/** Replace the local cache with the server-owned snapshot after wallet sign-in. */
export function replaceProgressFromServer(remote: Progress): void {
  progress = {
    ...defaultProgress,
    ...remote,
    version: 3,
    settings: { ...defaultProgress.settings, ...(remote.settings ?? {}) },
    levels: remote.levels && typeof remote.levels === 'object' ? remote.levels : {},
    achievements: Array.isArray(remote.achievements) ? remote.achievements : [],
    lifetime: { ...emptyLifetime, ...(remote.lifetime ?? {}) },
  };
  persist();
  emit();
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

export function clearedCount(p: Progress = progress): number {
  return Object.values(p.levels).filter((r) => r.cleared).length;
}

/** 0..1 progress through the current 100-level journey. */
export function campaignProgress(p: Progress = progress): number {
  return Math.min(1, clearedCount(p) / LAST_LEVEL);
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

/** Full wipe, including lifetime totals (explicit player action). */
export function resetProgress(): void {
  progress = { ...defaultProgress, settings: progress.settings };
  persist();
  emit();
}

/**
 * Restart the campaign at level 1 after finishing level 100.
 * Lifetime points, DIGO, achievements and completed cycles are preserved.
 */
export function startNewJourney(): void {
  progress = {
    ...progress,
    levels: {},
    unlocked: 1,
    lastLevel: 1,
    campaignComplete: false,
    cycle: progress.cyclesCompleted + 1,
  };
  persist();
  emit();
}

export interface RecordOutcome {
  newBest: boolean;
  unlockedNext: number | null;
  newAchievements: Achievement[];
  previousStars: number;
  /** Completion bonus paid for this run (0 when the level was not cleared). */
  bonus: number;
  /** Points awarded for achievements unlocked by this run. */
  achievementPoints: number;
  /** True only on the run that finishes level 100 for the current journey. */
  campaignComplete: boolean;
  cyclesCompleted: number;
  lifetimePoints: number;
  lifetimeDigo: number;
  lifetimeBonus: number;
  levelsCleared: number;
}

/** Applies a finished run to the save file and unlocks the next level. */
export function recordRun(result: RunResult): RecordOutcome {
  const key = String(result.level);
  const previous = levelRecord(result.level);
  const bonus = result.victory ? Math.max(0, Math.round(result.bonus)) : 0;
  const earned = Math.max(0, Math.round(result.score)) + bonus;
  const newBest = earned > previous.best;
  const stars = Math.max(previous.stars, result.stars);

  const levels: Record<string, LevelRecord> = {
    ...progress.levels,
    [key]: {
      stars,
      best: Math.max(previous.best, earned),
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
  const cleared = Object.values(levels).filter((r) => r.cleared).length;
  const clearedAll = cleared >= LAST_LEVEL;
  const chapter2Cleared = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20].every(
    (id) => levels[String(id)]?.cleared,
  );

  const owned = new Set(progress.achievements);
  const newAchievements: Achievement[] = [];
  const unlock = (id: string, condition: boolean): void => {
    if (!condition || owned.has(id)) return;
    owned.add(id);
    const found = ACHIEVEMENTS.find((a) => a.id === id);
    if (found) newAchievements.push(found);
  };

  unlock('first_run', result.victory);
  unlock('no_hit', result.victory && result.hits === 0);
  unlock('combo25', result.maxCombo >= 25);
  unlock('stars9', Object.values(levels).reduce((sum, r) => sum + r.stars, 0) >= 9);
  unlock('digo500', digo >= 500);
  unlock('chapter2', chapter2Cleared);
  unlock('boss', result.victory && result.hits === 0 && result.level >= 41);
  unlock('halfway', cleared >= 50);
  unlock('finish', clearedAll);

  const achievementPoints = newAchievements.length * ACHIEVEMENT_POINTS;

  const justCompletedCampaign = result.victory && clearedAll && !progress.campaignComplete;
  const cyclesCompleted = progress.cyclesCompleted + (justCompletedCampaign ? 1 : 0);

  const lifetime: Lifetime = {
    points: progress.lifetime.points + earned + achievementPoints,
    digo: progress.lifetime.digo + result.digo,
    bonus: progress.lifetime.bonus + bonus,
    levelsCleared: progress.lifetime.levelsCleared + (result.victory ? 1 : 0),
  };

  unlock('cycle2', cyclesCompleted >= 2);
  unlock('lifetime100k', lifetime.points >= 100000);

  progress = {
    ...progress,
    levels,
    unlocked,
    digo,
    achievements: [...owned],
    lastLevel: result.level,
    cyclesCompleted,
    campaignComplete: progress.campaignComplete || justCompletedCampaign,
    lifetime,
  };
  persist();
  emit();

  return {
    newBest,
    unlockedNext,
    newAchievements,
    previousStars: previous.stars,
    bonus,
    achievementPoints,
    campaignComplete: justCompletedCampaign,
    cyclesCompleted,
    lifetimePoints: lifetime.points,
    lifetimeDigo: lifetime.digo,
    lifetimeBonus: lifetime.bonus,
    levelsCleared: lifetime.levelsCleared,
  };
}
