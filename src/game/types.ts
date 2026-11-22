/**
 * Shared types and tuning tables for DIGO EVOLUTION.
 *
 * The reward / danger taxonomy lives in one place so the engine, the HUD and the
 * server-side score validation can never drift apart. Everything the player can
 * touch is either a clearly valuable reward, a clearly lethal hazard, or a
 * power-up that changes the rules for a few seconds.
 */

export type WorldId =
  | 'island'
  | 'cyber'
  | 'temple'
  | 'space'
  | 'lava'
  | 'crystal'
  | 'frozen';

/** Valuable things the player wants to touch. */
export type RewardKind = 'coin' | 'crate' | 'gem' | 'relic';

/** Hostile things the player must avoid. */
export type DangerKind = 'bomb' | 'mine' | 'barrel' | 'meteor';

/** Pickups that change the rules for a few seconds. */
export type PowerKind = 'shield' | 'magnet' | 'slow' | 'double' | 'invincible';

export type FallingKind = RewardKind | DangerKind | PowerKind;
export type Category = 'reward' | 'danger' | 'power';
export type GoalKind = 'collect' | 'survive' | 'score';

export const REWARD_POINTS: Record<RewardKind, number> = {
  coin: 10,
  crate: 40,
  gem: 25,
  relic: 120,
};

/** DIGO currency granted per collected reward (separate from score). */
export const REWARD_DIGO: Record<RewardKind, number> = {
  coin: 1,
  crate: 5,
  gem: 3,
  relic: 15,
};

export const DANGER_DAMAGE: Record<DangerKind, number> = {
  bomb: 24,
  mine: 20,
  barrel: 28,
  meteor: 32,
};

export const POWER_DURATION: Record<PowerKind, number> = {
  shield: 14,
  magnet: 11,
  slow: 8,
  double: 12,
  invincible: 7,
};

const REWARD_SET: RewardKind[] = ['coin', 'crate', 'gem', 'relic'];
const DANGER_SET: DangerKind[] = ['bomb', 'mine', 'barrel', 'meteor'];
const POWER_SET: PowerKind[] = ['shield', 'magnet', 'slow', 'double', 'invincible'];

export const REWARDS = REWARD_SET;
export const DANGERS = DANGER_SET;
export const POWERS = POWER_SET;

export function categoryOf(kind: FallingKind): Category {
  if ((REWARD_SET as string[]).includes(kind)) return 'reward';
  if ((DANGER_SET as string[]).includes(kind)) return 'danger';
  return 'power';
}

export interface ObjectMeta {
  label: string;
  /** One short player-facing line, used in the legend. */
  blurb: string;
  /** Core colour used by the HUD legend and particles. */
  color: string;
  /** Icon id resolved by the UI icon set (never an emoji). */
  icon: string;
}

export const REWARD_META: Record<RewardKind, ObjectMeta> = {
  coin: {
    label: 'DIGO Coin',
    blurb: 'Solid gold coin stamped with the DIGO crest. +10',
    color: '#ffcf4d',
    icon: 'coin',
  },
  crate: {
    label: 'DIGO Reward Box',
    blurb: 'Glowing supply crate packed with DIGO. +40',
    color: '#ffa726',
    icon: 'crate',
  },
  gem: {
    label: 'Rare Gem',
    blurb: 'Faceted blue gemstone. +25',
    color: '#5fd8ff',
    icon: 'gem',
  },
  relic: {
    label: 'DIGO Relic',
    blurb: 'Legendary gold and violet artefact. +120',
    color: '#c084fc',
    icon: 'relic',
  },
};

export const DANGER_META: Record<DangerKind, ObjectMeta> = {
  bomb: {
    label: 'Bomb',
    blurb: 'Black iron bomb, lit fuse, flashing red ring. -24 HP',
    color: '#ff3b30',
    icon: 'bomb',
  },
  mine: {
    label: 'Landmine',
    blurb: 'Spiked sea mine with a blinking detonator. -20 HP',
    color: '#ff6b3d',
    icon: 'mine',
  },
  barrel: {
    label: 'Explosive Barrel',
    blurb: 'Hazard-striped fuel barrel. Do not touch. -28 HP',
    color: '#ff8f1f',
    icon: 'barrel',
  },
  meteor: {
    label: 'Meteor',
    blurb: 'Burning rock trailing fire and smoke. -32 HP',
    color: '#ff5722',
    icon: 'meteor',
  },
};

