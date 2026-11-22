import * as THREE from 'three';
import type { Category, FallingKind } from '../types';
import { categoryOf } from '../types';

/* ------------------------------------------------------------------ *
 * Shared texture helpers (generated once, no binary assets needed)
 * ------------------------------------------------------------------ */

const glowCache = new Map<string, THREE.Texture>();

export function glowTexture(color: string): THREE.Texture {
  const cached = glowCache.get(color);
  if (cached) return cached;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.28, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  glowCache.set(color, tex);
  return tex;
}

let coinFace: THREE.Texture | null = null;
function coinFaceTexture(): THREE.Texture {
  if (coinFace) return coinFace;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#fff6c8');
  grad.addColorStop(0.55, '#ffcc33');
  grad.addColorStop(1, '#b47800');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#fff2b0';
  ctx.stroke();
  ctx.fillStyle = '#6b4400';
  ctx.font = 'bold 150px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('D', size / 2, size / 2 + 8);
  coinFace = new THREE.CanvasTexture(canvas);
  coinFace.colorSpace = THREE.SRGBColorSpace;
  return coinFace;
}

function warnTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ff2b2b';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 108px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', size / 2, size / 2 + 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ *
 * Falling entity
 * ------------------------------------------------------------------ */

export interface FallingEntity {
  kind: FallingKind;
  category: Category;
  group: THREE.Group;
  /** Collision radius in world units. */
  radius: number;
  /** Fall speed in units/second. */
  speed: number;
  /** Horizontal drift in units/second. */
  drift: number;
  spinSpeed: number;
  x: number;
  y: number;
  z: number;
  alive: boolean;
  /** Set when a magnet pulls the object. */
  magnetized: boolean;
  age: number;
  animate: (t: number, dt: number, entity: FallingEntity) => void;
  dispose: () => void;
}

interface Built {
  group: THREE.Group;
  radius: number;
  animate: (t: number, dt: number, e: FallingEntity) => void;
}

const disposables = new WeakMap<THREE.Group, Array<{ dispose: () => void }>>();

function track(group: THREE.Group, ...items: Array<{ dispose: () => void }>): void {
  const list = disposables.get(group) ?? [];
  list.push(...items);
  disposables.set(group, list);
}

function sprite(group: THREE.Group, color: string, scale: number, opacity = 0.85): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(color),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(scale);
  group.add(s);
  track(group, mat);
  return s;
}

/* ------------------------------------------------------------------ *
 * REWARDS — bright, valuable, glowing, unmistakably collectible
 * ------------------------------------------------------------------ */

function buildCoin(): Built {
  const group = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffc93c,
    metalness: 0.95,
    roughness: 0.22,
    emissive: 0x7a4c00,
  });
  const faceMat = new THREE.MeshBasicMaterial({ map: coinFaceTexture() });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.1, 36), goldMat);
  disc.rotation.x = Math.PI / 2;
  group.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.055, 10, 36), goldMat);
  group.add(rim);
  for (const z of [0.055, -0.055]) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32), faceMat);
    face.position.z = z;
    if (z < 0) face.rotation.y = Math.PI;
    group.add(face);
  }
  const glow = sprite(group, '#ffd54a', 1.9, 0.55);
  track(group, goldMat, faceMat, disc.geometry, rim.geometry);
  return {
    group,
    radius: 0.5,
    animate: (t) => {
      group.rotation.y = t * 2.6;
      group.rotation.z = Math.sin(t * 1.4) * 0.12;
      glow.material.opacity = 0.4 + Math.sin(t * 5) * 0.12;
    },
  };
}

