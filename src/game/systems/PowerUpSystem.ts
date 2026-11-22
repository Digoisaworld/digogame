import { POWER_DURATION, POWERS, type HudPowerUp, type PowerKind } from '../types';

/**
 * Timed power-up state. The engine queries the getters every frame, so a
 * power-up expiring mid-frame can never keep granting its effect.
 */
export class PowerUpSystem {
  private active = new Map<PowerKind, { remaining: number; total: number }>();
  used = 0;

  reset(): void {
    this.active.clear();
    this.used = 0;
  }

  activate(kind: PowerKind, durationScale = 1): void {
    const total = POWER_DURATION[kind] * durationScale;
    const existing = this.active.get(kind);
    // Re-collecting refreshes to full duration but never stacks past it.
    this.active.set(kind, { remaining: existing ? Math.max(existing.remaining, total) : total, total });
    this.used += 1;
  }

  update(dt: number): PowerKind[] {
    const expired: PowerKind[] = [];
    for (const [kind, state] of this.active) {
      state.remaining -= dt;
      if (state.remaining <= 0) {
        this.active.delete(kind);
        expired.push(kind);
      }
    }
    return expired;
  }

  has(kind: PowerKind): boolean {
    return this.active.has(kind);
  }

  /** Shield is consumed by a single blocked hit. */
  consumeShield(): boolean {
    if (!this.active.has('shield')) return false;
    this.active.delete('shield');
    return true;
  }

  get slowFactor(): number {
    return this.active.has('slow') ? 0.55 : 1;
  }

  get magnet(): boolean {
    return this.active.has('magnet');
  }

  get doublePoints(): boolean {
    return this.active.has('double');
  }

  get speedMultiplier(): number {
    return this.active.has('speed') ? 1.55 : 1;
  }

  get invincible(): boolean {
    return this.active.has('invincible');
  }

  list(): HudPowerUp[] {
    const out: HudPowerUp[] = [];
    for (const kind of POWERS) {
      const state = this.active.get(kind);
      if (state) out.push({ kind, remaining: Math.max(0, state.remaining), total: state.total });
    }
    return out;
  }
}
