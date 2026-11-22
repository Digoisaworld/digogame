import type { LevelDef, RunResult, RewardKind, WorldId } from './types';
import { REWARD_DIGO } from './types';

/**
 * The 12-level campaign.
 *
 * Design rules baked into these numbers:
 *  - Every level is completable with the default control scheme; targets sit
 *    well inside the spawn budget of the level.
 *  - Difficulty ramps through spawn interval, fall speed, hazard bias and the
 *    simultaneous-hazard cap, never through unavoidable patterns.
 *  - Levels 1-4 teach, 5-8 pressure, 9-12 combine everything.
 */
export const LEVELS: LevelDef[] = [
  {
    id: 1,
    world: 'island',
    name: 'First Landing',
    objective: 'Collect 20 DIGO',
    goal: { kind: 'collect', target: 20 },
    timeLimit: 75,
    bonus: 150,
    bonusLabel: 'Shoreline Discovery',
    stars: [700, 1100, 1500],
    spawn: { interval: [0.85, 1.2], speed: [4.4, 5.4], dangerBias: 0.2, maxDangers: 3 },
    rewards: ['coin', 'coin', 'coin', 'gem'],
    dangers: ['bomb'],
    powers: ['shield'],
  },
  {
    id: 2,
    world: 'island',
    name: 'Palm Rush',
    objective: 'Survive 60 seconds',
    goal: { kind: 'survive', target: 60 },
    timeLimit: 60,
    bonus: 220,
    bonusLabel: 'Island Explorer',
    stars: [900, 1400, 1900],
    spawn: { interval: [0.8, 1.1], speed: [4.8, 6.0], dangerBias: 0.26, maxDangers: 4 },
    rewards: ['coin', 'coin', 'gem', 'crate'],
    dangers: ['bomb', 'mine'],
    powers: ['shield', 'magnet'],
  },
  {
    id: 3,
    world: 'cyber',
    name: 'Neon Run',
    objective: 'Score 2,000 points',
    goal: { kind: 'score', target: 2000 },
    timeLimit: 70,
    bonus: 300,
    bonusLabel: 'Night City Runner',
    stars: [1600, 2100, 2600],
    spawn: { interval: [0.72, 1.0], speed: [5.2, 6.6], dangerBias: 0.3, maxDangers: 4 },
    rewards: ['coin', 'coin', 'gem', 'crate'],
    dangers: ['bomb', 'mine', 'barrel'],
    powers: ['shield', 'magnet', 'double'],
  },
  {
    id: 4,
    world: 'cyber',
    name: 'Rooftop Overdrive',
    objective: 'Collect 40 DIGO',
    goal: { kind: 'collect', target: 40 },
    timeLimit: 80,
    bonus: 380,
    bonusLabel: 'Skyline Breaker',
    stars: [2200, 2900, 3600],
    spawn: { interval: [0.66, 0.95], speed: [5.6, 7.0], dangerBias: 0.32, maxDangers: 5 },
    rewards: ['coin', 'coin', 'gem', 'crate', 'relic'],
    dangers: ['bomb', 'mine', 'barrel'],
    powers: ['shield', 'magnet', 'double', 'slow'],
  },
  {
    id: 5,
    world: 'temple',
    name: 'Temple of Gold',
    objective: 'Score 3,000 points',
    goal: { kind: 'score', target: 3000 },
    timeLimit: 75,
    bonus: 460,
    bonusLabel: 'Idol of Fortune',
    stars: [2600, 3300, 4100],
    spawn: { interval: [0.62, 0.9], speed: [5.8, 7.4], dangerBias: 0.34, maxDangers: 5 },
    rewards: ['coin', 'coin', 'gem', 'crate', 'relic'],
    dangers: ['bomb', 'mine', 'barrel', 'meteor'],
    powers: ['shield', 'magnet', 'double', 'slow'],
  },
  {
    id: 6,
    world: 'temple',
    name: 'Trap Corridor',
    objective: 'Survive 75 seconds',
    goal: { kind: 'survive', target: 75 },
    timeLimit: 75,
    bonus: 540,
    bonusLabel: 'Trap Master',
    stars: [3200, 4000, 4900],
    spawn: { interval: [0.58, 0.86], speed: [6.0, 7.8], dangerBias: 0.36, maxDangers: 5 },
    rewards: ['coin', 'gem', 'crate', 'relic'],
    dangers: ['bomb', 'mine', 'barrel', 'meteor'],
    powers: ['shield', 'magnet', 'double', 'slow', 'invincible'],
  },
  {
    id: 7,
    world: 'space',
    name: 'Meteor Belt',
    objective: 'Collect 55 DIGO',
    goal: { kind: 'collect', target: 55 },
    timeLimit: 85,
    bonus: 620,
    bonusLabel: 'Orbit Pioneer',
    stars: [3800, 4700, 5700],
    spawn: { interval: [0.55, 0.82], speed: [6.2, 8.0], dangerBias: 0.37, maxDangers: 6 },
    rewards: ['coin', 'coin', 'gem', 'crate', 'relic'],
    dangers: ['bomb', 'mine', 'barrel', 'meteor'],
    powers: ['shield', 'magnet', 'double', 'slow', 'invincible'],
  },
  {
    id: 8,
    world: 'lava',
    name: 'Molten Descent',
    objective: 'Score 5,000 points',
    goal: { kind: 'score', target: 5000 },
    timeLimit: 80,
    bonus: 720,
    bonusLabel: 'Firewalker',
    stars: [4200, 5200, 6300],
    spawn: { interval: [0.52, 0.78], speed: [6.6, 8.4], dangerBias: 0.38, maxDangers: 6 },
    rewards: ['coin', 'gem', 'crate', 'relic'],
    dangers: ['bomb', 'mine', 'barrel', 'meteor'],
    powers: ['shield', 'magnet', 'double', 'slow', 'invincible'],
  },
  {
    id: 9,
    world: 'lava',
    name: 'Core Breach',
    objective: 'Survive 80 seconds',
    goal: { kind: 'survive', target: 80 },
    timeLimit: 80,
    bonus: 820,
    bonusLabel: 'Core Survivor',
    stars: [4800, 5900, 7100],
    spawn: { interval: [0.48, 0.74], speed: [6.8, 8.8], dangerBias: 0.4, maxDangers: 6 },
    rewards: ['coin', 'gem', 'crate', 'relic'],
    dangers: ['bomb', 'mine', 'barrel', 'meteor'],
    powers: ['shield', 'magnet', 'double', 'slow', 'invincible'],
  },
  {
    id: 10,
    world: 'crystal',
    name: 'Crystal Vault',
    objective: 'Collect 65 DIGO',
    goal: { kind: 'collect', target: 65 },
    timeLimit: 90,
    bonus: 950,
    bonusLabel: 'Vault Opener',
    stars: [5400, 6600, 7900],
    spawn: { interval: [0.46, 0.72], speed: [7.0, 9.0], dangerBias: 0.4, maxDangers: 6 },
    rewards: ['coin', 'gem', 'gem', 'crate', 'relic'],
    dangers: ['bomb', 'mine', 'barrel', 'meteor'],
    powers: ['shield', 'magnet', 'double', 'slow', 'invincible'],
  },
  {
    id: 11,
    world: 'frozen',
    name: 'Glacier Gauntlet',
    objective: 'Score 7,000 points',
    goal: { kind: 'score', target: 7000 },
    timeLimit: 85,
    bonus: 1100,
    bonusLabel: 'Frost Champion',
    stars: [6000, 7400, 8900],
    spawn: { interval: [0.44, 0.7], speed: [7.2, 9.4], dangerBias: 0.41, maxDangers: 7 },
    rewards: ['coin', 'gem', 'crate', 'relic'],
    dangers: ['bomb', 'mine', 'barrel', 'meteor'],
    powers: ['shield', 'magnet', 'double', 'slow', 'invincible'],
  },
  {
    id: 12,
    world: 'frozen',
    name: 'DIGO Ascendant',
    objective: 'Survive 90 seconds',
    goal: { kind: 'survive', target: 90 },
    timeLimit: 90,
    bonus: 1500,
    bonusLabel: 'DIGO Legend',
    stars: [7000, 8600, 10400],
    spawn: { interval: [0.42, 0.68], speed: [7.4, 9.8], dangerBias: 0.42, maxDangers: 7 },
    rewards: ['coin', 'gem', 'crate', 'relic'],
    dangers: ['bomb', 'mine', 'barrel', 'meteor'],
    powers: ['shield', 'magnet', 'double', 'slow', 'invincible'],
  },
];