export const POWER_META: Record<PowerKind, ObjectMeta> = {
  shield: {
    label: 'Shield',
    blurb: 'Absorbs the next hazard hit.',
    color: '#4da3ff',
    icon: 'shield',
  },
  magnet: {
    label: 'Magnet',
    blurb: 'Pulls every nearby reward to DIGO.',
    color: '#ff5fd2',
    icon: 'magnet',
  },
  slow: {
    label: 'Slow Motion',
    blurb: 'Falling objects slow down.',
    color: '#8ef0ff',
    icon: 'slow',
  },
  double: {
    label: 'Double Points',
    blurb: 'Every reward is worth double.',
    color: '#ffd166',
    icon: 'double',
  },
  invincible: {
    label: 'Invincible',
    blurb: 'Nothing can hurt DIGO.',
    color: '#ffffff',
    icon: 'star',
  },
};

export const OBJECT_META: Record<FallingKind, ObjectMeta> = {
  ...REWARD_META,
  ...DANGER_META,
  ...POWER_META,
};

/* ------------------------------------------------------------------ */
/* Campaign                                                            */
/* ------------------------------------------------------------------ */

export interface SpawnProfile {
  /** Seconds between spawns: [easiest, hardest] over the level. */
  interval: [number, number];
  /** Fall speed range in world units per second. */
  speed: [number, number];
  /** 0..1 probability that a spawn is a hazard. */
  dangerBias: number;
  /** Hard cap of simultaneous hazards so no level becomes unfair. */
  maxDangers: number;
}

export interface LevelDef {
  id: number;
  world: WorldId;
  name: string;
  objective: string;
  goal: { kind: GoalKind; target: number };
  /** Level length in seconds (all campaign levels are timed). */
  timeLimit: number;
  /** Bonus points awarded on completion. */
  bonus: number;
  bonusLabel: string;
  /** Score needed for 1, 2 and 3 stars (before the completion bonus). */
  stars: [number, number, number];
  spawn: SpawnProfile;
  rewards: RewardKind[];
  dangers: DangerKind[];
  powers: PowerKind[];
}

export interface RunConfig {
  level: LevelDef;
  seed: number;
  musicVolume: number;
  sfxVolume: number;
  haptics: boolean;
  controlMode: 'drag' | 'buttons' | 'both';
  quality: 'high' | 'medium' | 'low';
  reducedMotion: boolean;
}

export interface HudPowerUp {
  kind: PowerKind;
  remaining: number;
  total: number;
}

export interface HudGoal {
  kind: GoalKind;
  label: string;
  progress: number;
  target: number;
}

export interface HudState {
  status: 'running' | 'paused' | 'over';
  score: number;
  digo: number;
  combo: number;
  multiplier: number;
  health: number;
  maxHealth: number;
  level: number;
  levelName: string;
  world: WorldId;
  time: number;
  timeLimit: number;
  goal: HudGoal;
  powerups: HudPowerUp[];
  shield: boolean;
  invincible: boolean;
  stars: number;
}

export interface RunResult {
  level: number;
  world: WorldId;
  score: number;
  digo: number;
  bonus: number;
  total: number;
  elapsed: number;
  collected: Record<RewardKind, number>;
  hits: number;
  dodged: number;
  maxCombo: number;
  victory: boolean;
  stars: number;
  reason: string;
}

export type GameEvent =
  | { type: 'hud'; hud: HudState }
  | { type: 'over'; result: RunResult }
  | { type: 'toast'; text: string; tone: 'good' | 'bad' | 'info' }
  | { type: 'ready' };

/** Player tuning. Lane is the half width of the walkable track. */
export const PLAYER = {
  health: 100,
  radius: 0.52,
  lane: 3.55,
  speed: 7.6,
  jumpVelocity: 6.4,
  gravity: 15.5,
  invulnTime: 1.15,
  hitboxY: 0.55,
} as const;

/** Reward kinds keyed for the server validation table. */
export const REWARD_KIND_KEYS = REWARD_SET;
