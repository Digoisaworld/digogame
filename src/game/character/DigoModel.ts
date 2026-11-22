import * as THREE from 'three';
import { bodyTexture, eyeTexture, glowTexture } from '../render/textures';

/**
 * DIGO — the official mascot, rebuilt as a real-time 3D character.
 *
 * Silhouette and materials follow the uploaded reference: a bottom-heavy pear
 * body in warm cream vinyl, two oversized spherical eyes with very large black
 * pupils, a small white specular highlight, stubby flipper arms and glossy
 * orange feet. No mouth, no nose, no extra limbs — the identity is preserved.
 *
 * The rig is procedural (no external animation files): every joint is animated
 * from a state machine so idle / run / jump / collect / hurt / victory / defeat
 * all blend smoothly and the character stays consistent in every level.
 */

export type DigoAnim =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'collect'
  | 'hurt'
  | 'victory'
  | 'defeat';

export interface DigoAnimContext {
  /** -1 moving left, 1 moving right, 0 still. */
  dir: number;
  /** 0..1 fraction of max horizontal speed. */
  speed: number;
  grounded: boolean;
}

const OUTLINE = 0x3a2a1e;

function addOutline(mesh: THREE.Mesh, scale = 1.035): void {
  const outline = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide }),
  );
  outline.scale.setScalar(scale);
  outline.castShadow = false;
  outline.receiveShadow = false;
  mesh.add(outline);
}

export class DigoModel {
  readonly root = new THREE.Group();

  private readonly pivot = new THREE.Group();
  private readonly head = new THREE.Group();

  private readonly bodyMat: THREE.MeshPhysicalMaterial;
  private readonly feetMat: THREE.MeshPhysicalMaterial;
  private readonly armMat: THREE.MeshPhysicalMaterial;
  private readonly lidMat: THREE.MeshStandardMaterial;

  private readonly feet: THREE.Mesh[] = [];
  private readonly arms: THREE.Group[] = [];
  private readonly lids: THREE.Mesh[] = [];
  private readonly pupils: THREE.Mesh[] = [];
  private readonly pupilBase: THREE.Vector3[] = [];

  private readonly aura: THREE.Sprite;
  private readonly shadow: THREE.Mesh;

  private time = 0;
  private phase = 0;
  private blinkTimer = 1.8;
  private blink = 0;
  private pop = 0;
  private shake = 0;
  private flash = 0;
  private spin = 0;
  private lidAmount = 0;
  private leanAmount = 0;