function buildDiamond(): Built {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8ce9ff,
    metalness: 0.35,
    roughness: 0.05,
    transparent: true,
    opacity: 0.86,
    emissive: 0x1f8fdd,
    emissiveIntensity: 0.85,
    flatShading: true,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), mat);
  core.scale.set(1, 1.35, 1);
  group.add(core);
  const innerMat = new THREE.MeshBasicMaterial({ color: 0xd6fbff });
  const inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), innerMat);
  inner.scale.set(1, 1.5, 1);
  group.add(inner);
  const glow = sprite(group, '#63e6ff', 2.1, 0.7);
  track(group, mat, innerMat, core.geometry, inner.geometry);
  return {
    group,
    radius: 0.52,
    animate: (t) => {
      core.rotation.y = t * 1.5;
      inner.rotation.y = -t * 2.4;
      glow.material.opacity = 0.55 + Math.sin(t * 6) * 0.18;
      const s = 1 + Math.sin(t * 4) * 0.04;
      core.scale.set(s, 1.35, s);
    },
  };
}

function buildEnergy(): Built {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4dffa6,
    metalness: 0.4,
    roughness: 0.15,
    emissive: 0x18c47a,
    emissiveIntensity: 1.1,
    flatShading: true,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), mat);
  group.add(core);
  const shellMat = new THREE.MeshBasicMaterial({
    color: 0xd9fff0,
    wireframe: true,
    transparent: true,
    opacity: 0.55,
  });
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.52, 0), shellMat);
  group.add(shell);
  const orbitMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const orbiters: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i += 1) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), orbitMat);
    orbiters.push(o);
    group.add(o);
  }
  const glow = sprite(group, '#4dffa6', 2, 0.6);
  track(group, mat, shellMat, orbitMat, core.geometry, shell.geometry);
  return {
    group,
    radius: 0.5,
    animate: (t) => {
      core.rotation.y = t * 1.8;
      shell.rotation.x = t * 1.1;
      shell.rotation.y = -t * 0.8;
      orbiters.forEach((o, i) => {
        const a = t * 2.4 + (i / 3) * Math.PI * 2;
        o.position.set(Math.cos(a) * 0.62, Math.sin(a * 1.3) * 0.3, Math.sin(a) * 0.62);
      });
      glow.material.opacity = 0.45 + Math.sin(t * 7) * 0.15;
    },
  };
}

function buildChest(): Built {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0xb4691f,
    roughness: 0.6,
    metalness: 0.2,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffc93c,
    metalness: 1,
    roughness: 0.2,
    emissive: 0x6b4a00,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.46, 0.56), woodMat);
  body.position.y = -0.1;
  group.add(body);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.82, 16, 1, false, 0, Math.PI), goldMat);
  lid.rotation.z = Math.PI / 2;
  lid.position.y = 0.13;
  lid.scale.set(1, 1, 0.9);
  group.add(lid);
  const bandMat = goldMat;
  for (const x of [-0.26, 0.26]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.58), bandMat);
    band.position.set(x, -0.08, 0);
    group.add(band);
  }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.1), goldMat);
  lock.position.set(0, -0.06, 0.3);
  group.add(lock);
  const keyhole = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), new THREE.MeshBasicMaterial({ color: 0x2a1600 }));
  keyhole.position.set(0, -0.06, 0.36);
  group.add(keyhole);
  const glow = sprite(group, '#ffb020', 2.2, 0.55);
  track(group, woodMat, goldMat, body.geometry, lid.geometry, lock.geometry, keyhole.geometry);
  return {
    group,
    radius: 0.6,
    animate: (t) => {
      group.rotation.y = Math.sin(t * 1.3) * 0.5;
      group.rotation.z = Math.sin(t * 2) * 0.06;
      glow.material.opacity = 0.4 + Math.sin(t * 4) * 0.15;
    },
  };
}

