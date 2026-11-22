import { REWARD_POINTS, type RewardKind } from '../types';

const COMBO_WINDOW = 2.6;

/**
 * Score, combo and experience accounting. Rewards can only be scored once:
 * the collision system removes the entity before calling addReward.
 */
export class ScoreSystem {
  score = 0;
  combo = 0;
  maxCombo = 0;
  totalCollected = 0;
  private comboTimer = 0;
  private collected: Record<RewardKind, number> = {
    coin: 0,
    diamond: 0,
    energy: 0,
    chest: 0,
    legendary: 0,
  };

  get multiplier(): number {
    return Math.min(5, 1 + Math.floor(this.combo / 5) * 0.5);
  }

  get xp(): number {
    return Math.round(this.score * 0.35) + this.totalCollected * 2;
  }

  reset(): void {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.totalCollected = 0;
    this.comboTimer = 0;
    this.collected = { coin: 0, diamond: 0, energy: 0, chest: 0, legendary: 0 };
  }

  update(dt: number): void {
    if (this.combo === 0) return;
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) {
      this.combo = 0;
      this.comboTimer = 0;
    }
  }

  addReward(
    kind: RewardKind,
    doublePoints: boolean,
    stageBonus: number,
  ): { points: number; multiplier: number; combo: number } {
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboTimer = COMBO_WINDOW;
    this.totalCollected += 1;
    this.collected[kind] += 1;
    const base = REWARD_POINTS[kind];
    const points = Math.max(
      1,
      Math.round(base * this.multiplier * (doublePoints ? 2 : 1) * stageBonus),
    );
    this.score += points;
    return { points, multiplier: this.multiplier, combo: this.combo };
  }

  addBonus(points: number): void {
    this.score += Math.max(0, Math.round(points));
  }

  snapshot(): Record<RewardKind, number> {
    return { ...this.collected };
  }
}
