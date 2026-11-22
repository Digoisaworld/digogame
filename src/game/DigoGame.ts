import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DigoModel, type DigoAnim } from './character/DigoModel';
import { ParticleSystem } from './render/ParticleSystem';
import { buildWorldVisual, worldById, type WorldVisual } from './worlds';
import { createObjectVisual, OBJECT_RADIUS, type ObjectVisual } from './entities/objectFactory';
import { InputController } from './systems/InputController';
import { AudioManager } from './audio/AudioManager';
import { goalLabel, starsFor } from './levels';
import {
  DANGER_DAMAGE,
  PLAYER,
  POWER_DURATION,
  REWARD_DIGO,
  REWARD_POINTS,
  type Category,
  type DangerKind,
  type FallingKind,
  type GameEvent,
  type HudState,
  type PowerKind,
  type RewardKind,
  type RunConfig,
  type RunResult,
} from './types';

interface Falling {
  kind: FallingKind;
  category: Category;
  visual: ObjectVisual;
  x: number;
  y: number;
  z: number;
  speed: number;
  radius: number;
  phase: number;
}

const REWARD_WEIGHT: Record<RewardKind, number> = { coin: 6, gem: 3, crate: 1.6, relic: 0.5 };
const DANGER_WEIGHT: Record<DangerKind, number> = { bomb: 4, mine: 2.4, barrel: 2, meteor: 1.4 };

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The game engine.
 *
 * Owns the Three.js renderer (ACES tone mapping, soft shadows, PMREM
 * environment reflections, bloom), the DIGO character rig, the world, the
 * falling-object pool and the level rules. React only draws the HUD and sends
 * input events, so gameplay stays frame-rate independent and testable.
 */
export class DigoGame {
  private readonly container: HTMLElement;
  private readonly config: RunConfig;
  private readonly emit: (event: GameEvent) => void;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly composer: EffectComposer | null = null;
  private readonly world: WorldVisual;
  private readonly digo: DigoModel;
  private readonly particles = new ParticleSystem();
  private readonly input: InputController;
  private readonly audio = new AudioManager();
  private readonly clock = new THREE.Clock();
  private readonly rng: () => number;
  private readonly envTexture: THREE.Texture | null;

  private readonly objects: Falling[] = [];
  private readonly pool = new Map<FallingKind, ObjectVisual[]>();

  private state: 'running' | 'paused' | 'over' = 'running';
  private rafId = 0;
  private disposed = false;
  private animTime = 0;
  private hudTimer = 0;
  private shake = 0;

  private score = 0;
  private digoCount = 0;
  private combo = 0;
  private maxCombo = 0;
  private comboTimer = 0;
  private hits = 0;
  private dodged = 0;
  private health: number = PLAYER.health;
  private elapsed = 0;
  private invuln = 0;
  private readonly powers = new Map<PowerKind, number>();
  private readonly collected: Record<RewardKind, number> = { coin: 0, gem: 0, crate: 0, relic: 0 };

  private playerX = 0;
  private facing = 1;
  private jumpY = 0;
  private jumpVel = 0;
  private grounded = true;

  private spawnTimer = 1.1;
  private powerTimer = 12;
  private result: RunResult | null = null;
  private resultSent = false;
  private endTimer = 0;

  private readonly resizeObserver: ResizeObserver | null;
  private readonly onViewportChange = () => this.resize();