function buildLegendary(): Built {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xb46bff,
    metalness: 0.6,
    roughness: 0.15,
    emissive: 0x7b1fd4,
    emissiveIntensity: 1.3,
    flatShading: true,
  });
  const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 0), mat);
  group.add(core);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffd54a,
    metalness: 1,
    roughness: 0.15,
    emissive: 0x8a6b00,
  });
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.045, 8, 40), ringMat);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.035, 8, 40), ringMat);
  ringB.rotation.x = Math.PI / 2;
  group.add(ringA, ringB);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sparks: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i += 1) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), sparkMat);
    sparks.push(s);
    group.add(s);
  }
  const glow = sprite(group, '#c07bff', 2.8, 0.8);
  track(group, mat, ringMat, sparkMat, core.geometry, ringA.geometry, ringB.geometry);
  return {
    group,
    radius: 0.6,
    animate: (t) => {
      core.rotation.y = t * 1.1;
      core.rotation.x = t * 0.7;
      ringA.rotation.z = t * 1.7;
      ringB.rotation.z = -t * 1.3;
      ringA.rotation.x = Math.PI / 2.4 + Math.sin(t) * 0.2;
      sparks.forEach((s, i) => {
        const a = t * 3 + (i / 4) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.8, Math.sin(a * 1.6) * 0.55, Math.sin(a) * 0.8);
      });
      glow.material.opacity = 0.6 + Math.sin(t * 5) * 0.2;
    },
  };
}

/* ------------------------------------------------------------------ *
 * DANGERS — dark, sharp, explosive, unmistakably hostile
 * ------------------------------------------------------------------ */

function buildBomb(): Built {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x14161c,
    metalness: 0.85,
    roughness: 0.28,
    emissive: 0x1a0000,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 26, 20), bodyMat);
  group.add(body);
  const fuseMat = new THREE.MeshStandardMaterial({ color: 0x8a7350, roughness: 0.9 });
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.36, 8), fuseMat);
  fuse.position.set(0.06, 0.58, 0);
  fuse.rotation.z = -0.35;
  group.add(fuse);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfff0a0 });
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), sparkMat);
  spark.position.set(0.13, 0.78, 0);
  group.add(spark);
  const sparkGlow = sprite(group, '#ffcc00', 0.9, 0.9);
  sparkGlow.position.copy(spark.position);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff2b2b,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 8, 40), ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const warnMat = new THREE.MeshBasicMaterial({
    map: warnTexture(),
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const warn = new THREE.Mesh(new THREE.CircleGeometry(0.17, 3), warnMat);
  warn.position.set(0, 0.05, 0.51);
  group.add(warn);

  const glow = sprite(group, '#ff2b2b', 2.6, 0.5);
  track(group, bodyMat, fuseMat, sparkMat, ringMat, warnMat, body.geometry, fuse.geometry, spark.geometry, ring.geometry, warn.geometry);
  return {
    group,
    radius: 0.55,
    animate: (t, _dt, e) => {
      group.rotation.y = Math.sin(t * 2) * 0.3;
      const pulse = 0.5 + 0.5 * Math.sin(t * 9);
      glow.material.opacity = 0.25 + pulse * 0.5;
      ring.scale.setScalar(1 + pulse * 0.16);
      ringMat.opacity = 0.5 + pulse * 0.5;
      spark.scale.setScalar(0.8 + pulse * 0.5);
      sparkGlow.material.opacity = 0.5 + pulse * 0.5;
      // Fuse sparks trail behind the falling bomb.
      group.rotation.z = Math.sin(t * 3 + e.y) * 0.15;
    },
  };
}

function buildMeteor(): Built {
  const group = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x4a2a1a,
    roughness: 0.95,
    metalness: 0.15,
    flatShading: true,
    emissive: 0x3d0a00,
    emissiveIntensity: 0.9,
  });
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), rockMat);
  rock.scale.set(1, 0.95, 1);
  group.add(rock);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xff7a18,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.5, 10, 1, true), flameMat);
  flame.position.y = 0.95;
  flame.rotation.x = Math.PI;
  group.add(flame);
  const innerFlameMat = new THREE.MeshBasicMaterial({
    color: 0xffe066,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.0, 8, 1, true), innerFlameMat);
  innerFlame.position.y = 0.75;
  innerFlame.rotation.x = Math.PI;
  group.add(innerFlame);
  const glow = sprite(group, '#ff7a18', 2.8, 0.75);
  glow.position.y = 0.4;
  const smoke = sprite(group, '#3a2b26', 2.2, 0.35);
  smoke.position.y = 1.1;
  track(group, rockMat, flameMat, innerFlameMat, rock.geometry, flame.geometry, innerFlame.geometry);
  return {
    group,
    radius: 0.58,
    animate: (t) => {
      rock.rotation.y = t * 1.4;
      rock.rotation.x = t * 0.9;
      const flicker = 0.75 + Math.sin(t * 18) * 0.2;
      flameMat.opacity = flicker * 0.9;
      flame.scale.set(1 + Math.sin(t * 12) * 0.08, 1 + Math.sin(t * 9) * 0.12, 1);
      innerFlame.scale.y = 1 + Math.sin(t * 15) * 0.15;
      glow.material.opacity = 0.6 + Math.sin(t * 10) * 0.18;
    },
  };
}

