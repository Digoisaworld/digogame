import * as THREE from 'three';
import { stageDef, type StageDef } from '../progression';

export type AnimName =
  | 'idle'
  | 'run'
  | 'left'
  | 'right'
  | 'dodge'
  | 'collect'
  | 'damage'
  | 'jump'
  | 'victory'
  | 'defeat';

type BaseAnim = 'idle' | 'run' | 'left' | 'right';

const ONESHOT: Record<string, number> = {
  dodge: 0.45,
  collect: 0.5,
  damage: 0.7,
  jump: 0.65,
};

/**
 * DIGO — procedural, game-ready 3D character.
 *
 * Identity is fixed across every evolution stage: round golden body, oversized
 * cyan eyes, long floppy ears, chest crystal and a stubby tail. Stages only add
 * scale, armour/aura detail and palette shifts, so the creature never turns into
 * a different mascot.
 *
 * Animation is skeletal-style code animation (no external rig files), which
 * keeps the whole character portable inside the repository.
 */
export class DigoCharacter {
  readonly group = new THREE.Group();
  readonly baseY = -1.2;

  private readonly stage: StageDef;
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];

  private body!: THREE.Mesh;
  private belly!: THREE.Mesh;
  private head!: THREE.Mesh;
  private muzzle!: THREE.Mesh;
  private earL!: THREE.Mesh;
  private earR!: THREE.Mesh;
  private armL!: THREE.Mesh;
  private armR!: THREE.Mesh;
  private legL!: THREE.Mesh;
  private legR!: THREE.Mesh;
  private tail!: THREE.Mesh;
  private crystal!: THREE.Mesh;
  private eyeGroup!: THREE.Group;
  private irisL!: THREE.Mesh;
  private irisR!: THREE.Mesh;
  private aura!: THREE.Mesh;
  private wings!: THREE.Group;
  private crown!: THREE.Group;
  private shadow!: THREE.Mesh;
  private furMat!: THREE.MeshStandardMaterial;
  private furDarkMat!: THREE.MeshStandardMaterial;
  private irisMat!: THREE.MeshStandardMaterial;
  private crystalMat!: THREE.MeshStandardMaterial;

  private t = 0;
  private base: BaseAnim = 'idle';
  private overlay: { name: AnimName; t: number; dur: number } | null = null;
  private victory = false;
  private defeated = false;
  private flash = 0;
  private squash = 0;
  private facing = 1;
  private velocityX = 0;
  private blinkTimer = 2.5;
  private blink = 0;

  constructor(stage = 1) {
    this.stage = stageDef(stage);
    this.build();
    this.group.position.set(0, this.baseY, 0);
  }

  private track<T extends THREE.BufferGeometry>(geo: T): T {
    this.geometries.push(geo);
    return geo;
  }

  private mat(m: THREE.Material): THREE.Material {
    this.materials.push(m);
    return m;
  }

  private build(): void {
    const s = this.stage;
    this.furMat = this.mat(
      new THREE.MeshStandardMaterial({
        color: s.fur,
        roughness: 0.52,
        metalness: 0.12,
        emissive: new THREE.Color(s.fur).multiplyScalar(0.06),
      }),
    ) as THREE.MeshStandardMaterial;
    this.furDarkMat = this.mat(
      new THREE.MeshStandardMaterial({ color: s.furDark, roughness: 0.6, metalness: 0.1 }),
    ) as THREE.MeshStandardMaterial;
    const bellyMat = this.mat(
      new THREE.MeshStandardMaterial({ color: s.accent, roughness: 0.45, metalness: 0.15 }),
    );
    const eyeWhite = this.mat(
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.05 }),
    );
    this.irisMat = this.mat(
      new THREE.MeshStandardMaterial({
        color: s.eye,
        emissive: new THREE.Color(s.eye).multiplyScalar(0.85),
        roughness: 0.15,
        metalness: 0.3,
      }),
    ) as THREE.MeshStandardMaterial;
    const pupilMat = this.mat(new THREE.MeshBasicMaterial({ color: 0x0a1024 }));
    this.crystalMat = this.mat(
      new THREE.MeshStandardMaterial({
        color: s.crystal,
        emissive: new THREE.Color(s.crystal).multiplyScalar(0.9),
        roughness: 0.1,
        metalness: 0.5,
        transparent: true,
        opacity: 0.92,
      }),
    ) as THREE.MeshStandardMaterial;

    this.body = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.5, 24, 18)),
      this.furMat,
    );
    this.body.scale.set(1, 0.95, 0.88);
    this.body.position.y = 0.72;
    this.group.add(this.body);

    this.belly = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.36, 20, 16)),
      bellyMat,
    );
    this.belly.scale.set(1, 1.05, 0.5);
    this.belly.position.set(0, 0.68, 0.3);
    this.group.add(this.belly);

    this.head = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.46, 26, 20)), this.furMat);
    this.head.position.y = 1.32;
    this.head.scale.set(1.05, 1, 1);
    this.group.add(this.head);

    this.muzzle = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.23, 18, 14)),
      bellyMat,
    );
    this.muzzle.scale.set(1.25, 0.85, 0.8);
    this.muzzle.position.set(0, 1.2, 0.34);
    this.group.add(this.muzzle);

    const nose = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.07, 12, 10)),
      pupilMat,
    );
    nose.position.set(0, 1.26, 0.52);
    this.group.add(nose);

    // Oversized cyan eyes — the strongest identity feature of DIGO.
    this.eyeGroup = new THREE.Group();
    this.eyeGroup.position.y = 1.38;
    this.group.add(this.eyeGroup);
    const eyeGeo = this.track(new THREE.SphereGeometry(0.17, 18, 14));
    const irisGeo = this.track(new THREE.SphereGeometry(0.115, 16, 12));
    const pupilGeo = this.track(new THREE.SphereGeometry(0.052, 12, 10));
    const glintGeo = this.track(new THREE.SphereGeometry(0.028, 8, 8));
    for (const side of [-1, 1]) {
      const white = new THREE.Mesh(eyeGeo, eyeWhite);
      white.position.set(0.185 * side, 0, 0.31);
      white.scale.set(1, 1.08, 0.9);
      this.eyeGroup.add(white);
      const iris = new THREE.Mesh(irisGeo, this.irisMat);
      iris.position.set(0.185 * side, 0, 0.4);
      this.eyeGroup.add(iris);
      if (side < 0) this.irisL = iris;
      else this.irisR = iris;
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(0.185 * side, 0, 0.455);
      this.eyeGroup.add(pupil);
      const glint = new THREE.Mesh(glintGeo, eyeWhite);
      glint.position.set(0.185 * side - 0.03, 0.045, 0.48);
      this.eyeGroup.add(glint);
    }

    // Long floppy ears.
    const earGeo = this.track(new THREE.SphereGeometry(0.2, 16, 12));
    this.earL = new THREE.Mesh(earGeo, this.furDarkMat);
    this.earL.scale.set(0.62, 1.15, 0.4);
    this.earL.position.set(-0.42, 1.5, -0.02);
    this.earL.rotation.z = 0.55;
    this.group.add(this.earL);
    this.earR = new THREE.Mesh(earGeo, this.furDarkMat);
    this.earR.scale.set(0.62, 1.15, 0.4);
    this.earR.position.set(0.42, 1.5, -0.02);
    this.earR.rotation.z = -0.55;
    this.group.add(this.earR);

    // Arms.
    const armGeo = this.track(new THREE.CapsuleGeometry(0.095, 0.22, 6, 12));
    this.armL = new THREE.Mesh(armGeo, this.furMat);
    this.armL.position.set(-0.5, 0.82, 0.02);
    this.armL.rotation.z = 0.5;
    this.group.add(this.armL);
    this.armR = new THREE.Mesh(armGeo, this.furMat);
    this.armR.position.set(0.5, 0.82, 0.02);
    this.armR.rotation.z = -0.5;
    this.group.add(this.armR);

    // Legs.
    const legGeo = this.track(new THREE.CapsuleGeometry(0.13, 0.2, 6, 12));
    this.legL = new THREE.Mesh(legGeo, this.furDarkMat);
    this.legL.position.set(-0.2, 0.22, 0);
    this.group.add(this.legL);
    this.legR = new THREE.Mesh(legGeo, this.furDarkMat);
    this.legR.position.set(0.2, 0.22, 0);
    this.group.add(this.legR);

    // Tail.
    this.tail = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.15, 14, 12)),
      this.furDarkMat,
    );
    this.tail.scale.set(0.9, 1.15, 0.9);
    this.tail.position.set(0, 0.62, -0.42);
    this.group.add(this.tail);

    // Chest crystal.
    this.crystal = new THREE.Mesh(
      this.track(new THREE.OctahedronGeometry(0.17, 0)),
      this.crystalMat,
    );
    this.crystal.position.set(0, 0.95, 0.4);
    this.crystal.scale.set(0.9, 1.3, 0.9);
    this.group.add(this.crystal);

    // Stage extras.
    this.aura = new THREE.Mesh(
      this.track(new THREE.TorusGeometry(0.78, 0.035, 8, 40)),
      this.mat(
        new THREE.MeshBasicMaterial({
          color: s.accent,
          transparent: true,
          opacity: 0.75,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
    this.aura.rotation.x = Math.PI / 2;
    this.aura.position.y = 0.06;
    this.aura.visible = s.index >= 3;
    this.group.add(this.aura);

    this.wings = new THREE.Group();
    const wingMat = this.mat(
      new THREE.MeshBasicMaterial({
        color: s.crystal,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.34, 1.05, 4)), wingMat);
      wing.position.set(0.42 * side, 1.0, -0.42);
      wing.rotation.z = (Math.PI / 2) * side * 0.72;
      wing.rotation.y = 0.4 * side;
      this.wings.add(wing);
    }
    this.wings.visible = s.index >= 4;
    this.group.add(this.wings);

    this.crown = new THREE.Group();
    const crownMat = this.mat(
      new THREE.MeshStandardMaterial({
        color: 0xffe066,
        metalness: 1,
        roughness: 0.18,
        emissive: 0x8a6b00,
      }),
    );
    const band = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.24, 0.035, 8, 24)), crownMat);
    band.rotation.x = Math.PI / 2;
    this.crown.add(band);
    for (let i = 0; i < 5; i += 1) {
      const spike = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.05, 0.18, 6)), crownMat);
      const a = (i / 5) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.24, 0.1, Math.sin(a) * 0.24);
      this.crown.add(spike);
    }
    this.crown.position.set(0, 1.78, 0);
    this.crown.visible = s.index >= 5;
    this.group.add(this.crown);

    // Soft contact shadow keeps DIGO grounded without a shadow map.
    this.shadow = new THREE.Mesh(
      this.track(new THREE.CircleGeometry(0.62, 28)),
      this.mat(
        new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
        }),
      ),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.012;
    this.group.add(this.shadow);

    this.group.scale.setScalar(s.scale);
  }

  setVelocityX(vx: number): void {
    this.velocityX = vx;
  }

  setMoving(moving: boolean): void {
    this.base = moving ? 'run' : 'idle';
  }

  /** Plays a one-shot animation (collect/dodge/damage/jump) over the base pose. */
  play(name: AnimName): void {
    if (name === 'victory' || name === 'defeat') {
      this.victory = name === 'victory';
      this.defeated = name === 'defeat';
      this.overlay = null;
      return;
    }
    if (name === 'idle' || name === 'run' || name === 'left' || name === 'right') {
      this.base = name;
      return;
    }
    const dur = ONESHOT[name] ?? 0.5;
    this.overlay = { name, t: 0, dur };
    if (name === 'damage') this.flash = 1;
    if (name === 'collect') this.squash = 1;
  }

  setFacing(dir: number): void {
    this.facing = dir < -0.05 ? -1 : dir > 0.05 ? 1 : this.facing;
  }

  get currentAnim(): AnimName {
    if (this.defeated) return 'defeat';
    if (this.victory) return 'victory';
    if (this.overlay) return this.overlay.name;
    return this.base;
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;

    if (this.overlay) {
      this.overlay.t += dt;
      if (this.overlay.t >= this.overlay.dur) this.overlay = null;
    }
    this.flash = Math.max(0, this.flash - dt * 2.6);
    this.squash = Math.max(0, this.squash - dt * 2.4);
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blink = 1;
      this.blinkTimer = 2.2 + Math.random() * 2.6;
    }
    this.blink = Math.max(0, this.blink - dt * 7);

    // Reset the rig each frame, then pose it for the active animation.
    this.group.rotation.set(0, 0, 0);
    this.group.position.y = this.baseY;
    this.body.position.set(0, 0.72, 0);
    this.body.rotation.set(0, 0, 0);
    this.head.position.set(0, 1.32, 0);
    this.head.rotation.set(0, 0, 0);
    this.armL.rotation.set(0, 0, 0.5);
    this.armR.rotation.set(0, 0, -0.5);
    this.legL.rotation.set(0, 0, 0);
    this.legR.rotation.set(0, 0, 0);
    this.earL.rotation.set(0, 0, 0.55);
    this.earR.rotation.set(0, 0, -0.55);
    this.tail.rotation.set(0, 0, 0);
    this.crystal.rotation.set(0, 0, 0);
    this.eyeGroup.scale.set(1, 1, 1);
    this.group.scale.setScalar(this.stage.scale);
    this.aura.rotation.z = t * 0.9;
    this.crown.rotation.y = t * 0.6;
    this.wings.rotation.z = Math.sin(t * 3) * 0.12;

    const lean = Math.max(-1, Math.min(1, this.velocityX / 6));
    const anim = this.currentAnim;

    switch (anim) {
      case 'idle': {
        const bob = Math.sin(t * 2.4) * 0.035;
        this.group.position.y = this.baseY + bob;
        this.body.scale.set(1, 0.95 + bob * 0.2, 0.88);
        this.head.rotation.z = Math.sin(t * 1.2) * 0.05;
        this.earL.rotation.z = 0.55 + Math.sin(t * 1.6) * 0.09;
        this.earR.rotation.z = -0.55 - Math.sin(t * 1.6) * 0.09;
        this.tail.rotation.y = Math.sin(t * 3.2) * 0.4;
        this.crystal.rotation.y = t * 0.8;
        break;
      }
      case 'run': {
        const cyc = t * 12;
        const bob = Math.abs(Math.sin(cyc)) * 0.07;
        this.group.position.y = this.baseY + bob;
        this.group.rotation.z = -lean * 0.18;
        this.legL.rotation.x = Math.sin(cyc) * 0.85;
        this.legR.rotation.x = -Math.sin(cyc) * 0.85;
        this.armL.rotation.x = -Math.sin(cyc) * 0.7;
        this.armR.rotation.x = Math.sin(cyc) * 0.7;
        this.armL.rotation.z = 0.5 + Math.sin(cyc) * 0.12;
        this.armR.rotation.z = -0.5 - Math.sin(cyc) * 0.12;
        this.head.rotation.z = -lean * 0.12;
        this.earL.rotation.z = 0.55 + Math.sin(cyc * 0.5) * 0.22;
        this.earR.rotation.z = -0.55 - Math.sin(cyc * 0.5) * 0.22;
        this.body.scale.set(1, 0.95 - bob * 0.3, 0.88 + bob * 0.2);
        this.tail.rotation.y = Math.sin(cyc * 0.5) * 0.5;
        this.crystal.rotation.y = t * 1.6;
        break;
      }
      case 'left':
      case 'right': {
        const dir = anim === 'left' ? -1 : 1;
        this.group.rotation.z = dir * 0.24;
        this.group.position.x += dir * 0.02;
        this.legL.rotation.x = dir * 0.5;
        this.legR.rotation.x = -dir * 0.5;
        this.armL.rotation.z = 0.5 + dir * 0.5;
        this.armR.rotation.z = -0.5 + dir * 0.5;
        this.head.rotation.z = dir * 0.16;
        this.earL.rotation.z = 0.55 + dir * 0.35;
        this.earR.rotation.z = -0.55 + dir * 0.35;
        this.group.position.y = this.baseY + Math.abs(Math.sin(t * 10)) * 0.03;
        break;
      }
      case 'dodge': {
        const p = this.overlay ? this.overlay.t / this.overlay.dur : 0;
        const k = Math.sin(p * Math.PI);
        this.group.position.y = this.baseY + k * 0.35;
        this.group.rotation.x = k * 0.9;
        this.group.rotation.z = -lean * 0.5;
        this.body.scale.set(1 + k * 0.1, 0.95 - k * 0.15, 0.88 + k * 0.1);
        this.armL.rotation.z = 0.5 + k * 1.4;
        this.armR.rotation.z = -0.5 - k * 1.4;
        break;
      }
      case 'collect': {
        const p = this.overlay ? this.overlay.t / this.overlay.dur : 0;
        const k = Math.sin(p * Math.PI);
        this.group.position.y = this.baseY + k * 0.22;
        this.armL.rotation.z = 0.5 + k * 2.2;
        this.armR.rotation.z = -0.5 - k * 2.2;
        this.armL.rotation.x = -k * 0.6;
        this.armR.rotation.x = -k * 0.6;
        this.head.rotation.x = -k * 0.22;
        this.crystal.scale.setScalar(1 + k * 0.6);
        this.eyeGroup.scale.set(1 + k * 0.18, 1 + k * 0.18, 1);
        break;
      }
      case 'damage': {
        const p = this.overlay ? this.overlay.t / this.overlay.dur : 0;
        const k = Math.sin(p * Math.PI * 2) * (1 - p);
        this.group.position.x += k * 0.28;
        this.group.rotation.z = k * 0.35;
        this.head.rotation.z = k * 0.3;
        this.armL.rotation.z = 0.5 + k * 1.1;
        this.armR.rotation.z = -0.5 - k * 1.1;
        this.eyeGroup.scale.set(1 + k * 0.2, 1 - k * 0.5, 1);
        break;
      }
      case 'jump': {
        const p = this.overlay ? this.overlay.t / this.overlay.dur : 0;
        const h = Math.sin(p * Math.PI);
        this.group.position.y = this.baseY + h * 1.15;
        this.body.scale.set(1 - h * 0.06, 0.95 + h * 0.14, 0.88 - h * 0.05);
        this.legL.rotation.x = -h * 0.9;
        this.legR.rotation.x = -h * 0.9;
        this.armL.rotation.z = 0.5 + h * 1.6;
        this.armR.rotation.z = -0.5 - h * 1.6;
        this.earL.rotation.z = 0.55 + h * 0.5;
        this.earR.rotation.z = -0.55 - h * 0.5;
        break;
      }
      case 'victory': {
        const h = Math.abs(Math.sin(t * 5));
        this.group.position.y = this.baseY + h * 0.55;
        this.group.rotation.y = Math.sin(t * 2.2) * 0.6;
        this.armL.rotation.z = 0.5 + 1.9;
        this.armR.rotation.z = -0.5 - 1.9;
        this.armL.rotation.x = -0.5 + Math.sin(t * 6) * 0.3;
        this.armR.rotation.x = -0.5 - Math.sin(t * 6) * 0.3;
        this.head.rotation.x = -0.18;
        this.earL.rotation.z = 0.55 + Math.sin(t * 7) * 0.3;
        this.earR.rotation.z = -0.55 - Math.sin(t * 7) * 0.3;
        this.eyeGroup.scale.set(1.12, 1.12, 1);
        this.crystal.rotation.y = t * 3;
        break;
      }
      case 'defeat': {
        this.group.rotation.z = -1.35;
        this.group.rotation.x = 0.15;
        this.group.position.y = this.baseY + 0.12;
        this.armL.rotation.z = 0.9;
        this.armR.rotation.z = -0.9;
        this.legL.rotation.x = 0.6;
        this.legR.rotation.x = -0.4;
        this.eyeGroup.scale.set(1, 0.12, 1);
        this.head.rotation.z = 0.2;
        break;
      }
      default:
        break;
    }

    // Blink overrides the eye scale unless a defeat pose is active.
    if (anim !== 'defeat' && this.blink > 0.02) {
      this.eyeGroup.scale.y *= 1 - this.blink * 0.9;
    }

    // Squash on collection.
    if (this.squash > 0) {
      this.group.scale.y *= 1 - this.squash * 0.12;
      this.group.scale.x *= 1 + this.squash * 0.08;
      this.group.scale.z *= 1 + this.squash * 0.08;
    }

    // Damage flash + hit shake.
    const flash = this.flash;
    this.furMat.emissive.setRGB(flash * 0.9, flash * 0.08, flash * 0.05);
    this.crystalMat.emissiveIntensity = 1 + Math.sin(t * 3) * 0.25 + flash;
    this.irisMat.emissiveIntensity = 0.85 + flash * 1.5;
    if (flash > 0.01) {
      this.group.position.x += Math.sin(t * 60) * 0.03 * flash;
    }
    this.shadow.scale.setScalar(1 - Math.max(0, this.group.position.y - this.baseY) * 0.18);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity =
      0.32 - Math.max(0, this.group.position.y - this.baseY) * 0.12;

    this.group.position.x += this.velocityX * 0.0006 * this.facing;
  }

  reset(): void {
    this.victory = false;
    this.defeated = false;
    this.overlay = null;
    this.flash = 0;
    this.squash = 0;
    this.base = 'idle';
    this.group.position.set(0, this.baseY, 0);
    this.group.rotation.set(0, 0, 0);
  }

  dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.group.clear();
  }
}
