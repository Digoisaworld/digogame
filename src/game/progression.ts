import type { ModeId, RewardKind, RunResult, WorldId } from './types';
import { WORLDS } from './worlds';

/* ------------------------------------------------------------------ *
 * Character evolution
 * ------------------------------------------------------------------ */

export interface StageDef {
  index: number;
  name: string;
  title: string;
  xpRequired: number;
  fur: number;
  furDark: number;
  accent: number;
  eye: number;
  crystal: number;
  scale: number;
  ability: string;
  features: string[];
}

/**
 * Five DIGO evolution stages. The silhouette stays identical (round head, big
 * cyan eyes, floppy ears, chest crystal) so the character always reads as the
 * same creature — each stage only adds detail, scale and a new ability.
 */
export const STAGES: StageDef[] = [
  {
    index: 1,
    name: 'DIGO',
    title: 'Hatchling',
    xpRequired: 0,
    fur: 0xffc233,
    furDark: 0xe09a10,
    accent: 0xffe08a,
    eye: 0x39e6ff,
    crystal: 0x66f2ff,
    scale: 1,
    ability: 'Balanced movement',
    features: ['Golden fur', 'Big cyan eyes', 'Chest crystal'],
  },
  {
    index: 2,
    name: 'DIGO Scout',
    title: 'Scout',
    xpRequired: 600,
    fur: 0xffb01f,
    furDark: 0xd98500,
    accent: 0xfff0b0,
    eye: 0x4dffe0,
    crystal: 0x7cff9e,
    scale: 1.05,
    ability: '+8% movement speed',
    features: ['Scout goggles', 'Brighter crystal', 'Longer ears'],
  },
  {
    index: 3,
    name: 'DIGO Guardian',
    title: 'Guardian',
    xpRequired: 1800,
    fur: 0xffa000,
    furDark: 0xc96f00,
    accent: 0xffd9a0,
    eye: 0x7ad7ff,
    crystal: 0x8b5cf6,
    scale: 1.1,
    ability: 'Starts each run with a shield',
    features: ['Armour plating', 'Purple crystal core', 'Glowing runes'],
  },
  {
    index: 4,
    name: 'DIGO Nova',
    title: 'Nova',
    xpRequired: 4200,
    fur: 0xffd166,
    furDark: 0xd99a00,
    accent: 0xfff7d6,
    eye: 0xff5fd2,
    crystal: 0xff2fd0,
    scale: 1.16,
    ability: '+15% score from all rewards',
    features: ['Neon aura', 'Magenta eyes', 'Energy wings'],
  },
  {
    index: 5,
    name: 'DIGO Ascendant',
    title: 'Ascendant',
    xpRequired: 9000,
    fur: 0xfff3c4,
    furDark: 0xe0b64a,
    accent: 0xffffff,
    eye: 0x9dfcff,
    crystal: 0x63e6ff,
    scale: 1.22,
    ability: 'Magnet pulse every 20s',
    features: ['Golden crown', 'Crystal wings', 'Ascendant halo'],
  },
];

export function stageDef(stage: number): StageDef {
  const clamped = Math.min(Math.max(stage, 1), STAGES.length);
  return STAGES[clamped - 1];
}

export function unlockedStageForXp(xp: number): number {
  let stage = 1;
  for (const s of STAGES) if (xp >= s.xpRequired) stage = s.index;
  return stage;
}

export function nextStageXp(xp: number): number | null {
  const next = STAGES.find((s) => s.xpRequired > xp);
  return next ? next.xpRequired : null;
}

/* ------------------------------------------------------------------ *
 * Levels, missions, achievements
 * ------------------------------------------------------------------ */

export function xpForLevel(level: number): number {
  return Math.round(140 + (level - 1) * 110);
}

export function levelFromXp(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let remaining = xp;
  let needed = xpForLevel(level);
  while (remaining >= needed && level < 99) {
    remaining -= needed;
    level += 1;
    needed = xpForLevel(level);
  }
  return { level, into: remaining, needed };
}

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  metric: 'coins' | 'score' | 'time' | 'diamonds' | 'runs' | 'combo';
  target: number;
  rewardCoins: number;
  rewardXp: number;
}