function buildElectric(): Built {
  const group = new THREE.Group();
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xff2d55,
    emissive: 0xff2d55,
    emissiveIntensity: 1.6,
    roughness: 0.3,
    metalness: 0.4,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), coreMat);
  group.add(core);
  const arcMat = new THREE.MeshBasicMaterial({
    color: 0xffd0d8,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const arcs: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i += 1) {
    const arc = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.7, 4), arcMat);
    arcs.push(arc);
    group.add(arc);
  }
  const shellMat = new THREE.MeshBasicMaterial({
    color: 0xff2d55,
    wireframe: true,
    transparent: true,
    opacity: 0.7,
  });
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.56, 0), shellMat);
  group.add(shell);
  const glow = sprite(group, '#ff2d55', 2.6, 0.7);
  track(group, coreMat, arcMat, shellMat, core.geometry, shell.geometry);
  return {
    group,
    radius: 0.55,
    animate: (t) => {
      core.rotation.y = t * 3;
      shell.rotation.x = t * 1.4;
      shell.rotation.z = -t * 1.1;
      arcs.forEach((arc, i) => {
        const a = t * 6 + (i / 5) * Math.PI * 2;
        arc.position.set(Math.cos(a) * 0.42, Math.sin(a * 1.7) * 0.42, Math.sin(a) * 0.42);
        arc.rotation.set(a, a * 0.7, a * 1.3);
        arc.scale.y = 0.7 + Math.abs(Math.sin(t * 20 + i)) * 0.8;
      });
      glow.material.opacity = 0.5 + Math.abs(Math.sin(t * 14)) * 0.4;
      coreMat.emissiveIntensity = 1.2 + Math.abs(Math.sin(t * 16)) * 0.9;
    },
  };
}

function buildSpike(): Built {
  const group = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x8f9aa8,
    metalness: 0.95,
    roughness: 0.25,
  });
  const tipMat = new THREE.MeshStandardMaterial({
    color: 0xff2b2b,
    emissive: 0xb00000,
    emissiveIntensity: 1.1,
    metalness: 0.5,
    roughness: 0.4,
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.18, 8), metalMat);
  base.position.y = -0.26;
  group.add(base);
  const positions: Array<[number, number, number, number]> = [
    [0, 0, 0, 1.15],
    [-0.24, -0.05, 0.06, 0.85],
    [0.24, -0.05, -0.06, 0.85],
    [0.05, -0.05, 0.24, 0.8],
    [-0.05, -0.05, -0.24, 0.8],
  ];
  const spikeGeo = new THREE.ConeGeometry(0.13, 0.8, 6);
  const tipGeo = new THREE.ConeGeometry(0.075, 0.2, 6);
  positions.forEach(([x, y, z, scale]) => {
    const spike = new THREE.Mesh(spikeGeo, metalMat);
    spike.position.set(x, y + 0.05, z);
    spike.scale.setScalar(scale);
    spike.rotation.z = x * 0.5;
    spike.rotation.x = -z * 0.5;
    group.add(spike);
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(x + x * 0.12, y + 0.05 + 0.4 * scale, z + z * 0.12);
    tip.rotation.copy(spike.rotation);
    group.add(tip);
  });
  const glow = sprite(group, '#ff2b2b', 2.1, 0.45);
  track(group, metalMat, tipMat, spikeGeo, tipGeo, base.geometry);
  return {
    group,
    radius: 0.55,
    animate: (t) => {
      group.rotation.y = t * 1.2;
      group.rotation.z = Math.sin(t * 2) * 0.08;
      glow.material.opacity = 0.3 + Math.abs(Math.sin(t * 4)) * 0.3;
    },
  };
}

