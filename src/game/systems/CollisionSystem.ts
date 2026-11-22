import type { FallingEntity } from '../entities/objectFactory';

export interface CollisionCallbacks {
  onReward: (entity: FallingEntity) => void;
  onDanger: (entity: FallingEntity) => void;
  onPower: (entity: FallingEntity) => void;
  onBossTouch: (entity: FallingEntity) => void;
}

const PLAYER_RADIUS = 0.5;

/**
 * Elliptical hit test in the play plane (x/y). Each entity is removed from the
 * world by the callback, so a collision can only ever be scored once.
 */
export class CollisionSystem {
  update(
    playerX: number,
    playerY: number,
    entities: FallingEntity[],
    boss: FallingEntity | null,
    cb: CollisionCallbacks,
  ): void {
    for (const e of entities) {
      if (!e.alive) continue;
      // Ignore anything still above the visible playfield so the player is not
      // punished for an object they cannot see yet.
      if (e.y > 4.6) continue;
      const dx = Math.abs(e.x - playerX);
      const dy = Math.abs(e.y - playerY);
      const rx = e.radius + PLAYER_RADIUS;
      const ry = (e.radius + PLAYER_RADIUS) * 0.86;
      const nx = dx / rx;
      const ny = dy / ry;
      if (nx * nx + ny * ny > 1) continue;
      if (e.category === 'reward') cb.onReward(e);
      else if (e.category === 'power') cb.onPower(e);
      else cb.onDanger(e);
    }

    if (boss && boss.alive) {
      const dx = Math.abs(boss.x - playerX);
      const dy = Math.abs(boss.y - playerY);
      const r = boss.radius + PLAYER_RADIUS;
      if (dx * dx + dy * dy < r * r) cb.onBossTouch(boss);
    }
  }
}
