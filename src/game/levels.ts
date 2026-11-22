import type {
  DangerKind,
  GoalKind,
  LevelDef,
  PowerKind,
  RewardKind,
  RunResult,
  WorldId,
} from './types';
import { REWARD_DIGO, REWARD_POINTS } from './types';
import { levelBonus } from './rewards';

/**
 * The 100-level DIGO campaign, organised into ten chapters of ten levels.
 *
 * Design rules baked into the generator below:
 *  - Difficulty only ever ramps through spawn interval, fall speed, hazard bias
 *    and the simultaneous-hazard cap. No level relies on unavoidable patterns.
 *  - Every objective target is derived from that level's own spawn budget
 *    (how many rewards can physically appear in its time limit), so a level can
 *    never ask for more than the world can deliver.
 *  - New rewards, hazards and power-ups unlock progressively, so chapter ten
 *    combines everything the campaign has taught.
 *  - Completion bonuses come from the logarithmic curve in rewards.ts.
 *
 * The 12-level campaign this replaced used hand-written numbers; generating the
 * targets from the spawn budget is what makes 100 levels provably achievable.
 */

export const TOTAL_LEVELS = 100;

interface ChapterDef {
  name: string;
  world: WorldId;
  rewardLabel: string;
  levels: string[];
}

const CHAPTER_DEFS: ChapterDef[] = [
  {
    name: 'Coral Shore',
    world: 'island',
    rewardLabel: 'Shoreline Seal',
    levels: [
      'First Landing',
      'Palm Rush',
      'Tide Runner',
      'Shell Scramble',
      'Lagoon Leap',
      'Reef Dash',
      'Sunken Steps',
      'Coastal Sprint',
      'Harbor Hustle',
      'Shoreline Crown',
    ],
  },
  {
    name: 'Neon District',
    world: 'cyber',
    rewardLabel: 'Neon Seal',
    levels: [
      'Neon Entry',
      'Rooftop Overdrive',
      'Circuit Sprint',
      'Holo Dash',
      'Data Stream',
      'Chrome Alley',
      'Grid Runner',
      'Signal Chase',
      'Night Circuit',
      'Skyline Crown',
    ],
  },
  {
    name: 'Golden Temple',
    world: 'temple',
    rewardLabel: 'Temple Seal',
    levels: [
      'Temple Gate',
      'Trap Corridor',
      'Idol Vault',
      'Dust Steps',
      'Serpent Hall',
      'Gold Rush',
      'Hidden Chamber',
      'Sunken Altar',
      'Relic Run',
      'Temple Crown',
    ],
  },
  {
    name: 'Orbital Drift',
    world: 'space',
    rewardLabel: 'Orbit Seal',
    levels: [
      'Orbit Entry',
      'Meteor Belt',
      'Star Drift',
      'Gravity Well',
      'Comet Trail',
      'Void Runner',
      'Satellite Sweep',
      'Nova Dash',
      'Deep Space',
      'Orbit Crown',
    ],
  },
  {
    name: 'Ember Core',
    world: 'lava',
    rewardLabel: 'Ember Seal',
    levels: [
      'Molten Descent',
      'Core Breach',
      'Ash Fall',
      'Lava Leap',
      'Furnace Run',
      'Ember Trail',
      'Magma Surge',
      'Basalt Dash',
      'Inferno Gate',
      'Core Crown',
    ],
  },
  {
    name: 'Prism Halls',
    world: 'crystal',
    rewardLabel: 'Prism Seal',
    levels: [
      'Crystal Vault',
      'Facet Fall',
      'Prism Path',
      'Shard Sprint',
      'Gleam Gallery',
      'Refraction',
      'Quartz Rush',
      'Mirror Hall',
      'Geode Gate',
      'Prism Crown',
    ],
  },
  {
    name: 'Glacier Pass',
    world: 'frozen',
    rewardLabel: 'Glacier Seal',
    levels: [
      'Glacier Gauntlet',
      'Frostbite Run',
      'Ice Shelf',
      'Snow Squall',
      'Avalanche Alley',
      'Frozen Steps',
      'Blizzard Dash',
      'Rime Ridge',
      'Permafrost',
      'Glacier Crown',
    ],
  },
  {
    name: 'Storm Archipelago',
    world: 'island',
    rewardLabel: 'Storm Seal',
    levels: [
      'Storm Landing',
      'Squall Line',
      'Thunder Reef',
      'Windward Run',
      'Monsoon Dash',
      'Cyclone Cove',
      'Tempest Trail',
      'Lightning Shoal',
      'Hurricane Gate',
      'Storm Crown',
    ],
  },
  {
    name: 'Chrome Spire',
    world: 'cyber',
    rewardLabel: 'Chrome Seal',
    levels: [
      'Spire Ascent',
      'Laser Lattice',
      'Chrome Vertigo',
      'Pulse Grid',
      'Overclock',
      'Neon Spiral',
      'Data Cascade',
      'Circuit Zenith',
      'Mainframe Run',
      'Spire Crown',
    ],
  },
  {
    name: 'Frozen Crown',
    world: 'frozen',
    rewardLabel: 'Crown Seal',
    levels: [
      'Crown Approach',
      'Whiteout',
      'Eternal Frost',
      'Crystal Winter',
      'Final Descent',
      'Aurora Gate',
      'Polar Vortex',
      'Ice Throne',
      'Last Light',
      'DIGO Ascendant',
    ],
  },
];