export const MISSIONS: MissionDef[] = [
  {
    id: 'm_coins_50',
    title: 'Pocket Money',
    description: 'Collect 50 gold coins across all runs.',
    metric: 'coins',
    target: 50,
    rewardCoins: 40,
    rewardXp: 120,
  },
  {
    id: 'm_score_3000',
    title: 'High Roller',
    description: 'Reach 3,000 points in a single run.',
    metric: 'score',
    target: 3000,
    rewardCoins: 90,
    rewardXp: 260,
  },
  {
    id: 'm_survive_180',
    title: 'Endurance',
    description: 'Survive for a total of 180 seconds.',
    metric: 'time',
    target: 180,
    rewardCoins: 60,
    rewardXp: 180,
  },
  {
    id: 'm_diamond_20',
    title: 'Crystal Hunter',
    description: 'Collect 20 rare diamonds.',
    metric: 'diamonds',
    target: 20,
    rewardCoins: 75,
    rewardXp: 220,
  },
  {
    id: 'm_runs_10',
    title: 'Dedicated',
    description: 'Complete 10 runs in any mode.',
    metric: 'runs',
    target: 10,
    rewardCoins: 50,
    rewardXp: 150,
  },
  {
    id: 'm_combo_15',
    title: 'Chain Reaction',
    description: 'Reach a 15x combo in a single run.',
    metric: 'combo',
    target: 15,
    rewardCoins: 80,
    rewardXp: 240,
  },
];

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  metric:
    | 'coins'
    | 'score'
    | 'time'
    | 'runs'
    | 'diamonds'
    | 'combo'
    | 'bosses'
    | 'powerups'
    | 'worlds';
  target: number;
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'a_first', title: 'First Steps', description: 'Finish your first run.', metric: 'runs', target: 1, icon: '🐣' },
  { id: 'a_coin_100', title: 'Coin Collector', description: 'Collect 100 gold coins.', metric: 'coins', target: 100, icon: '🪙' },
  { id: 'a_diamond_25', title: 'Facet Master', description: 'Collect 25 diamonds.', metric: 'diamonds', target: 25, icon: '💎' },
  { id: 'a_score_5000', title: 'Arcade Legend', description: 'Score 5,000 in one run.', metric: 'score', target: 5000, icon: '🏆' },
  { id: 'a_combo_20', title: 'Unstoppable', description: 'Reach a 20x combo.', metric: 'combo', target: 20, icon: '🔥' },
  { id: 'a_boss_3', title: 'Guardian Breaker', description: 'Defeat 3 bosses.', metric: 'bosses', target: 3, icon: '👹' },
  { id: 'a_power_15', title: 'Fully Charged', description: 'Use 15 power-ups.', metric: 'powerups', target: 15, icon: '⚡' },
  { id: 'a_time_600', title: 'Marathon', description: 'Survive 10 minutes in total.', metric: 'time', target: 600, icon: '⏱️' },
  { id: 'a_worlds_4', title: 'Traveller', description: 'Unlock 4 worlds.', metric: 'worlds', target: 4, icon: '🌍' },
];

/* ------------------------------------------------------------------ *
 * Persistent player profile
 * ------------------------------------------------------------------ */

export interface Settings {
  music: number;
  sfx: number;
  controls: 'drag' | 'buttons' | 'both';
  haptics: boolean;
  quality: 'low' | 'medium' | 'high';
}

export interface WalletLink {
  address: string | null;
  linkedAt: number | null;
  verified: boolean;
}

export interface Profile {
  version: number;
  name: string;
  xp: number;
  coins: number;
  stage: number;
  unlockedWorlds: WorldId[];
  bestScores: Partial<Record<ModeId, number>>;
  totalRuns: number;
  totalCollected: number;
  totalTime: number;
  totalBosses: number;
  totalPowerups: number;
  maxCombo: number;
  achievements: string[];
  missions: Record<string, number>;
  claimedMissions: string[];
  dailyDone: string | null;
  settings: Settings;
  wallet: WalletLink;
}

const STORAGE_KEY = 'digo-evolution-profile-v1';

export function defaultProfile(): Profile {
  return {
    version: 1,
    name: 'DIGO Pilot',
    xp: 0,
    coins: 0,
    stage: 1,
    unlockedWorlds: ['island'],
    bestScores: {},
    totalRuns: 0,
    totalCollected: 0,
    totalTime: 0,
    totalBosses: 0,
    totalPowerups: 0,
    maxCombo: 0,
    achievements: [],
    missions: {},
    claimedMissions: [],
    dailyDone: null,
    settings: { music: 0.45, sfx: 0.7, controls: 'both', haptics: true, quality: 'high' },
    wallet: { address: null, linkedAt: null, verified: false },
  };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw) as Partial<Profile>;
    const base = defaultProfile();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      wallet: { ...base.wallet, ...(parsed.wallet ?? {}) },
      unlockedWorlds:
        parsed.unlockedWorlds && parsed.unlockedWorlds.length
          ? parsed.unlockedWorlds
          : base.unlockedWorlds,
      missions: parsed.missions ?? {},
      bestScores: parsed.bestScores ?? {},
      achievements: parsed.achievements ?? [],
      claimedMissions: parsed.claimedMissions ?? [],
    };
  } catch {
    return defaultProfile();
  }
}

