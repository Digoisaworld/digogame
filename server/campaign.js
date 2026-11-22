/**
 * Server-side campaign table for DIGO EVOLUTION.
 *
 * The server only needs to know, per level: which world it is, how long it may
 * last and what its completion bonus is, so a submitted run can be checked for
 * plausibility. The table is generated from the same rules as the client
 * (src/game/levels.ts + src/game/rewards.ts) and scripts/verify-campaign.mjs
 * asserts that both sides agree on all 100 levels.
 */

export const LAST_LEVEL = 100;

/** World per chapter, matching the chapter list in src/game/levels.ts. */
export const CHAPTER_WORLDS = [
  'island',
  'cyber',
  'temple',
  'space',
  'lava',
  'crystal',
  'frozen',
  'island',
  'cyber',
  'frozen',
];

export function chapterIndex(id) {
  return Math.min(CHAPTER_WORLDS.length, Math.max(1, Math.ceil(id / 10)));
}

/** Level time limit in seconds. */
export function durationFor(id) {
  return 62 + (chapterIndex(id) - 1) * 3;
}

/** Logarithmic completion bonus, identical to src/game/rewards.ts. */
export function levelBonus(id) {
  const n = Math.max(1, Math.floor(id));
  return Math.round(180 * (1 + 1.1 * Math.log2(1 + n)));
}

export const LEVELS = Array.from({ length: LAST_LEVEL }, (_, i) => {
  const id = i + 1;
  return {
    id,
    world: CHAPTER_WORLDS[chapterIndex(id) - 1],
    duration: durationFor(id),
    bonus: levelBonus(id),
  };
});

export const LEVEL_MAP = new Map(LEVELS.map((level) => [level.id, level]));