const round2 = (v: number): number => Math.round(v * 100) / 100;
const mean = (list: number[]): number => list.reduce((a, b) => a + b, 0) / Math.max(1, list.length);

/** Chapter number (1..10) that owns a level. */
export function chapterIndex(id: number): number {
  return Math.min(CHAPTER_DEFS.length, Math.max(1, Math.ceil(id / 10)));
}

/**
 * Time limit for a level. Longer chapters get slightly more room so the denser
 * late-game spawns still leave a fair window to reach the objective.
 */
export function durationFor(id: number): number {
  return 62 + (chapterIndex(id) - 1) * 3;
}

/** World a level is played in. Mirrored by server/campaign.js. */
export function worldForLevel(id: number): WorldId {
  return CHAPTER_DEFS[chapterIndex(id) - 1].world;
}

function rewardsFor(id: number): RewardKind[] {
  const list: RewardKind[] = ['coin', 'coin', 'coin'];
  if (id >= 3) list.push('gem');
  if (id >= 9) list.push('crate');
  if (id >= 21) list.push('relic');
  return list;
}

function dangersFor(id: number): DangerKind[] {
  const list: DangerKind[] = ['bomb'];
  if (id >= 9) list.push('mine');
  if (id >= 21) list.push('barrel');
  if (id >= 41) list.push('meteor');
  return list;
}

function powersFor(id: number): PowerKind[] {
  const list: PowerKind[] = ['shield'];
  if (id >= 6) list.push('magnet');
  if (id >= 16) list.push('double');
  if (id >= 31) list.push('slow');
  if (id >= 51) list.push('invincible');
  return list;
}

function spawnFor(id: number) {
  const t = (id - 1) / Math.max(1, TOTAL_LEVELS - 1);
  const interval = 0.86 - 0.5 * t; // 0.86s between spawns -> 0.36s
  const speed = 4.4 + 4.2 * t; // 4.4 u/s -> 8.6 u/s
  return {
    interval: [round2(interval), round2(interval * 1.35)] as [number, number],
    speed: [round2(speed), round2(speed * 1.35)] as [number, number],
    dangerBias: round2(0.18 + 0.26 * t),
    maxDangers: Math.round(3 + 4 * t),
  };
}

