export type DamageResult = 'ignored' | 'hit' | 'lifeLost' | 'dead';

/**
 * Health + lives with a post-hit invulnerability window so a single object can
 * never drain the bar, and a short mercy window after losing a life.
 */
export class HealthSystem {
  health: number;
  readonly maxHealth = 100;
  lives: number;
  readonly maxLives: number;
  invuln = 0;

  constructor(lives: number) {
    this.lives = Math.max(1, lives);
    this.maxLives = this.lives;
    this.health = this.maxHealth;
  }

  get invulnerable(): boolean {
    return this.invuln > 0;
  }

  update(dt: number): void {
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
  }

  damage(amount: number, ignoreInvuln = false): DamageResult {
    if (!ignoreInvuln && this.invuln > 0) return 'ignored';
    this.health = Math.max(0, this.health - amount);
    this.invuln = 1.25;
    if (this.health > 0) return 'hit';
    this.lives -= 1;
    if (this.lives <= 0) {
      this.lives = 0;
      this.health = 0;
      return 'dead';
    }
    this.health = this.maxHealth;
    this.invuln = 2.2;
    return 'lifeLost';
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  addLife(): void {
    this.lives = Math.min(this.maxLives + 2, this.lives + 1);
  }
}
