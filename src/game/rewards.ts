/**
 * Reward maths for DIGO EVOLUTION.
 *
 * Completion bonuses follow one configurable logarithmic curve so that later
 * levels are always worth more, while each step adds less than the one before
 * it. The same three constants drive the client and the server validation, and
 * `bonusFormula()` renders the exact expression so the number is never a
 * mystery to the player.
 *
 *   bonus(level) = round(BONUS_BASE * (1 + BONUS_LOG_FACTOR * log2(1 + level)))
 *
 * level 1   -> 378
 * level 10  -> 818
 * level 50  -> 1,225
 * level 100 -> 1,498
 *
 * Increments shrink as the campaign advances: 1->2 adds 116, 99->100 adds 3.
 */

/** Flat base of the completion bonus curve. */
export const BONUS_BASE = 180;

/** How strongly the logarithmic term grows with level number. */
export const BONUS_LOG_FACTOR = 1.1;

/** Points awarded for each newly unlocked achievement. */
export const ACHIEVEMENT_POINTS = 250;

/** Completion bonus for a level, always a whole number of points. */
export function levelBonus(level: number): number {
  const n = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  return Math.round(BONUS_BASE * (1 + BONUS_LOG_FACTOR * Math.log2(1 + n)));
}

/** Human readable version of the formula for one level. */
export function bonusFormula(level: number): string {
  const n = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  return `round(${BONUS_BASE} × (1 + ${BONUS_LOG_FACTOR} × log₂(1 + ${n}))) = ${levelBonus(n).toLocaleString()}`;
}

/** The increase the next level's bonus adds over this one. */
export function bonusStep(level: number): number {
  return levelBonus(level + 1) - levelBonus(level);
}

export interface RewardRow {
  label: string;
  value: string;
  tone?: 'gold' | 'muted';
}

/**
 * Transparent breakdown of everything a finished level paid out:
 * in-run score, DIGO collected, the logarithmic completion bonus and any
 * achievement points, plus the running lifetime total.
 */
export function rewardRows(input: {
  score: number;
  digo: number;
  bonus: number;
  achievementPoints: number;
  total: number;
  lifetimePoints: number;
}): RewardRow[] {
  const rows: RewardRow[] = [
    { label: 'Level score', value: input.score.toLocaleString() },
    { label: 'DIGO collected', value: input.digo.toLocaleString() },
    {
      label: 'Completion bonus',
      value: input.bonus > 0 ? `+${input.bonus.toLocaleString()}` : '—',
      tone: input.bonus > 0 ? 'gold' : 'muted',
    },
  ];
  if (input.achievementPoints > 0) {
    rows.push({
      label: 'Achievement bonus',
      value: `+${input.achievementPoints.toLocaleString()}`,
      tone: 'gold',
    });
  }
  rows.push({ label: 'Total earned', value: input.total.toLocaleString() });
  rows.push({ label: 'Lifetime points', value: input.lifetimePoints.toLocaleString(), tone: 'muted' });
  return rows;
}