/** Wipes browser-side progress and returns a fresh profile. */
export function resetProfile(): Profile {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable - nothing to clear */
  }
  return loadProfile();
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* storage may be unavailable in private mode - the run still works */
  }
}

export interface RunApplication {
  profile: Profile;
  newWorlds: WorldId[];
  newStage: number | null;
  newAchievements: string[];
  completedMissions: MissionDef[];
  levelsGained: number;
  isBest: boolean;
}

/** Folds a finished run into the profile and reports everything it unlocked. */
export function applyRunResult(profile: Profile, result: RunResult, todayKey: string): RunApplication {
  const before = levelFromXp(profile.xp).level;
  const next: Profile = {
    ...profile,
    xp: profile.xp + result.xp,
    coins: profile.coins + result.coins,
    totalRuns: profile.totalRuns + 1,
    totalCollected:
      profile.totalCollected +
      Object.values(result.collected).reduce((a, b) => a + b, 0),
    totalTime: profile.totalTime + result.elapsed,
    totalBosses: profile.totalBosses + result.bossDefeated,
    totalPowerups: profile.totalPowerups + result.powerupsUsed,
    maxCombo: Math.max(profile.maxCombo, result.maxCombo),
    bestScores: { ...profile.bestScores },
    missions: { ...profile.missions },
  };

  const prevBest = next.bestScores[result.mode] ?? 0;
  const isBest = result.score > prevBest;
  if (isBest) next.bestScores[result.mode] = result.score;

  next.missions.m_score = Math.max(next.missions.m_score ?? 0, result.score);
  next.missions.m_combo = Math.max(next.missions.m_combo ?? 0, result.maxCombo);
  next.missions.m_coins = (next.missions.m_coins ?? 0) + result.collected.coin;
  next.missions.m_diamond =
    (next.missions.m_diamond ?? 0) + result.collected.diamond;
  next.missions.m_time = (next.missions.m_time ?? 0) + Math.floor(result.elapsed);
  next.missions.m_runs = (next.missions.m_runs ?? 0) + 1;

  if (result.mode === 'daily') next.dailyDone = todayKey;

  const { level } = levelFromXp(next.xp);
  const newStageUnlocked = unlockedStageForXp(next.xp);
  const newStage = newStageUnlocked > profile.stage ? newStageUnlocked : null;
  next.stage = Math.max(profile.stage, newStageUnlocked);

  const newWorlds: WorldId[] = [];
  for (const world of WORLDS) {
    if (!next.unlockedWorlds.includes(world.id) && level >= world.unlockLevel) {
      next.unlockedWorlds = [...next.unlockedWorlds, world.id];
      newWorlds.push(world.id);
    }
  }

  const newAchievements: string[] = [];
  const counters: Record<string, number> = {
    coins: next.totalCollected,
    diamonds: (next.missions.m_diamond ?? 0),
    score: Math.max(next.bestScores[result.mode] ?? 0, result.score),
    runs: next.totalRuns,
    combo: next.maxCombo,
    bosses: next.totalBosses,
    powerups: next.totalPowerups,
    time: Math.floor(next.totalTime),
    worlds: next.unlockedWorlds.length,
  };
  for (const ach of ACHIEVEMENTS) {
    if (next.achievements.includes(ach.id)) continue;
    if ((counters[ach.metric] ?? 0) >= ach.target) {
      next.achievements = [...next.achievements, ach.id];
      newAchievements.push(ach.id);
    }
  }

  const completedMissions: MissionDef[] = [];
  for (const mission of MISSIONS) {
    if (next.claimedMissions.includes(mission.id)) continue;
    if ((next.missions[mission.id] ?? 0) >= mission.target) {
      next.claimedMissions = [...next.claimedMissions, mission.id];
      next.coins += mission.rewardCoins;
      next.xp += mission.rewardXp;
      completedMissions.push(mission);
    }
  }

  return {
    profile: next,
    newWorlds,
    newStage,
    newAchievements,
    completedMissions,
    levelsGained: Math.max(0, levelFromXp(next.xp).level - before),
    isBest,
  };
}

export function missionProgress(profile: Profile, mission: MissionDef): number {
  return Math.min(profile.missions[mission.id] ?? 0, mission.target);
}
