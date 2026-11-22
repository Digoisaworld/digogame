/**
 * Shared game types and tuning tables for DIGO EVOLUTION.
 * Every module (engine, UI, server validation) reads from here so the
 * reward/danger taxonomy can never drift apart.
 */

export type WorldId =
  | 'island'
  | 'cyber'
  | 'temple'
  | 'space'
  | 'lava'
  | 'crystal'
  | 'frozen';

export type ModeId = 'endless' | 'time' | 'mission' | 'boss' | 'daily';

/** Valuable things the player wants to touch. */
export type RewardKind = 'coin' | 'diamond' | 'energy' | 'chest' | 'legendary';

/** Hostile things the player must avoid. */
export type DangerKind = 'bomb' | 'meteor' | 'electric' | 'spike' | 'enemy';

/** Pickups that change the rules for a few seconds. */
export type PowerKind =
  | 'shield'
  | 'magnet'
  | 'slow'
  | 'double'
  | 'speed'
  | 'invincible';

export type FallingKind = RewardKind | DangerKind | PowerKind;
export type Category = 'reward' | 'danger' | 'power';

export const REWARD_POINTS: Record<RewardKind, number> = {
  coin: 10,
  diamond: 25,
  energy: 15,
  chest: 50,
  legendary: 150,
};

/** Meta-currency granted per collected reward (separate from score). */
export const REWARD_COINS: Record<RewardKind, number> = {
  coin: 1,
  diamond: 3,
  energy: 2,
  chest: 5,
  legendary: 15,
};

export const DANGER_DAMAGE: Record<DangerKind, number> = {
  bomb: 34,
  meteor: 40,
  electric: 28,
  spike: 30,
  enemy: 26,
};

export const POWER_DURATION: Record<PowerKind, number> = {
  shield: 12,
  magnet: 10,
  slow: 8,
  double: 12,
  speed: 10,
  invincible: 7,
};

const REWARD_SET: RewardKind[] = ['coin', 'diamond', 'energy', 'chest', 'legendary'];
const DANGER_SET: DangerKind[] = ['bomb', 'meteor', 'electric', 'spike', 'enemy'];
const POWER_SET: PowerKind[] = [
  'shield',
  'magnet',
  'slow',
  'double',
  'speed',
  'invincible',
];

export function categoryOf(kind: FallingKind): Category {
  if ((REWARD_SET as string[]).includes(kind)) return 'reward';
  if ((DANGER_SET as string[]).includes(kind)) return 'danger';
  if ((POWER_SET as string[]).includes(kind)) return 'power';
  return 'danger';
}

export const REWARDS = REWARD_SET;
export const DANGERS = DANGER_SET;
export const POWERS = POWER_SET;

export interface ObjectMeta {
  label: string;
  /** Short player-facing explanation used in the legend / codex. */
  blurb: string;
  /** Core colour used by the UI legend. */
  color: string;
  icon: string;
}

export const REWARD_META: Record<RewardKind, ObjectMeta> = {
  coin: {
    label: 'Gold DIGO Coin',
    blurb: 'Spinning gold coin with the DIGO crest. +10 points.',
    color: '#ffd54a',
    icon: '🪙',
  },
  diamond: {
    label: 'Rare Diamond',
    blurb: 'Faceted cyan crystal. +25 points.',
    color: '#63e6ff',
    icon: '💎',
  },
  energy: {
    label: 'Energy Crystal',
    blurb: 'Glowing turquoise core. +15 points.',
    color: '#4dffa6',
    icon: '🔋',
  },
  chest: {
    label: 'Treasure Chest',
    blurb: 'Golden locked chest. +50 points.',
    color: '#ffb020',
    icon: '🎁',
  },
  legendary: {
    label: 'Legendary Relic',
    blurb: 'Rare purple-gold relic. +150 points and boss damage.',
    color: '#c07bff',
    icon: '🔮',
  },
};

export const DANGER_META: Record<DangerKind, ObjectMeta> = {
  bomb: {
    label: 'Bomb',
    blurb: 'Black sphere, red warning ring, burning fuse. -34 HP.',
    color: '#ff3b30',
    icon: '💣',
  },
  meteor: {
    label: 'Meteor',
    blurb: 'Burning rock with a flame tail. -40 HP.',
    color: '#ff7a18',
    icon: '☄️',
  },
  electric: {
    label: 'Electric Hazard',
    blurb: 'Crackling red energy orb. -28 HP.',
    color: '#ff2d55',
    icon: '⚡',
  },
  spike: {
    label: 'Spike Obstacle',
    blurb: 'Sharp metal spikes. -30 HP.',
    color: '#c9d4e0',
    icon: '🔺',
  },
  enemy: {
    label: 'Enemy',
    blurb: 'Hostile horned creature. -26 HP.',
    color: '#b3243b',
    icon: '👾',
  },
};

export const POWER_META: Record<PowerKind, ObjectMeta> = {
  shield: {
    label: 'Shield',
    blurb: 'Absorbs danger collisions.',
    color: '#4da3ff',
    icon: '🛡️',
  },
  magnet: {
    label: 'Magnet',
    blurb: 'Pulls nearby rewards toward DIGO.',
    color: '#ff5fd2',
    icon: '🧲',
  },
  slow: {
    label: 'Slow Motion',
    blurb: 'Falling objects slow down.',
    color: '#8ef0ff',
    icon: '⏳',
  },
  double: {
    label: 'Double Reward',
    blurb: 'All points are doubled.',
    color: '#ffd166',
    icon: '✖️',
  },
  speed: {
    label: 'Speed Boost',
    blurb: 'DIGO moves faster.',
    color: '#7cff6b',
    icon: '💨',
  },
  invincible: {
    label: 'Invincibility',
    blurb: 'Nothing can hurt DIGO.',
    color: '#ffffff',
    icon: '✨',
  },
};

export const OBJECT_META: Record<FallingKind, ObjectMeta> = {
  ...REWARD_META,
  ...DANGER_META,
  ...POWER_META,
};

export interface HudPowerUp {
  kind: PowerKind;
  remaining: number;
  total: number;
}

export interface HudObjective {
  label: string;
  progress: number;
  target: number;
}

export interface HudState {
  status: 'running' | 'paused' | 'over';
  score: number;
  combo: number;
  multiplier: number;
  health: number;
  maxHealth: number;
  lives: number;
  maxLives: number;
  level: number;
  time: number;
  world: WorldId;
  mode: ModeId;
  stage: number;
  powerups: HudPowerUp[];
  boss: { hp: number; max: number; name: string } | null;
  objective: HudObjective | null;
  coins: number;
  shield: boolean;
}

export interface RunResult {
  world: WorldId;
  mode: ModeId;
  stage: number;
  score: number;
  coins: number;
  xp: number;
  elapsed: number;
  collected: Record<RewardKind, number>;
  hits: number;
  dodged: number;
  maxCombo: number;
  victory: boolean;
  bossDefeated: number;
  powerupsUsed: number;
  reason: string;
}

export type GameEvent =
  | { type: 'hud'; hud: HudState }
  | { type: 'over'; result: RunResult }
  | { type: 'toast'; text: string; tone: 'good' | 'bad' | 'info' }
  | { type: 'ready' };

export interface RunConfig {
  world: WorldId;
  mode: ModeId;
  stage: number;
  /** Deterministic seed so daily challenges are identical for everyone. */
  seed: number;
  musicVolume: number;
  sfxVolume: number;
  haptics: boolean;
  controlMode: 'drag' | 'buttons' | 'both';
}