  constructor(container: HTMLElement, config: RunConfig, onEvent: (event: GameEvent) => void) {
    this.container = container;
    this.config = config;
    this.emit = onEvent;
    this.rng = mulberry32(config.seed || Date.now());

    const quality = config.quality;
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(dpr, quality === 'high' ? 2 : quality === 'medium' ? 1.6 : 1));
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.setAttribute('aria-label', 'DIGO game view');
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 260);
    this.camera.position.set(0, 3.9, 15.6);
    this.camera.lookAt(0, 4.2, 0);

    const world = worldById(config.level.world);
    this.scene.fog = new THREE.FogExp2(world.fog, world.fogDensity);

    // Physically based image lighting for metal/glass reflections.
    let envTexture: THREE.Texture | null = null;
    if (quality !== 'low') {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environment = envTexture;
      this.scene.environmentIntensity = 0.5;
      pmrem.dispose();
    }
    this.envTexture = envTexture;

    this.world = buildWorldVisual(world, quality);
    this.scene.add(this.world.group);

    const sun = this.world.sun;
    sun.castShadow = quality !== 'low';
    if (sun.castShadow) {
      sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
      sun.shadow.camera.left = -10;
      sun.shadow.camera.right = 10;
      sun.shadow.camera.top = 13;
      sun.shadow.camera.bottom = -4;
      sun.shadow.camera.near = 0.5;
      sun.shadow.camera.far = 48;
      sun.shadow.bias = -0.0009;
      sun.shadow.normalBias = 0.022;
      sun.shadow.camera.updateProjectionMatrix();
    }

    this.digo = new DigoModel();
    this.digo.root.position.set(0, 0, 0);
    this.scene.add(this.digo.root);

    this.scene.add(this.particles.points);

    this.input = new InputController({
      // Swipe/drag movement is relative to DIGO's current position, so the
      // character follows the finger instead of teleporting under it. Physics,
      // speed and jump height are unchanged.
      getX: () => this.digo.root.position.x,
    });

    this.audio.setVolumes(config.musicVolume, config.sfxVolume);

    if (quality !== 'low') {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      // Softer, tighter bloom: the old wide glow bled over DIGO and made the
      // character look soft and washed out. Threshold raised so only the
      // brightest highlights bloom.
      const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.34, 0.5, 0.9);
      this.composer.addPass(bloom);
      this.composer.addPass(new OutputPass());
    }

    this.resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => this.resize())
        : null;
    this.resizeObserver?.observe(container);
    window.addEventListener('resize', this.onViewportChange);
    window.addEventListener('orientationchange', this.onViewportChange);
    this.resize();

    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
    this.emit({ type: 'hud', hud: this.hud() });
    this.emit({ type: 'ready' });
  }

  /* ------------------------------------------------------------------ */
  /* public api                                                          */
  /* ------------------------------------------------------------------ */

  attachPad(el: HTMLElement | null): void {
    this.input.attachPad(el);
  }

  setDirection(dir: number): void {
    this.input.setDirection(dir);
  }

  jump(): void {
    this.input.requestJump();
  }

  setVolumes(music: number, sfx: number): void {
    this.audio.setVolumes(music, sfx);
  }

  /** Called from a user gesture so the audio context can unlock. */
  startAudio(): void {
    this.audio.unlock();
    this.audio.startMusic(worldById(this.config.level.world));
  }

  pause(): void {
    if (this.state === 'over') return;
    this.state = 'paused';
    this.audio.stopMusic();
    this.emit({ type: 'hud', hud: this.hud() });
  }

  resume(): void {
    if (this.state === 'over') return;
    this.state = 'running';
    this.clock.getDelta();
    this.audio.startMusic(worldById(this.config.level.world));
    this.emit({ type: 'hud', hud: this.hud() });
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.onViewportChange);
    window.removeEventListener('orientationchange', this.onViewportChange);
    this.input.dispose();
    this.audio.dispose();
    for (const list of this.pool.values()) list.length = 0;
    this.objects.length = 0;
    this.scene.remove(this.world.group);
    this.world.dispose();
    this.scene.remove(this.digo.root);
    this.digo.dispose();
    this.scene.remove(this.particles.points);
    this.particles.dispose();
    this.composer?.dispose();
    this.envTexture?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  /* ------------------------------------------------------------------ */
  /* frame                                                               */
  /* ------------------------------------------------------------------ */

  private resize(): void {
    // Some embedded and headless browsers resolve percentage/viewport heights to
    // 0, which silently collapses the canvas to a 0x0 box. Drive the size from
    // the window metrics and pin explicit pixel dimensions so it can never
    // disappear, with sensible portrait fallbacks if every metric is 0.
    const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(320, Math.round(viewportW || rect.width || 390));
    const h = Math.max(480, Math.round(viewportH || rect.height || 844));

    const canvas = this.renderer.domElement;
    if (this.container.style.width !== `${w}px`) this.container.style.width = `${w}px`;
    if (this.container.style.height !== `${h}px`) this.container.style.height = `${h}px`;
    if (canvas.style.width !== `${w}px`) canvas.style.width = `${w}px`;
    if (canvas.style.height !== `${h}px`) canvas.style.height = `${h}px`;

    this.camera.aspect = w / h;
    // Keep the full lane visible on tall phones.
    this.camera.fov = this.camera.aspect < 0.75 ? 56 : this.camera.aspect < 1 ? 50 : 46;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
  }

  private loop(): void {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());

    if (this.state === 'running' && !this.result) this.step(dt);
    else if (this.result) this.finishStep(dt);
    else this.idleStep(dt);

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  private idleStep(dt: number): void {
    this.animTime += dt * 0.35;
    this.world.update(dt, this.animTime);
    this.particles.update(dt);
    this.digo.update(dt, 'idle', { dir: 0, speed: 0, grounded: true });
  }

  private step(dt: number): void {
    this.elapsed += dt;
    this.animTime += dt;
    const level = this.config.level;

    this.updatePlayer(dt);
    this.updateObjects(dt);
    this.updatePowers(dt);
    this.updateSpawning(dt);
    this.updateCamera(dt);

    this.world.update(dt, this.animTime);
    this.particles.update(dt);

    if (this.invuln > 0) {
      this.invuln = Math.max(0, this.invuln - dt);
      this.digo.setTint('#ff4d4d', this.invuln > 0 ? 0.45 : 0);
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // Goal / timeout resolution
    if (this.goalProgress() >= level.goal.target) {
      this.finish(true, 'Objective complete');
    } else if (this.elapsed >= level.timeLimit) {
      this.finish(false, 'Time ran out');
    }

    this.hudTimer += dt;
    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0;
      this.emit({ type: 'hud', hud: this.hud() });
    }
  }

  private finishStep(dt: number): void {
    this.animTime += dt;
    this.world.update(dt, this.animTime);
    this.particles.update(dt);
    this.updateCamera(dt);
    this.digo.update(dt, this.result?.victory ? 'victory' : 'defeat', {
      dir: 0,
      speed: 0,
      grounded: true,
    });
    if (!this.resultSent) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) {
        this.resultSent = true;
        this.emit({ type: 'over', result: this.result as RunResult });
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* player                                                             */
  /* ------------------------------------------------------------------ */

  private updatePlayer(dt: number): void {
    const target = this.input.targetX;
    let dir = 0;

    if (target !== null) {
      const delta = target - this.playerX;
      this.playerX += delta * Math.min(1, dt * 16);
      dir = Math.abs(delta) > 0.02 ? Math.sign(delta) : 0;
    } else {
      dir = this.input.direction;
      this.playerX += dir * PLAYER.speed * dt;
    }

    this.playerX = clamp(this.playerX, -PLAYER.lane, PLAYER.lane);
    if (dir !== 0) this.facing = dir;

    if (this.input.consumeJump() && this.grounded) {
      this.jumpVel = PLAYER.jumpVelocity;
      this.grounded = false;
      this.audio.play('dodge');
      this.particles.burst(new THREE.Vector3(this.playerX, 0.08, 0), {
        count: 10,
        color: '#ffffff',
        color2: this.config.level.world === 'lava' ? '#ff8a00' : '#cfe6ff',
        speed: 1.4,
        spread: 0.9,
        size: 0.5,
        life: 0.5,
        gravity: 1.5,
        direction: new THREE.Vector3(0, 1, 0),
      });
    }

    if (!this.grounded) {
      this.jumpVel -= PLAYER.gravity * dt;
      this.jumpY += this.jumpVel * dt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.jumpVel = 0;
        this.grounded = true;
      }
    }

    this.digo.root.position.set(this.playerX, this.jumpY, 0);
    this.digo.root.rotation.y = lerp(this.digo.root.rotation.y, this.facing * 0.28, Math.min(1, dt * 8));

    let anim: DigoAnim = 'idle';
    if (!this.grounded) anim = this.jumpVel > 0 ? 'jump' : 'fall';
    else if (Math.abs(dir) > 0.05) anim = 'run';

    this.digo.update(dt, anim, {
      dir,
      speed: Math.min(1, Math.abs(dir)),
      grounded: this.grounded,
    });
    this.digo.setAura(this.powers.has('invincible') ? 1 : this.powers.has('shield') ? 0.55 : 0);
  }

  private updateCamera(dt: number): void {
    const targetX = this.playerX * 0.18;
    this.camera.position.x += (targetX - this.camera.position.x) * Math.min(1, dt * 4);
    const s = this.shake;
    this.camera.position.y = 3.9 + (Math.random() - 0.5) * s * 0.35;
    this.camera.position.z = 15.6 + (Math.random() - 0.5) * s * 0.2;
    this.camera.lookAt(this.playerX * 0.08, 4.15, 0);
    this.shake = Math.max(0, this.shake - dt * 2.4);
  }

  /* ------------------------------------------------------------------ */
  /* objects                                                            */
  /* ------------------------------------------------------------------ */

  private updateSpawning(dt: number): void {
    const level = this.config.level;
    const p = clamp(this.elapsed / Math.max(1, level.timeLimit), 0, 1);
    const interval = lerp(level.spawn.interval[0], level.spawn.interval[1], p);

    this.spawnTimer -= dt;
    this.powerTimer -= dt;

    if (this.spawnTimer <= 0) {
      this.spawnOne(p);
      this.spawnTimer = interval * (0.85 + this.rng() * 0.3);
    }
  }

  private pickReward(): RewardKind {
    const list = this.config.level.rewards;
    const total = list.reduce((sum, k) => sum + REWARD_WEIGHT[k], 0);
    let roll = this.rng() * total;
    for (const k of list) {
      roll -= REWARD_WEIGHT[k];
      if (roll <= 0) return k;
    }
    return list[0];
  }

  private pickDanger(): DangerKind {
    const list = this.config.level.dangers;
    const total = list.reduce((sum, k) => sum + DANGER_WEIGHT[k], 0);
    let roll = this.rng() * total;
    for (const k of list) {
      roll -= DANGER_WEIGHT[k];
      if (roll <= 0) return k;
    }
    return list[0];
  }

  private spawnOne(p: number): void {
    const level = this.config.level;
    const dangersAlive = this.objects.filter((o) => o.category === 'danger').length;
    const rewardsAlive = this.objects.filter((o) => o.category === 'reward').length;

    let category: Category;
    if (this.powerTimer <= 0 && level.powers.length > 0) {
      category = 'power';
      this.powerTimer = 14 + this.rng() * 8;
    } else if (dangersAlive < level.spawn.maxDangers && this.rng() < level.spawn.dangerBias * (0.8 + p * 0.45)) {
      category = 'danger';
    } else {
      category = 'reward';
    }
    // Never starve the player of rewards.
    if (category === 'danger' && rewardsAlive === 0 && this.rng() < 0.5) category = 'reward';

    let kind: FallingKind;
    if (category === 'danger') kind = this.pickDanger();
    else if (category === 'power') kind = level.powers[Math.floor(this.rng() * level.powers.length)];
    else kind = this.pickReward();

    const margin = 0.8;
    let x = (this.rng() * 2 - 1) * (PLAYER.lane - margin);
    if (category === 'danger') {
      for (let i = 0; i < 3 && Math.abs(x - this.playerX) < 1.4; i += 1) {
        x = (this.rng() * 2 - 1) * (PLAYER.lane - margin);
      }
    }

    const baseSpeed = lerp(level.spawn.speed[0], level.spawn.speed[1], p);
    const speed = baseSpeed * (0.88 + this.rng() * 0.26) * (category === 'danger' ? 1.06 : 1);

    const visual = this.acquire(kind);
    const entity: Falling = {
      kind,
      category,
      visual,
      x,
      y: 12.6,
      z: (this.rng() * 2 - 1) * 0.65,
      speed,
      radius: OBJECT_RADIUS[kind],
      phase: this.rng() * Math.PI * 2,
    };
    visual.group.position.set(entity.x, entity.y, entity.z);
    visual.group.visible = true;
    this.objects.push(entity);

    if (kind === 'bomb' || kind === 'meteor') this.audio.play('bombWarn');
  }

  private acquire(kind: FallingKind): ObjectVisual {
    const list = this.pool.get(kind);
    const cached = list?.pop();
    const visual = cached ?? createObjectVisual(kind);
    if (!list) this.pool.set(kind, []);
    this.scene.add(visual.group);
    return visual;
  }

  private release(entity: Falling): void {
    this.scene.remove(entity.visual.group);
    entity.visual.group.visible = false;
    this.pool.get(entity.kind)?.push(entity.visual);
  }

  private updateObjects(dt: number): void {
    const slow = this.powers.has('slow') ? 0.42 : 1;
    const magnet = this.powers.has('magnet');

    for (let i = this.objects.length - 1; i >= 0; i -= 1) {
      const o = this.objects[i];
      o.y -= o.speed * slow * dt;

      if (magnet && o.category === 'reward') {
        o.x += (this.playerX - o.x) * Math.min(1, dt * 3.6);
        o.y += (this.jumpY + 0.9 - o.y) * Math.min(1, dt * 1.4);
      }

      o.visual.group.position.set(o.x, o.y, o.z);
      o.visual.update(dt, this.animTime + o.phase);

      if (this.collides(o)) {
        this.objects.splice(i, 1);
        this.resolve(o);
        this.release(o);
        continue;
      }

      if (o.y < -3.2) {
        this.objects.splice(i, 1);
        if (o.category === 'danger') this.dodged += 1;
        this.release(o);
      }
    }
  }

  private collides(o: Falling): boolean {
    const bottom = this.jumpY + 0.12;
    const top = this.jumpY + 1.62;
    if (o.y + o.radius < bottom || o.y - o.radius > top) return false;
    const dx = Math.abs(o.x - this.playerX);
    const reach = PLAYER.radius + o.radius + (o.category === 'reward' ? 0.22 : -0.06);
    return dx <= reach;
  }

  private resolve(o: Falling): void {
    const pos = new THREE.Vector3(o.x, o.y, o.z);

    if (o.category === 'reward') {
      this.collect(o.kind as RewardKind, pos);
      return;
    }
    if (o.category === 'power') {
      this.applyPower(o.kind as PowerKind, pos);
      return;
    }
    this.damage(o.kind as DangerKind, pos);
  }

  private collect(kind: RewardKind, pos: THREE.Vector3): void {
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboTimer = 3.4;

    const mult = this.multiplier();
    const gain = Math.round(REWARD_POINTS[kind] * mult * (this.powers.has('double') ? 2 : 1));
    this.score += gain;
    this.digoCount += REWARD_DIGO[kind];
    this.collected[kind] += 1;

    const color = kind === 'gem' ? '#5fd8ff' : kind === 'relic' ? '#c084fc' : '#ffcf4d';
    this.particles.burst(pos, {
      count: kind === 'relic' ? 46 : kind === 'coin' ? 14 : 24,
      color,
      color2: '#ffffff',
      speed: 3.2,
      spread: 1,
      size: 0.85,
      life: 0.7,
      gravity: -1.2,
    });

    this.digo.react('collect');
    this.audio.play(
      kind === 'coin' ? 'coin' : kind === 'gem' ? 'diamond' : kind === 'relic' ? 'legendary' : 'chest',
    );
    if (kind === 'relic') {
      this.shake = 0.25;
      this.emit({ type: 'toast', text: `DIGO Relic  +${gain}`, tone: 'good' });
    }
  }

  private applyPower(kind: PowerKind, pos: THREE.Vector3): void {
    this.powers.set(kind, POWER_DURATION[kind]);
    this.particles.burst(pos, {
      count: 30,
      color: '#ffffff',
      color2: '#7fe3ff',
      speed: 3.4,
      spread: 1,
      size: 1,
      life: 0.8,
      gravity: -0.6,
    });
    this.audio.play('powerup');
    this.emit({ type: 'toast', text: `${POWER_LABEL[kind]} active`, tone: 'info' });
  }

  private damage(kind: DangerKind, pos: THREE.Vector3): void {
    if (this.powers.has('invincible') || this.invuln > 0) return;

    if (this.powers.has('shield')) {
      this.powers.delete('shield');
      this.particles.burst(pos, {
        count: 26,
        color: '#4da3ff',
        color2: '#ffffff',
        speed: 4,
        spread: 1,
        size: 1,
        life: 0.6,
        gravity: 0,
      });
      this.audio.play('powerup');
      this.emit({ type: 'toast', text: 'Shield absorbed the hit', tone: 'info' });
      return;
    }

    this.health = Math.max(0, this.health - DANGER_DAMAGE[kind]);
    this.hits += 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.invuln = PLAYER.invulnTime;
    this.shake = 0.62;

    this.particles.burst(pos, {
      count: 44,
      color: '#ff7a18',
      color2: '#ff2d1a',
      speed: 5.5,
      spread: 1,
      size: 1.5,
      life: 0.8,
      gravity: 2.4,
    });
    this.digo.react('hurt');
    this.audio.play('explosion');
    this.emit({ type: 'toast', text: `-${DANGER_DAMAGE[kind]} HP`, tone: 'bad' });

    if (this.health <= 0) this.finish(false, 'DIGO ran out of health');
  }

  private updatePowers(dt: number): void {
    for (const [kind, remaining] of [...this.powers.entries()]) {
      const next = remaining - dt;
      if (next <= 0) this.powers.delete(kind);
      else this.powers.set(kind, next);
    }
  }

  /* ------------------------------------------------------------------ */
  /* rules                                                              */
  /* ------------------------------------------------------------------ */

  private multiplier(): number {
    return Math.min(4, 1 + Math.floor(this.combo / 5) * 0.5);
  }

  private goalProgress(): number {
    const goal = this.config.level.goal;
    if (goal.kind === 'collect') return this.digoCount;
    if (goal.kind === 'survive') return this.elapsed;
    return this.score;
  }

  private finish(victory: boolean, reason: string): void {
    if (this.result) return;
    const level = this.config.level;
    const bonus = victory ? level.bonus : 0;
    const score = Math.round(this.score);

    this.result = {
      level: level.id,
      world: level.world,
      score,
      digo: this.digoCount,
      bonus,
      total: score + bonus,
      elapsed: Math.round(this.elapsed),
      collected: { ...this.collected },
      hits: this.hits,
      dodged: this.dodged,
      maxCombo: this.maxCombo,
      victory,
      stars: victory ? starsFor(level, score) : 0,
      reason,
    };
    this.endTimer = 1.5;

    if (victory) {
      this.digo.react('victory');
      this.audio.play('victory');
      for (let i = 0; i < 3; i += 1) {
        this.particles.burst(
          new THREE.Vector3((this.rng() * 2 - 1) * 3, 3 + this.rng() * 3, 1.5),
          {
            count: 40,
            color: ['#ffcf4d', '#5fd8ff', '#c084fc'][i % 3],
            color2: '#ffffff',
            speed: 5,
            spread: 1,
            size: 1.2,
            life: 1.8,
            gravity: 3.2,
          },
        );
      }
      this.emit({ type: 'toast', text: `Level ${level.id} complete  +${bonus} bonus`, tone: 'good' });
    } else {
      this.digo.react('defeat');
      this.audio.play('defeat');
    }
    this.emit({ type: 'hud', hud: this.hud() });
  }

  private hud(): HudState {
    const level = this.config.level;
    return {
      status: this.result ? 'over' : this.state,
      score: Math.round(this.score),
      digo: this.digoCount,
      combo: this.combo,
      multiplier: this.multiplier(),
      health: Math.round(this.health),
      maxHealth: PLAYER.health,
      level: level.id,
      levelName: level.name,
      world: level.world,
      time: Math.max(0, level.timeLimit - this.elapsed),
      timeLimit: level.timeLimit,
      goal: {
        kind: level.goal.kind,
        label: goalLabel(level),
        progress: Math.round(this.goalProgress()),
        target: level.goal.target,
      },
      powerups: [...this.powers.entries()].map(([kind, remaining]) => ({
        kind,
        remaining,
        total: POWER_DURATION[kind],
      })),
      shield: this.powers.has('shield'),
      invincible: this.powers.has('invincible'),
      stars: starsFor(level, this.score),
    };
  }
}

const POWER_LABEL: Record<PowerKind, string> = {
  shield: 'Shield',
  magnet: 'Magnet',
  slow: 'Slow Motion',
  double: 'Double Points',
  invincible: 'Invincible',
};
