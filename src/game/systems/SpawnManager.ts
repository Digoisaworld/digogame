import type * as THREE from 'three';
import { createEntity, buildBoss, type FallingEntity } from '../entities/objectFactory';
import type { DangerKind, FallingKind, ModeId, PowerKind, RewardKind, WorldId } from '../types';
import { POWERS, REWARDS } from '../types';
import { MODE_MAP } from '../modes';

/** Deterministic RNG (mulberry32) so daily challenges are identical. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SpawnContext {
  playerX: number;
  playerY: number;
  magnetActive: boolean;
  slowFactor: number;
  elapsed: number;
  difficulty: number;
}

export interface BossState {
  entity: FallingEntity;
  hp: number;
  maxHp: number;
  name: string;
  drift: number;
  dropTimer: number;
}

/** Half-width of the playfield in world units (portrait framing). */
const LANE = 2.6;

/**
 * Spawns, moves, recycles and pools every falling object.
 *
 * Pooling: each kind keeps its built meshes in a free list, so a long run does
 * not allocate new geometry after the first few seconds.
 */
export class SpawnManager {
  readonly active: FallingEntity[] = [];
  boss: BossState | null = null;
  bossesDefeated = 0;
  dodged = 0;

  private pool = new Map<FallingKind, FallingEntity[]>();
  private spawnTimer = 0.55;
  private bossTimer: number;
  private readonly scene: THREE.Scene;
  private readonly rng: () => number;
  private readonly worldId: WorldId;
  private readonly mode: ModeId;
  private readonly modeCfg;

  constructor(scene: THREE.Scene, worldId: WorldId, mode: ModeId, seed: number) {
    this.scene = scene;
    this.worldId = worldId;
    this.mode = mode;
    this.rng = makeRng(seed);
    this.modeCfg = MODE_MAP[mode];
    this.bossTimer = this.modeCfg.bossInterval ?? 0;
  }

  private acquire(kind: FallingKind): FallingEntity {
    const free = this.pool.get(kind);
    let entity = free && free.length ? free.pop() : undefined;
    if (!entity) {
      entity = createEntity(kind);
      this.scene.add(entity.group);
    }
    entity.alive = true;
    entity.magnetized = false;
    entity.age = 0;
    entity.group.visible = true;
    entity.group.rotation.set(0, 0, 0);
    entity.group.scale.setScalar(1);
    return entity;
  }

  release(entity: FallingEntity): void {
    entity.alive = false;
    entity.group.visible = false;
    const list = this.pool.get(entity.kind) ?? [];
    list.push(entity);
    this.pool.set(entity.kind, list);
    const idx = this.active.indexOf(entity);
    if (idx >= 0) this.active.splice(idx, 1);
  }

  /** Called when a collision removes an object. */
  consume(entity: FallingEntity): void {
    this.release(entity);
  }

  spawnKind(kind: FallingKind, x?: number, speedScale = 1): FallingEntity {
    const entity = this.acquire(kind);
    const laneX = x ?? (this.rng() * 2 - 1) * LANE;
    entity.x = Math.max(-LANE - 0.4, Math.min(LANE + 0.4, laneX));
    entity.y = 6.4 + this.rng() * 1.6;
    entity.z = -0.6 + this.rng() * 1.2;
    const baseSpeed = entity.category === 'danger' ? 4.6 : 3.9;
    entity.speed = (baseSpeed + this.rng() * 1.8) * speedScale;
    entity.drift =
      this.worldId === 'frozen' ? (this.rng() - 0.5) * 1.6 : (this.rng() - 0.5) * 0.7;
    entity.group.position.set(entity.x, entity.y, entity.z);
    this.active.push(entity);
    return entity;
  }

  private pickKind(difficulty: number): FallingKind {
    const roll = this.rng();
    const dangerShare = Math.min(
      0.62,
      0.3 + difficulty * 0.16 + this.modeCfg.dangerBias + (this.mode === 'daily' ? 0.08 : 0),
    );
    if (roll < dangerShare) {
      const dangers: DangerKind[] = ['bomb', 'meteor', 'electric', 'spike', 'enemy'];
      const weights = [0.34, 0.22, 0.18, 0.16, 0.1];
      let r = this.rng();
      for (let i = 0; i < dangers.length; i += 1) {
        if (r < weights[i]) return dangers[i];
        r -= weights[i];
      }
      return 'bomb';
    }
    // Power-ups are rare and only appear after the opening seconds.
    if (roll > 0.93 && difficulty > 0.15) {
      return POWERS[Math.floor(this.rng() * POWERS.length)] as PowerKind;
    }
    const rewards: RewardKind[] = [...REWARDS];
    const weights =
      this.worldId === 'crystal'
        ? [0.42, 0.26, 0.2, 0.09, 0.03]
        : [0.52, 0.16, 0.2, 0.09, 0.03];
    let r = this.rng();
    for (let i = 0; i < rewards.length; i += 1) {
      if (r < weights[i]) return rewards[i];
      r -= weights[i];
    }
    return 'coin';
  }