function buildEnemy(): Built {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x7a1024,
    roughness: 0.55,
    metalness: 0.25,
    emissive: 0x3a0010,
    emissiveIntensity: 0.8,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.44, 20, 16), bodyMat);
  body.scale.set(1, 1.1, 1);
  group.add(body);
  const hornMat = new THREE.MeshStandardMaterial({
    color: 0xf2e6c8,
    roughness: 0.5,
    metalness: 0.2,
  });
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 8), hornMat);
    horn.position.set(0.24 * side, 0.44, 0);
    horn.rotation.z = -0.4 * side;
    group.add(horn);
  }
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe14d });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x220000 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), eyeMat);
    eye.position.set(0.16 * side, 0.08, 0.38);
    group.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), pupilMat);
    pupil.position.set(0.16 * side, 0.08, 0.47);
    group.add(pupil);
  }
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x1a0000 });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.06), mouthMat);
  mouth.position.set(0, -0.2, 0.42);
  group.add(mouth);
  const glow = sprite(group, '#ff2d55', 2.0, 0.4);
  track(group, bodyMat, hornMat, eyeMat, pupilMat, mouthMat, body.geometry, mouth.geometry);
  return {
    group,
    radius: 0.55,
    animate: (t) => {
      body.scale.set(1 + Math.sin(t * 8) * 0.05, 1.1 - Math.sin(t * 8) * 0.04, 1);
      group.rotation.z = Math.sin(t * 5) * 0.18;
      group.rotation.y = Math.sin(t * 2.2) * 0.35;
      glow.material.opacity = 0.25 + Math.abs(Math.sin(t * 6)) * 0.35;
    },
  };
}

/* ------------------------------------------------------------------ *
 * POWER-UPS — colour-coded orbs with a unique orbit signature
 * ------------------------------------------------------------------ */

const POWER_COLORS: Record<string, string> = {
  shield: '#4da3ff',
  magnet: '#ff5fd2',
  slow: '#8ef0ff',
  double: '#ffd166',
  speed: '#7cff6b',
  invincible: '#ffffff',
};

function buildPower(kind: FallingKind): Built {
  const color = POWER_COLORS[kind] ?? '#ffffff';
  const group = new THREE.Group();
  const coreMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color),
    emissiveIntensity: 1.2,
    metalness: 0.4,
    roughness: 0.2,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), coreMat);
  group.add(core);
  const shellMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    wireframe: true,
    transparent: true,
    opacity: 0.65,
  });
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), shellMat);
  group.add(shell);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 8, 36), ringMat);
  group.add(ring);
  // Distinct inner glyph so power-ups never read as rewards or dangers.
  const glyphMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  let glyph: THREE.Mesh;
  if (kind === 'shield') glyph = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 20), glyphMat);
  else if (kind === 'magnet') glyph = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 20, Math.PI), glyphMat);
  else if (kind === 'slow') glyph = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 4), glyphMat);
  else if (kind === 'double') {
    glyph = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.06), glyphMat);
    glyph.rotation.z = Math.PI / 4;
  } else if (kind === 'speed') glyph = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 3), glyphMat);
  else glyph = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), glyphMat);
  group.add(glyph);
  const glow = sprite(group, color, 2.4, 0.75);
  track(group, coreMat, shellMat, ringMat, glyphMat, core.geometry, shell.geometry, ring.geometry, glyph.geometry);
  return {
    group,
    radius: 0.55,
    animate: (t) => {
      core.rotation.y = t * 2;
      shell.rotation.y = -t * 1.6;
      shell.rotation.x = t * 0.9;
      ring.rotation.x = Math.PI / 2 + Math.sin(t * 2) * 0.3;
      ring.rotation.z = t * 1.4;
      glyph.rotation.y = t * 2.6;
      glow.material.opacity = 0.55 + Math.sin(t * 6) * 0.2;
      coreMat.emissiveIntensity = 1 + Math.sin(t * 5) * 0.3;
    },
  };
}

