import * as THREE from 'three';

/**
 * GPU point-sprite particle system with a fixed pool.
 *
 * Used for coin sparkles, bomb explosions, meteor fire, dust, magnet trails and
 * the level-completion confetti. One draw call, no per-frame allocations.
 */

export interface BurstOptions {
  count?: number;
  color?: string | THREE.Color;
  color2?: string | THREE.Color;
  speed?: number;
  spread?: number;
  life?: number;
  size?: number;
  gravity?: number;
  drag?: number;
  direction?: THREE.Vector3;
}

const MAX = 900;

export class ParticleSystem {
  readonly points: THREE.Points;

  private readonly positions = new Float32Array(MAX * 3);
  private readonly colors = new Float32Array(MAX * 3);
  private readonly sizes = new Float32Array(MAX);
  private readonly alphas = new Float32Array(MAX);
  private readonly velocities = new Float32Array(MAX * 3);
  private readonly lifes = new Float32Array(MAX);
  private readonly maxLifes = new Float32Array(MAX);
  private readonly gravities = new Float32Array(MAX);
  private readonly drags = new Float32Array(MAX);
  private readonly baseSizes = new Float32Array(MAX);
  private cursor = 0;
  private live = 0;

  constructor() {
    const geo = new THREE.BufferGeometry();
    for (let i = 0; i < MAX; i++) {
      this.positions[i * 3 + 1] = -999;
      this.alphas[i] = 0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 400);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float alpha;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uScale;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale * (260.0 / max(0.001, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float r = length(d);
          if (r > 0.5) discard;
          float a = smoothstep(0.5, 0.02, r);
          gl_FragColor = vec4(vColor, a * vAlpha);
        }
      `,
      vertexColors: true,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  setScale(scale: number): void {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = scale;
  }

  burst(origin: THREE.Vector3, opts: BurstOptions = {}): void {
    const count = opts.count ?? 18;
    const colorA = new THREE.Color(opts.color ?? '#ffd166');
    const colorB = new THREE.Color(opts.color2 ?? opts.color ?? '#ffffff');
    const speed = opts.speed ?? 3.2;
    const spread = opts.spread ?? 1;
    const life = opts.life ?? 0.9;
    const size = opts.size ?? 0.5;
    const gravity = opts.gravity ?? -4;
    const drag = opts.drag ?? 1.6;

    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % MAX;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi) * 0.9 + 0.25,
        Math.sin(phi) * Math.sin(theta),
      );
      if (opts.direction) dir.lerp(opts.direction, 0.55).normalize();
      const v = speed * (0.35 + Math.random() * 0.9);

      this.positions[idx * 3] = origin.x + (Math.random() - 0.5) * 0.25 * spread;
      this.positions[idx * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.25 * spread;
      this.positions[idx * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.25 * spread;

      this.velocities[idx * 3] = dir.x * v;
      this.velocities[idx * 3 + 1] = dir.y * v;
      this.velocities[idx * 3 + 2] = dir.z * v;

      const mixed = colorA.clone().lerp(colorB, Math.random());
      this.colors[idx * 3] = mixed.r;
      this.colors[idx * 3 + 1] = mixed.g;
      this.colors[idx * 3 + 2] = mixed.b;

      this.baseSizes[idx] = size * (0.55 + Math.random() * 0.9);
      this.sizes[idx] = this.baseSizes[idx];
      this.lifes[idx] = life * (0.6 + Math.random() * 0.7);
      this.maxLifes[idx] = this.lifes[idx];
      this.gravities[idx] = gravity;
      this.drags[idx] = drag;
      this.alphas[idx] = 1;
    }
    this.live = MAX;
  }

  update(dt: number): void {
    if (this.live === 0) return;
    let any = false;
    for (let i = 0; i < MAX; i++) {
      if (this.lifes[i] <= 0) {
        if (this.alphas[i] !== 0) {
          this.alphas[i] = 0;
          this.positions[i * 3 + 1] = -999;
          any = true;
        }
        continue;
      }
      any = true;
      this.lifes[i] -= dt;
      const t = Math.max(0, this.lifes[i] / this.maxLifes[i]);
      this.alphas[i] = t * t;
      const damp = 1 - this.drags[i] * dt;
      this.velocities[i * 3] *= damp;
      this.velocities[i * 3 + 1] = this.velocities[i * 3 + 1] * damp + this.gravities[i] * dt;
      this.velocities[i * 3 + 2] *= damp;
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      this.sizes[i] = this.baseSizes[i] * (0.4 + t * 0.75);
    }

    const geo = this.points.geometry;
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.size as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
    if (!any) this.live = 0;
  }

  clear(): void {
    for (let i = 0; i < MAX; i++) {
      this.lifes[i] = 0;
      this.alphas[i] = 0;
      this.positions[i * 3 + 1] = -999;
    }
    const geo = this.points.geometry;
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
    this.live = 0;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
