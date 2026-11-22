import * as THREE from 'three';
import { DigoCharacter } from './entities/DigoCharacter';
import { SpawnManager } from './systems/SpawnManager';
import { CollisionSystem } from './systems/CollisionSystem';
import { ScoreSystem } from './systems/ScoreSystem';
import { HealthSystem } from './systems/HealthSystem';
import { PowerUpSystem } from './systems/PowerUpSystem';
import { InputController } from './systems/InputController';
import { AudioManager } from './audio/AudioManager';
import { buildWorldVisual, WORLD_MAP, type WorldVisual } from './worlds';
import { MODE_MAP } from './modes';
import { stageDef } from './progression';
import {
  DANGER_DAMAGE,
  OBJECT_META,
  REWARD_COINS,
  type FallingKind,
  type GameEvent,
  type HudState,
  type RunConfig,
  type RunResult,
} from './types';

/**
 * DigoGame — the run orchestrator.
 *
 * Owns the renderer, camera framing, DIGO, the spawn/collision/score/health/
 * power-up systems and the audio manager, and reports HUD/state changes to the
 * React layer through a single event callback. Nothing here touches React.
 */
export class DigoGame {
  readonly input = new InputController();

  private readonly container: HTMLElement;
  private readonly emit: (event: GameEvent) => void;
  private cfg: RunConfig;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private world: WorldVisual;
  private character: DigoCharacter;
  private spawn: SpawnManager;
  private readonly collisions = new CollisionSystem();
  private readonly score = new ScoreSystem();
  private health: HealthSystem;
  private readonly power = new PowerUpSystem();
  private readonly audio = new AudioManager();

  private status: 'running' | 'paused' | 'over' = 'running';
  private elapsed = 0;
  private clock = 0;
  private playerX = 0;
  private playerVX = 0;
  private readonly playHalf = 2.5;
  private raf = 0;
  private lastFrame = 0;
  private hudTimer = 0;
  private shake = 0;
  private hits = 0;
  private runCoins = 0;
  private milestone = 0;
  private bossAnnounced = false;
  private readonly warned = new WeakSet<object>();
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;
  private readonly cameraTarget = new THREE.Vector3(0, 1.35, 0);
  private baseCameraZ = 14;

  private readonly onVisibility = () => {
    if (document.hidden && this.status === 'running') this.pause();
  };