export const LEVEL_MAP: Record<number, LevelDef> = LEVELS.reduce(
  (acc, level) => {
    acc[level.id] = level;
    return acc;
  },
  {} as Record<number, LevelDef>,
);

export const FIRST_LEVEL = 1;
export const LAST_LEVEL = LEVELS.length;

export function levelById(id: number): LevelDef {
  return LEVEL_MAP[id] ?? LEVELS[0];
}

export function nextLevelId(id: number): number | null {
  return id < LAST_LEVEL ? id + 1 : null;
}

export function starsFor(level: LevelDef, score: number): number {
  if (score >= level.stars[2]) return 3;
  if (score >= level.stars[1]) return 2;
  if (score >= level.stars[0]) return 1;
  return 0;
}

export function goalLabel(level: LevelDef): string {
  if (level.goal.kind === 'survive') return `Survive ${level.goal.target}s`;
  if (level.goal.kind === 'score') return `Score ${level.goal.target.toLocaleString()}`;
  return `Collect ${level.goal.target} DIGO`;
}

/** Total DIGO currency value of a collection log. */
export function digoValue(collected: Record<RewardKind, number>): number {
  let total = 0;
  (Object.keys(collected) as RewardKind[]).forEach((kind) => {
    total += (collected[kind] ?? 0) * REWARD_DIGO[kind];
  });
  return total;
}

export function resultStars(level: LevelDef, result: RunResult): number {
  return result.victory ? Math.max(1, starsFor(level, result.score)) : starsFor(level, result.score);
}

export const WORLD_LEVELS: Record<WorldId, LevelDef[]> = LEVELS.reduce(
  (acc, level) => {
    (acc[level.world] ??= []).push(level);
    return acc;
  },
  {} as Record<WorldId, LevelDef[]>,
);