function goalFor(
  id: number,
  timeLimit: number,
  spawn: ReturnType<typeof spawnFor>,
  rewards: RewardKind[],
): { goal: { kind: GoalKind; target: number }; stars: [number, number, number] } {
  const avgInterval = (spawn.interval[0] + spawn.interval[1]) / 2;
  const spawns = timeLimit / avgInterval;
  const rewardSpawns = spawns * (1 - spawn.dangerBias);
  const avgPoints = mean(rewards.map((kind) => REWARD_POINTS[kind]));
  const avgDigo = mean(rewards.map((kind) => REWARD_DIGO[kind]));
  const expectedPoints = rewardSpawns * avgPoints;
  const expectedDigo = rewardSpawns * avgDigo;

  // Targets sit at roughly half of the theoretical payout: comfortably
  // reachable by a focused player, never trivially automatic.
  const kind: GoalKind = (['collect', 'survive', 'score'] as GoalKind[])[(id + chapterIndex(id)) % 3];
  let goal: { kind: GoalKind; target: number };
  if (kind === 'survive') {
    goal = { kind, target: timeLimit };
  } else if (kind === 'score') {
    // 45% of the theoretical payout, never below a gentle 300 so the very first
    // levels stay winnable even though their rewards are low value.
    goal = { kind, target: Math.max(300, Math.round((expectedPoints * 0.45) / 50) * 50) };
  } else {
    goal = { kind, target: Math.max(10, Math.round(expectedDigo * 0.45)) };
  }

  const stars: [number, number, number] = [
    Math.round(expectedPoints * 0.55),
    Math.round(expectedPoints * 0.75),
    Math.round(expectedPoints * 0.92),
  ];
  return { goal, stars };
}

function buildLevels(): LevelDef[] {
  const levels: LevelDef[] = [];
  CHAPTER_DEFS.forEach((chapter, chapterIdx) => {
    chapter.levels.forEach((name, levelIdx) => {
      const id = chapterIdx * 10 + levelIdx + 1;
      const timeLimit = durationFor(id);
      const spawn = spawnFor(id);
      const rewards = rewardsFor(id);
      const dangers = dangersFor(id);
      const powers = powersFor(id);
      const { goal, stars } = goalFor(id, timeLimit, spawn, rewards);
      levels.push({
        id,
        world: chapter.world,
        name,
        objective: goalLabelFor(goal),
        goal,
        timeLimit,
        bonus: levelBonus(id),
        bonusLabel: chapter.rewardLabel,
        stars,
        spawn,
        rewards,
        dangers,
        powers,
      });
    });
  });
  return levels;
}

function goalLabelFor(goal: { kind: GoalKind; target: number }): string {
  if (goal.kind === 'survive') return `Survive ${goal.target}s`;
  if (goal.kind === 'score') return `Score ${goal.target.toLocaleString()}`;
  return `Collect ${goal.target} DIGO`;
}

export const LEVELS: LevelDef[] = buildLevels();

export const LEVEL_MAP: Record<number, LevelDef> = LEVELS.reduce(
  (acc, level) => {
    acc[level.id] = level;
    return acc;
  },
  {} as Record<number, LevelDef>,
);

export const FIRST_LEVEL = 1;
export const LAST_LEVEL = LEVELS.length;

export interface Chapter {
  index: number;
  name: string;
  world: WorldId;
  rewardLabel: string;
  from: number;
  to: number;
  levels: LevelDef[];
}

export const CHAPTERS: Chapter[] = CHAPTER_DEFS.map((chapter, idx) => {
  const from = idx * 10 + 1;
  const to = from + 9;
  return {
    index: idx + 1,
    name: chapter.name,
    world: chapter.world,
    rewardLabel: chapter.rewardLabel,
    from,
    to,
    levels: LEVELS.filter((level) => level.id >= from && level.id <= to),
  };
});

export function chapterOf(id: number): Chapter {
  return CHAPTERS[chapterIndex(id) - 1] ?? CHAPTERS[0];
}

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
  return goalLabelFor(level.goal);
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