  spawnBoss(): BossState {
    const built = buildBoss();
    const entity: FallingEntity = {
      kind: 'enemy',
      category: 'danger',
      group: built.group,
      radius: built.radius,
      speed: 0,
      drift: 0,
      spinSpeed: 0,
      x: 0,
      y: 3.1,
      z: 0,
      alive: true,
      magnetized: false,
      age: 0,
      animate: built.animate,
      dispose: () => {},
    };
    entity.group.position.set(0, entity.y, 0);
    this.scene.add(entity.group);
    const maxHp = 4 + Math.min(6, Math.floor(this.bossesDefeated * 1.5));
    this.boss = {
      entity,
      hp: maxHp,
      maxHp,
      name: `DIGO GUARDIAN ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][Math.min(6, this.bossesDefeated)]}`,
      drift: (this.rng() > 0.5 ? 1 : -1) * (0.9 + this.rng() * 0.5),
      dropTimer: 2.4,
    };
    return this.boss;
  }

  damageBoss(amount = 1): boolean {
    if (!this.boss) return false;
    this.boss.hp -= amount;
    if (this.boss.hp > 0) return false;
    this.scene.remove(this.boss.entity.group);
    this.boss.entity.dispose();
    this.boss = null;
    this.bossesDefeated += 1;
    return true;
  }

  clearBoss(): void {
    if (!this.boss) return;
    this.scene.remove(this.boss.entity.group);
    this.boss.entity.dispose();
    this.boss = null;
  }

  /** Difficulty 0..1 from elapsed run time. */
  private difficultyFor(elapsed: number): number {
    return Math.min(1, elapsed / 110);
  }

  update(dt: number, ctx: SpawnContext): void {
    const difficulty = this.difficultyFor(ctx.elapsed);
    const interval =
      (0.92 - difficulty * 0.55) /
      (this.modeCfg.spawnRateMultiplier * (1 + difficulty * 0.35));

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(0.16, interval) * (0.75 + this.rng() * 0.55);
      const kind = this.pickKind(difficulty);
      const speedScale =
        this.modeCfg.speedMultiplier * (1 + difficulty * 0.75);
      this.spawnKind(kind, undefined, speedScale);
      // Extra simultaneous objects as difficulty climbs.
      if (this.rng() < difficulty * 0.55) {
        this.spawnKind(this.pickKind(difficulty), undefined, speedScale);
      }
    }

    // Boss cadence.
    if (this.modeCfg.bossInterval !== null && !this.boss) {
      this.bossTimer -= dt;
      if (this.bossTimer <= 0) {
        this.spawnBoss();
        this.bossTimer = this.modeCfg.bossInterval;
      }
    }
    if (this.mode === 'boss' && !this.boss && ctx.elapsed > 1 && this.bossesDefeated < 3) {
      this.spawnBoss();
    }

    if (this.boss) {
      const b = this.boss;
      b.entity.age += dt;
      b.entity.x += b.drift * dt;
      if (b.entity.x > LANE) {
        b.entity.x = LANE;
        b.drift = -Math.abs(b.drift);
      }
      if (b.entity.x < -LANE) {
        b.entity.x = -LANE;
        b.drift = Math.abs(b.drift);
      }
      b.entity.y = 3.1 + Math.sin(b.entity.age * 1.3) * 0.45;
      b.entity.group.position.set(b.entity.x, b.entity.y, 0);
      b.entity.animate(b.entity.age, dt, b.entity);

      b.dropTimer -= dt;
      if (b.dropTimer <= 0) {
        b.dropTimer = Math.max(0.7, 2.1 - ctx.difficulty * 1.1);
        const bomb = this.spawnKind('bomb', b.entity.x, 1.15);
        bomb.y = b.entity.y - 1.1;
        bomb.group.position.y = bomb.y;
      }
    }

    // Move everything.
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const e = this.active[i];
      if (!e.alive) {
        this.active.splice(i, 1);
        continue;
      }
      e.age += dt;
      const slow = e.category === 'reward' || e.category === 'power' ? ctx.slowFactor : ctx.slowFactor;
      e.y -= e.speed * slow * dt;
      e.x += e.drift * dt * (this.worldId === 'frozen' ? 1.7 : 1);

      if (ctx.magnetActive && e.category === 'reward') {
        const dx = ctx.playerX - e.x;
        const dy = ctx.playerY - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 3.6 && dist > 0.001) {
          const pull = (1 - dist / 3.6) * 7 * dt;
          e.x += (dx / dist) * pull;
          e.y += (dy / dist) * pull * 0.7;
          e.magnetized = true;
        }
      }

      e.group.position.set(e.x, e.y, e.z);
      e.animate(e.age, dt, e);

      if (e.y < -3.2 || e.x < -LANE - 2.4 || e.x > LANE + 2.4) {
        if (e.category === 'danger' && e.y < -3.2) this.dodged += 1;
        this.release(e);
      }
    }
  }

  get difficulty(): number {
    return this.difficultyFor(this.lastElapsed);
  }

  private lastElapsed = 0;

  setElapsed(elapsed: number): void {
    this.lastElapsed = elapsed;
  }

  dispose(): void {
    this.active.forEach((e) => e.dispose());
    this.active.length = 0;
    for (const list of this.pool.values()) list.forEach((e) => e.dispose());
    this.pool.clear();
    this.clearBoss();
  }
}