  constructor() {
    this.root.name = 'DIGO';
    this.root.add(this.pivot);
    this.pivot.add(this.head);

    const cream = '#f9d5b9';
    this.bodyMat = new THREE.MeshPhysicalMaterial({
      map: bodyTexture(cream, '#e8a688', '#fff4e8'),
      color: '#ffffff',
      roughness: 0.34,
      metalness: 0.02,
      clearcoat: 0.9,
      clearcoatRoughness: 0.22,
      sheen: 0.6,
      sheenColor: new THREE.Color('#ffd9c2'),
      envMapIntensity: 1.15,
    });
    this.feetMat = new THREE.MeshPhysicalMaterial({
      color: '#ff9c1a',
      roughness: 0.22,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.5,
    });
    this.armMat = new THREE.MeshPhysicalMaterial({
      map: bodyTexture(cream, '#e8a688', '#fff4e8'),
      color: '#ffffff',
      roughness: 0.36,
      clearcoat: 0.8,
      clearcoatRoughness: 0.25,
    });
    this.lidMat = new THREE.MeshStandardMaterial({
      color: '#f6cfb2',
      roughness: 0.45,
      metalness: 0.02,
    });

    /* ---------------- body ---------------- */
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(0.001, 0.02),
      new THREE.Vector2(0.3, 0.035),
      new THREE.Vector2(0.48, 0.09),
      new THREE.Vector2(0.58, 0.17),
      new THREE.Vector2(0.632, 0.29),
      new THREE.Vector2(0.657, 0.43),
      new THREE.Vector2(0.657, 0.58),
      new THREE.Vector2(0.64, 0.74),
      new THREE.Vector2(0.6, 0.9),
      new THREE.Vector2(0.545, 1.03),
      new THREE.Vector2(0.468, 1.15),
      new THREE.Vector2(0.375, 1.25),
      new THREE.Vector2(0.26, 1.33),
      new THREE.Vector2(0.13, 1.375),
      new THREE.Vector2(0.001, 1.4),
    ];
    const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), this.bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    addOutline(body, 1.028);
    this.head.add(body);

    /* ---------------- eyes ---------------- */
    const scleraGeo = new THREE.SphereGeometry(0.325, 40, 30);
    const scleraMat = new THREE.MeshPhysicalMaterial({
      map: eyeTexture(),
      roughness: 0.12,
      metalness: 0.0,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.3,
    });
    const pupilGeo = new THREE.SphereGeometry(0.232, 32, 24);
    const pupilMat = new THREE.MeshPhysicalMaterial({
      color: '#0d0a12',
      roughness: 0.14,
      metalness: 0.0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.6,
    });
    const lidGeo = new THREE.SphereGeometry(0.336, 32, 20);
    const hiGeo = new THREE.SphereGeometry(0.062, 16, 12);
    const hiMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const hiGeo2 = new THREE.SphereGeometry(0.03, 12, 10);

    [-1, 1].forEach((side) => {
      const eye = new THREE.Group();
      eye.position.set(side * 0.268, 1.045, 0.262);

      const sclera = new THREE.Mesh(scleraGeo, scleraMat);
      sclera.castShadow = true;
      addOutline(sclera, 1.03);
      eye.add(sclera);

      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(side * 0.012, -0.018, 0.198);
      pupil.castShadow = false;
      eye.add(pupil);
      this.pupils.push(pupil);
      this.pupilBase.push(pupil.position.clone());

      const hi = new THREE.Mesh(hiGeo, hiMat);
      hi.position.set(side * -0.06, 0.088, 0.36);
      eye.add(hi);
      const hi2 = new THREE.Mesh(hiGeo2, hiMat);
      hi2.position.set(side * 0.075, -0.055, 0.4);
      eye.add(hi2);

      const lid = new THREE.Mesh(lidGeo, this.lidMat);
      lid.position.set(0, 0.34, 0);
      lid.scale.set(1.02, 0.14, 1.02);
      lid.castShadow = false;
      eye.add(lid);
      this.lids.push(lid);

      this.head.add(eye);
    });

    /* ---------------- arms ---------------- */
    const armGeo = new THREE.CapsuleGeometry(0.082, 0.2, 8, 16);
    const pawGeo = new THREE.SphereGeometry(0.098, 18, 14);
    [-1, 1].forEach((side) => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.6, 0.5, 0.08);
      arm.rotation.z = side * -1.02;
      const limb = new THREE.Mesh(armGeo, this.armMat);
      limb.position.y = 0.12;
      limb.castShadow = true;
      addOutline(limb, 1.05);
      arm.add(limb);
      const paw = new THREE.Mesh(pawGeo, this.armMat);
      paw.position.y = 0.26;
      paw.castShadow = true;
      addOutline(paw, 1.05);
      arm.add(paw);
      this.pivot.add(arm);
      this.arms.push(arm);
    });

    /* ---------------- feet ---------------- */
    const footGeo = new THREE.SphereGeometry(0.245, 28, 20);
    [-1, 1].forEach((side) => {
      const foot = new THREE.Mesh(footGeo, this.feetMat);
      foot.scale.set(1.05, 0.62, 1.32);
      foot.position.set(side * 0.285, 0.135, 0.17);
      foot.castShadow = true;
      foot.receiveShadow = true;
      addOutline(foot, 1.05);
      this.pivot.add(foot);
      this.feet.push(foot);
    });

    /* ---------------- aura + contact shadow ---------------- */
    this.aura = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: new THREE.Color('#ffd479'),
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.aura.scale.set(3.4, 3.4, 1);
    this.aura.position.set(0, 0.8, -0.5);
    this.root.add(this.aura);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.1),
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        color: '#000000',
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.006;
    this.root.add(this.shadow);

    this.root.scale.setScalar(1.12);
  }

  /** Fire a one-shot reaction (collect / hurt / victory / defeat). */
  react(anim: DigoAnim): void {
    if (anim === 'collect') this.pop = 1;
    if (anim === 'hurt') {
      this.shake = 1;
      this.flash = 1;
    }
    if (anim === 'victory') this.spin = 0;
    this.anim = anim;
  }

  setAura(intensity: number, color?: string): void {
    const mat = this.aura.material as THREE.SpriteMaterial;
    mat.opacity = THREE.MathUtils.clamp(intensity, 0, 1) * 0.8;
    if (color) mat.color.set(color);
  }

  /** Recolour DIGO's energy for shield / invincibility feedback. */
  setTint(color: string | null, strength = 0.35): void {
    if (!color) {
      this.bodyMat.emissive.set('#000000');
      this.bodyMat.emissiveIntensity = 0;
      return;
    }
    this.bodyMat.emissive.set(color);
    this.bodyMat.emissiveIntensity = strength;
  }

  update(dt: number, anim: DigoAnim, ctx: DigoAnimContext): void {
    this.anim = anim;
    this.time += dt;
    this.pop = Math.max(0, this.pop - dt * 4.2);
    this.shake = Math.max(0, this.shake - dt * 2.4);
    this.flash = Math.max(0, this.flash - dt * 2.2);

    const running = anim === 'run';
    const runWeight = running ? THREE.MathUtils.clamp(0.35 + ctx.speed * 0.9, 0, 1) : 0;
    this.phase += dt * (6.5 + ctx.speed * 7.5) * (running ? 1 : 0.25);

    // ---- body bob / squash / lean -------------------------------------
    let bob = Math.sin(this.time * 2.2) * 0.018;
    if (running) bob = Math.abs(Math.sin(this.phase)) * 0.075 * runWeight;
    if (anim === 'victory') bob = Math.abs(Math.sin(this.time * 7)) * 0.3;

    let stretch = 1;
    if (anim === 'jump') stretch = 1.07;
    if (anim === 'fall') stretch = 1.04;
    if (anim === 'hurt') stretch = 0.94;
    if (anim === 'defeat') stretch = 0.86;
    if (anim === 'victory') stretch = 1.02;
    stretch += this.pop * 0.14;

    const squash = 1 / Math.sqrt(stretch);
    this.pivot.scale.set(squash, stretch, squash);
    this.pivot.position.y = bob;
    this.pivot.position.x = Math.sin(this.time * 62) * 0.05 * this.shake;

    const targetLean = running ? -ctx.dir * 0.13 * runWeight : anim === 'defeat' ? 0.2 : 0;
    this.leanAmount += (targetLean - this.leanAmount) * Math.min(1, dt * 10);
    this.pivot.rotation.z = this.leanAmount;
    this.pivot.rotation.x =
      anim === 'fall' ? -0.14 : anim === 'defeat' ? 0.26 : anim === 'victory' ? -0.1 : 0;

    if (anim === 'victory') {
      this.spin += dt * 5.5;
      this.pivot.rotation.y = Math.sin(this.spin) * 0.55;
    } else {
      this.pivot.rotation.y += (0 - this.pivot.rotation.y) * Math.min(1, dt * 8);
    }

    // ---- feet ---------------------------------------------------------
    this.feet.forEach((foot, i) => {
      const side = i === 0 ? -1 : 1;
      const baseY = 0.135;
      const baseZ = 0.17;
      let y = baseY;
      let z = baseZ;
      let rot = 0;
      if (running) {
        const p = this.phase + (side < 0 ? 0 : Math.PI);
        y = baseY + Math.max(0, Math.sin(p)) * 0.14 * runWeight;
        z = baseZ + Math.cos(p) * 0.07 * runWeight;
        rot = Math.sin(p) * 0.42 * runWeight;
      } else if (anim === 'jump') {
        y = baseY + 0.1;
        z = baseZ - 0.04;
        rot = -0.5;
      } else if (anim === 'fall') {
        y = baseY + 0.04;
        rot = 0.35;
      } else if (anim === 'victory') {
        y = baseY + Math.abs(Math.sin(this.time * 7 + i)) * 0.12;
      } else if (anim === 'defeat') {
        y = baseY - 0.03;
        rot = -0.15;
      } else {
        y = baseY + Math.sin(this.time * 2.2 + i) * 0.008;
      }
      foot.position.y += (y - foot.position.y) * Math.min(1, dt * 18);
      foot.position.z += (z - foot.position.z) * Math.min(1, dt * 18);
      foot.rotation.x += (rot - foot.rotation.x) * Math.min(1, dt * 18);
    });

    // ---- arms ---------------------------------------------------------
    this.arms.forEach((arm, i) => {
      const side = i === 0 ? -1 : 1;
      let target = side * -1.02;
      let lift = 0;
      if (running) {
        target = side * (-1.02 + Math.sin(this.phase + (side < 0 ? 0 : Math.PI)) * 0.45 * runWeight);
      } else if (anim === 'jump') {
        target = side * -2.1;
        lift = 0.06;
      } else if (anim === 'victory') {
        target = side * -2.5;
      } else if (anim === 'hurt') {
        target = side * -1.7;
      } else if (anim === 'collect') {
        target = side * -1.9;
      } else {
        target = side * (-1.02 + Math.sin(this.time * 2.1 + i) * 0.09);
      }
      arm.rotation.z += (target - arm.rotation.z) * Math.min(1, dt * 12);
      arm.position.y += (0.5 + lift - arm.position.y) * Math.min(1, dt * 12);
    });

    // ---- face: pupils, blink, squint ----------------------------------
    const lookX = ctx.dir * 0.05;
    const lookY = anim === 'hurt' ? -0.03 : anim === 'victory' ? 0.02 : 0;
    this.pupils.forEach((pupil, i) => {
      const base = this.pupilBase[i];
      const wander = Math.sin(this.time * 1.3 + i * 1.7) * 0.012;
      pupil.position.x += (base.x + lookX + wander - pupil.position.x) * Math.min(1, dt * 9);
      pupil.position.y += (base.y + lookY - pupil.position.y) * Math.min(1, dt * 9);
      const dilate = 1 + this.pop * 0.08 + (anim === 'hurt' ? -0.06 : 0);
      pupil.scale.setScalar(dilate);
    });

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.2 + Math.random() * 3.4;
      this.blink = 1;
    }
    if (this.blink > 0) this.blink = Math.max(0, this.blink - dt * 6.5);

    let targetLid = 0;
    if (anim === 'hurt') targetLid = 0.62;
    else if (anim === 'victory') targetLid = 0.34;
    else if (anim === 'defeat') targetLid = 1;
    const blinkCurve = Math.sin(Math.min(1, this.blink) * Math.PI);
    const lid = Math.max(targetLid, blinkCurve);
    this.lidAmount += (lid - this.lidAmount) * Math.min(1, dt * 22);
    this.lids.forEach((lidMesh) => {
      lidMesh.position.y = 0.34 * (1 - this.lidAmount);
      lidMesh.scale.y = 0.14 + 0.9 * this.lidAmount;
    });

    // ---- damage flash --------------------------------------------------
    const flashColor = this.flash > 0 ? '#ff2b2b' : '#000000';
    this.bodyMat.emissive.set(flashColor);
    this.bodyMat.emissiveIntensity = this.flash * 0.85;

    // ---- ground shadow reacts to jump height ---------------------------
    const air = Math.max(0, this.root.position.y);
    const mat = this.shadow.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.45 * Math.max(0.15, 1 - air * 0.55);
    this.shadow.scale.setScalar(1 + air * 0.18);
  }

  dispose(): void {
    this.root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
  }
}