  constructor(container: HTMLElement, cfg: RunConfig, emit: (event: GameEvent) => void) {
    this.container = container;
    this.emit = emit;
    this.cfg = cfg;
    const mode = MODE_MAP[cfg.mode];
    const world = WORLD_MAP[cfg.world];

    this.renderer = new THREE.WebGLRenderer({
      antialias: cfg.quality !== 'low',
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setClearColor(new THREE.Color(world.skyBottom), 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';

    this.scene.fog = new THREE.FogExp2(new THREE.Color(world.fog).getHex(), world.fogDensity);
    this.camera = new THREE.PerspectiveCamera(52, 9 / 16, 0.1, 200);

    // Lighting: warm key + cool rim + world-tinted fill.
    const hemi = new THREE.HemisphereLight(
      new THREE.Color(world.accent).getHex(),
      new THREE.Color(world.ground).getHex(),
      1.15,
    );
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(3.5, 8, 7);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(world.accent2).getHex(), 1.35);
    rim.position.set(-4, 3, 5);
    this.scene.add(rim);

    this.world = buildWorldVisual(world);
    this.scene.add(this.world.group);

    this.character = new DigoCharacter(cfg.stage);
    this.character.group.position.set(0, this.character.baseY, 0.55);
    this.scene.add(this.character.group);

    this.spawn = new SpawnManager(this.scene, cfg.world, cfg.mode, cfg.seed);
    this.health = new HealthSystem(mode.lives);
    if (mode.bossAtStart) {
      this.spawn.spawnBoss();
      this.bossAnnounced = true;
    }

    this.audio.setVolumes(cfg.musicVolume, cfg.sfxVolume);
    this.audio.startMusic(world);
    this.audio.play('ui');

    this.resize();
    this.resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => this.resize())
        : null;
    this.resizeObserver?.observe(container);
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.emit({ type: 'ready' });
    this.emitHud(true);
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  /* ---------------------------------------------------------------- */
  /* Public API                                                        */
  /* ---------------------------------------------------------------- */

  attachPad(el: HTMLElement): void {
    this.input.attach(el);
  }

  setButton(dir: 'left' | 'right', pressed: boolean): void {
    this.input.setButton(dir, pressed);
  }

  pause(): void {
    if (this.status !== 'running') return;
    this.status = 'paused';
    this.input.setEnabled(false);
    this.emitHud(true);
  }

  resume(): void {
    if (this.status !== 'paused') return;
    this.status = 'running';
    this.input.setEnabled(true);
    this.lastFrame = performance.now();
    this.emitHud(true);
  }

  togglePause(): void {
    if (this.status === 'running') this.pause();
    else if (this.status === 'paused') this.resume();
  }

  setVolumes(music: number, sfx: number): void {
    this.cfg = { ...this.cfg, musicVolume: music, sfxVolume: sfx };
    this.audio.setVolumes(music, sfx);
  }

  get currentStatus(): 'running' | 'paused' | 'over' {
    return this.status;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.input.detach();
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('orientationchange', this.resize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.spawn.dispose();
    this.character.dispose();
    this.world.dispose();
    this.audio.dispose();
    this.scene.clear();
    const canvas = this.renderer.domElement;
    this.renderer.dispose();
    canvas.remove();
  }

  /* ---------------------------------------------------------------- */
  /* Loop                                                              */
  /* ---------------------------------------------------------------- */

  private loop = (now: number): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const rawDt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    const dt = Math.min(0.05, Math.max(0, rawDt));

    if (this.status === 'running') {
      this.step(dt);
    } else {
      // Keep the world alive behind menus without advancing gameplay.
      this.clock += dt * 0.35;
      this.world.update(this.clock, dt);
      this.character.update(dt * 0.4);
    }

    this.shake = Math.max(0, this.shake - dt * 2.6);
    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.9 : 0;
    const sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.9 : 0;
    this.camera.position.set(sx, this.cameraTarget.y + 0.15 + sy, this.baseCameraZ);
    this.camera.lookAt(this.cameraTarget);

    this.renderer.render(this.scene, this.camera);
  };

  private step(dt: number): void {
    this.elapsed += dt;
    this.clock += dt;
    const mode = MODE_MAP[this.cfg.mode];
    const stage = stageDef(this.cfg.stage);

    /* --- player movement: smooth follow of the finger target ---------- */
    const target = this.input.sample() * this.playHalf;
    const prevX = this.playerX;
    const follow = 1 - Math.exp(-(13 + stage.index) * dt);
    this.playerX += (target - this.playerX) * follow;
    this.playerX = Math.max(-this.playHalf, Math.min(this.playHalf, this.playerX));
    this.playerVX = dt > 0 ? (this.playerX - prevX) / dt : 0;
    const speedFactor = this.power.speedMultiplier;
    this.character.group.position.x = this.playerX;
    this.character.group.position.y =
      this.character.baseY + Math.sin(this.clock * 6) * 0.02 + (this.power.magnet ? 0.06 : 0);
    this.character.setVelocityX(this.playerVX * speedFactor);
    this.character.setMoving(Math.abs(this.playerVX) > 0.35 || this.input.active);
    if (Math.abs(this.playerVX) > 0.4) this.character.setFacing(Math.sign(this.playerVX));
    if (this.input.isDragging) {
      const anim = this.playerVX < -0.5 ? 'left' : this.playerVX > 0.5 ? 'right' : 'run';
      this.character.play(anim);
    } else if (this.input.active) {
      this.character.play('run');
    } else {
      this.character.play('idle');
    }
    this.character.update(dt);

    /* --- systems ----------------------------------------------------- */
    this.score.update(dt);
    this.health.update(dt);
    this.power.update(dt);
    this.spawn.setElapsed(this.elapsed);

    this.spawn.update(dt, {
      playerX: this.playerX,
      playerY: this.character.baseY,
      magnetActive: this.power.magnet,
      slowFactor: this.power.slowFactor,
      elapsed: this.elapsed,
      difficulty: Math.min(1, this.elapsed / 110),
    });

    // Bomb warning cue (once per bomb, before it reaches the player).
    for (const e of this.spawn.active) {
      if (e.kind === 'bomb' && !this.warned.has(e) && e.y < 5.4 && e.y > 2) {
        this.warned.add(e);
        this.audio.play('bombWarn');
      }
    }

    if (this.spawn.boss && !this.bossAnnounced) {
      this.bossAnnounced = true;
      this.audio.play('boss');
      this.emit({ type: 'toast', text: `${this.spawn.boss.name} APPEARS`, tone: 'bad' });
    }
    if (!this.spawn.boss) this.bossAnnounced = false;

    /* --- collisions --------------------------------------------------- */
    this.collisions.update(
      this.playerX,
      this.character.baseY,
      this.spawn.active,
      this.spawn.boss?.entity ?? null,
      {
        onReward: (e) => this.collect(e.kind, e),
        onPower: (e) => this.grabPower(e.kind as never, e),
        onDanger: (e) => this.hitDanger(e.kind, e),
        onBossTouch: () => {
          if (this.power.invincible) return;
          const result = this.health.damage(22);
          this.onDamaged(result, 'guardian');
        },
      },
    );

    /* --- milestones & objectives -------------------------------------- */
    const nextMilestone = Math.floor(this.elapsed / 30);
    if (nextMilestone > this.milestone) {
      this.milestone = nextMilestone;
      this.score.addBonus(60 * nextMilestone);
      this.emit({ type: 'toast', text: `${nextMilestone * 30}s SURVIVED  +${60 * nextMilestone}`, tone: 'good' });
      this.audio.play('levelup');
    }

    const objective = mode.objective;
    let objectiveMet = false;
    if (objective) {
      const progress = this.objectiveProgress(objective.metric);
      objectiveMet = progress >= objective.target;
      if (objectiveMet && mode.id === 'mission') {
        this.endRun(true, 'Mission complete');
        return;
      }
    }
    if (mode.duration !== null && this.elapsed >= mode.duration) {
      this.endRun(objective ? objectiveMet : true, 'Time up');
      return;
    }
    if (mode.id === 'boss' && this.spawn.bossesDefeated >= 3) {
      this.endRun(true, 'All guardians defeated');
      return;
    }

    /* --- world + HUD --------------------------------------------------- */
    this.world.update(this.clock, dt);
    this.hudTimer += dt;
    if (this.hudTimer > 0.1) {
      this.hudTimer = 0;
      this.emitHud();
    }
  }

  /* ---------------------------------------------------------------- */
  /* Gameplay events                                                   */
  /* ---------------------------------------------------------------- */

  private collect(kind: FallingKind, entity: { alive: boolean }): void {
    this.spawn.consume(entity as never);
    const stage = stageDef(this.cfg.stage);
    const stageBonus = 1 + (stage.index - 1) * 0.08;
    this.score.addReward(kind as never, this.power.doublePoints, stageBonus);
    this.runCoins += REWARD_COINS[kind as never] ?? 0;
    const meta = OBJECT_META[kind];
    switch (kind) {
      case 'coin':
        this.audio.play('coin');
        break;
      case 'diamond':
        this.audio.play('diamond');
        break;
      case 'energy':
        this.audio.play('energy');
        break;
      case 'chest':
        this.audio.play('chest');
        this.character.play('jump');
        this.emit({ type: 'toast', text: 'TREASURE CHEST!', tone: 'good' });
        break;
      case 'legendary':
        this.audio.play('legendary');
        this.character.play('jump');
        this.shake = 0.25;
        this.emit({ type: 'toast', text: 'LEGENDARY RELIC!', tone: 'good' });
        break;
      default:
        this.audio.play('coin');
    }
    this.character.play('collect');
    if (this.power.magnet) this.emit({ type: 'toast', text: `MAGNET  ${meta.label}`, tone: 'info' });
    if (kind === 'legendary' || kind === 'chest' || kind === 'diamond') {
      const dmg = kind === 'legendary' ? 2 : 1;
      if (this.spawn.boss) {
        const killed = this.spawn.damageBoss(dmg);
        this.shake = killed ? 0.7 : 0.35;
        this.audio.play(killed ? 'explosion' : 'boss');
        this.emit({
          type: 'toast',
          text: killed ? 'GUARDIAN DESTROYED  +500' : 'GUARDIAN HIT',
          tone: 'good',
        });
        if (killed) this.score.addBonus(500);
      }
    }
    if (this.cfg.haptics && navigator.vibrate) navigator.vibrate(8);
  }

  private grabPower(kind: FallingKind, entity: { alive: boolean }): void {
    this.spawn.consume(entity as never);
    this.power.activate(kind as never);
    this.audio.play('powerup');
    this.character.play('collect');
    const meta = OBJECT_META[kind];
    this.emit({ type: 'toast', text: `${meta.label.toUpperCase()} ACTIVE`, tone: 'good' });
    if (this.cfg.haptics && navigator.vibrate) navigator.vibrate(14);
  }

  private hitDanger(kind: FallingKind, entity: { alive: boolean }): void {
    if (this.power.invincible) return;
    if (this.power.consumeShield()) {
      this.spawn.consume(entity as never);
      this.audio.play('dodge');
      this.emit({ type: 'toast', text: 'SHIELD ABSORBED THE HIT', tone: 'info' });
      this.shake = 0.25;
      return;
    }
    this.spawn.consume(entity as never);
    const damage = DANGER_DAMAGE[kind as never] ?? 25;
    const result = this.health.damage(damage);
    this.onDamaged(result, kind);
  }

  private onDamaged(result: string, source: string): void {
    if (result === 'ignored') return;
    this.hits += 1;
    this.character.play('damage');
    this.shake = 0.55;
    this.audio.play(source === 'guardian' ? 'boss' : 'explosion');
    if (this.cfg.haptics && navigator.vibrate) navigator.vibrate([24, 40, 24]);
    if (result === 'dead') {
      this.endRun(false, 'DIGO ran out of lives');
      return;
    }
    if (result === 'lifeLost') {
      this.emit({ type: 'toast', text: 'LIFE LOST — DIGO RECOVERS', tone: 'bad' });
      this.audio.play('defeat');
    } else {
      this.emit({ type: 'toast', text: 'DAMAGE TAKEN', tone: 'bad' });
    }
    this.emitHud(true);
  }

  private objectiveProgress(metric: string): number {
    switch (metric) {
      case 'coins':
        return this.score.snapshot().coin;
      case 'diamonds':
        return this.score.snapshot().diamond;
      case 'score':
        return this.score.score;
      case 'time':
        return Math.floor(this.elapsed);
      case 'boss':
        return this.spawn.bossesDefeated;
      case 'hits':
        return this.hits;
      default:
        return 0;
    }
  }

  /* ---------------------------------------------------------------- */
  /* HUD / end of run                                                  */
  /* ---------------------------------------------------------------- */

  private emitHud(force = false): void {
    if (this.status === 'over' && !force) return;
    const mode = MODE_MAP[this.cfg.mode];
    const objective = mode.objective
      ? {
          label: mode.objective.label,
          progress: Math.min(mode.objective.target, this.objectiveProgress(mode.objective.metric)),
          target: mode.objective.target,
        }
      : null;
    const hud: HudState = {
      status: this.status,
      score: this.score.score,
      combo: this.score.combo,
      multiplier: this.score.multiplier,
      health: this.health.health,
      maxHealth: this.health.maxHealth,
      lives: this.health.lives,
      maxLives: this.health.maxLives,
      level: 1 + Math.floor(this.score.score / 400),
      time:
        mode.duration !== null
          ? Math.max(0, mode.duration - this.elapsed)
          : Math.floor(this.elapsed),
      world: this.cfg.world,
      mode: this.cfg.mode,
      stage: this.cfg.stage,
      powerups: this.power.list(),
      boss: this.spawn.boss
        ? {
            hp: Math.max(0, this.spawn.boss.hp),
            max: this.spawn.boss.maxHp,
            name: this.spawn.boss.name,
          }
        : null,
      objective,
      coins: this.runCoins,
      shield: this.power.has('shield'),
    };
    this.emit({ type: 'hud', hud });
  }

  private endRun(victory: boolean, reason: string): void {
    if (this.status === 'over') return;
    this.status = 'over';
    this.input.setEnabled(false);
    this.audio.play(victory ? 'victory' : 'defeat');
    if (victory) this.character.play('victory');
    else this.character.play('defeat');
    if (this.cfg.haptics && navigator.vibrate) navigator.vibrate(victory ? [30, 60, 30] : 120);

    const result: RunResult = {
      world: this.cfg.world,
      mode: this.cfg.mode,
      stage: this.cfg.stage,
      score: this.score.score,
      coins: this.runCoins,
      xp: this.score.xp,
      elapsed: Math.round(this.elapsed * 10) / 10,
      collected: this.score.snapshot(),
      hits: this.hits,
      dodged: this.spawn.dodged,
      maxCombo: this.score.maxCombo,
      victory,
      bossDefeated: this.spawn.bossesDefeated,
      powerupsUsed: this.power.used,
      reason,
    };
    this.emitHud(true);
    this.emit({ type: 'over', result });
  }

  /* ---------------------------------------------------------------- */
  /* Layout                                                            */
  /* ---------------------------------------------------------------- */

  private resize = (): void => {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const quality = this.cfg.quality;
    const cap = quality === 'low' ? 1 : quality === 'medium' ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    const halfW = 3.35;
    const halfH = 5.6;
    const tan = Math.tan((this.camera.fov * Math.PI) / 360);
    const distW = halfW / (tan * aspect);
    const distH = halfH / tan;
    this.baseCameraZ = Math.max(distW, distH);
    this.camera.position.set(0, this.cameraTarget.y + 0.15, this.baseCameraZ);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateProjectionMatrix();
  };
}