/* ------------------------------------------------------------------ *
 * BOSS — the DIGO Guardian
 * ------------------------------------------------------------------ */

export function buildBoss(): Built {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2b1030,
    metalness: 0.6,
    roughness: 0.35,
    emissive: 0x8b1fd4,
    emissiveIntensity: 0.5,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.05, 28, 22), bodyMat);
  group.add(body);
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0xff2d55,
    emissive: 0xff2d55,
    emissiveIntensity: 0.9,
    metalness: 0.7,
    roughness: 0.3,
  });
  const plate = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.09, 10, 44), plateMat);
  plate.rotation.x = Math.PI / 2.3;
  group.add(plate);
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xffe6b0, metalness: 0.6, roughness: 0.35 });
  const hornGeo = new THREE.ConeGeometry(0.2, 0.9, 8);
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(hornGeo, hornMat);
    horn.position.set(0.62 * side, 0.9, 0);
    horn.rotation.z = -0.5 * side;
    group.add(horn);
  }
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });
  const eyes: THREE.Mesh[] = [];
  for (const [x, y] of [
    [-0.36, 0.24],
    [0.36, 0.24],
    [0, -0.1],
  ]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), eyeMat);
    eye.position.set(x, y, 0.95);
    eyes.push(eye);
    group.add(eye);
  }
  const glow = sprite(group, '#ff2d55', 5, 0.5);
  track(group, bodyMat, plateMat, hornMat, eyeMat, body.geometry, plate.geometry, hornGeo);
  return {
    group,
    radius: 1.15,
    animate: (t) => {
      group.rotation.y = Math.sin(t * 0.9) * 0.4;
      group.position.y += Math.sin(t * 2) * 0.004;
      plate.rotation.z = t * 0.8;
      body.scale.set(1 + Math.sin(t * 3) * 0.03, 1 - Math.sin(t * 3) * 0.03, 1);
      eyes.forEach((e, i) => {
        e.scale.setScalar(0.85 + Math.abs(Math.sin(t * 4 + i)) * 0.35);
      });
      glow.material.opacity = 0.35 + Math.abs(Math.sin(t * 2.5)) * 0.35;
    },
  };
}

/* ------------------------------------------------------------------ *
 * Factory with pooling support
 * ------------------------------------------------------------------ */

const builders: Record<FallingKind, () => Built> = {
  coin: buildCoin,
  diamond: buildDiamond,
  energy: buildEnergy,
  chest: buildChest,
  legendary: buildLegendary,
  bomb: buildBomb,
  meteor: buildMeteor,
  electric: buildElectric,
  spike: buildSpike,
  enemy: buildEnemy,
  shield: () => buildPower('shield'),
  magnet: () => buildPower('magnet'),
  slow: () => buildPower('slow'),
  double: () => buildPower('double'),
  speed: () => buildPower('speed'),
  invincible: () => buildPower('invincible'),
};

/**
 * Creates (or recycles) a falling object. Objects are pooled per kind by the
 * SpawnManager, so the geometry/material cost is paid once.
 */
export function createEntity(kind: FallingKind): FallingEntity {
  const built = builders[kind]();
  const category = categoryOf(kind);
  const entity: FallingEntity = {
    kind,
    category,
    group: built.group,
    radius: built.radius,
    speed: 4,
    drift: 0,
    spinSpeed: 1,
    x: 0,
    y: 0,
    z: 0,
    alive: true,
    magnetized: false,
    age: 0,
    animate: built.animate,
    dispose: () => {
      const list = disposables.get(built.group) ?? [];
      list.forEach((d) => d.dispose());
      built.group.clear();
    },
  };
  return entity;
}

export { buildPower };
