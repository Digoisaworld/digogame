import * as THREE from 'three';
import type { FallingKind, DangerKind, PowerKind, RewardKind } from '../types';
import { DANGER_META, POWER_META, REWARD_META } from '../types';
import { glowTexture, hazardTexture, logoTexture, noiseTexture } from '../render/textures';

/**
 * Falling object art direction.
 *
 * Rewards are warm, bright, gold/cyan and always carry an upward glow.
 * Hazards are dark, spiky, red-lit and always carry a pulsing red warning ring.
 * The two families can never be confused, even at thumbnail size.
 */

export interface ObjectVisual {
  group: THREE.Group;
  update: (dt: number, elapsed: number) => void;
  /** Hazard-only: drives the warning pulse. */
  danger?: boolean;
}

/* ------------------------------------------------------------------ */
/* shared helpers                                                      */
/* ------------------------------------------------------------------ */

function glowSprite(color: string, size: number, opacity = 0.7): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color: new THREE.Color(color),
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sprite.scale.set(size, size, 1);
  return sprite;
}

function labelTexture(text: string, bg: string, fg: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = fg;
  ctx.font = 'bold 82px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const cache = {
  gold: new THREE.MeshPhysicalMaterial({
    color: '#ffc93c',
    metalness: 1,
    roughness: 0.22,
    envMapIntensity: 1.8,
    clearcoat: 0.4,
  }),
  goldDark: new THREE.MeshStandardMaterial({ color: '#c98a12', metalness: 1, roughness: 0.35 }),
  iron: new THREE.MeshStandardMaterial({ color: '#1b1b20', metalness: 0.85, roughness: 0.38 }),
  ironDark: new THREE.MeshStandardMaterial({ color: '#0d0d10', metalness: 0.7, roughness: 0.5 }),
  wood: new THREE.MeshStandardMaterial({
    map: noiseTexture('#b06a2c', '#5d3210', 0.5),
    roughness: 0.72,
    metalness: 0.08,
  }),
  redGlow: new THREE.MeshStandardMaterial({
    color: '#ff2d1a',
    emissive: new THREE.Color('#ff1a00'),
    emissiveIntensity: 3,
    roughness: 0.4,
  }),
  hazard: new THREE.MeshStandardMaterial({
    map: hazardTexture('#ffc400', '#141008'),
    roughness: 0.55,
    metalness: 0.35,
  }),
};

/* ------------------------------------------------------------------ */
/* rewards                                                             */
/* ------------------------------------------------------------------ */

function buildCoin(): ObjectVisual {
  const group = new THREE.Group();
  const logo = logoTexture();

  const faceMat = new THREE.MeshPhysicalMaterial({
    map: logo,
    color: '#ffffff',
    metalness: 0.95,
    roughness: 0.26,
    emissive: new THREE.Color('#ffb300'),
    emissiveIntensity: 0.35,
    emissiveMap: logo,
    envMapIntensity: 1.9,
    clearcoat: 0.6,
  });

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 48), [
    cache.gold,
    faceMat,
    faceMat,
  ]);
  disc.rotation.x = Math.PI / 2;
  disc.castShadow = true;
  group.add(disc);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.038, 10, 48), cache.gold);
  rim.castShadow = true;
  group.add(rim);

  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.012, 8, 40), cache.goldDark);
  inner.position.z = 0.052;
  group.add(inner);
  const inner2 = inner.clone();
  inner2.position.z = -0.052;
  group.add(inner2);

  const halo = glowSprite('#ffcf4d', 1.9, 0.55);
  halo.position.z = -0.1;
  group.add(halo);

  return {
    group,
    update: (dt, elapsed) => {
      group.rotation.y += dt * 2.2;
      group.position.z = Math.sin(elapsed * 1.6) * 0.05;
    },
  };
}

function buildCrate(): ObjectVisual {
  const group = new THREE.Group();
  const boxGeo = new THREE.BoxGeometry(0.66, 0.66, 0.66);
  const box = new THREE.Mesh(boxGeo, cache.wood);
  box.castShadow = true;
  group.add(box);

  const frameMat = new THREE.MeshPhysicalMaterial({
    color: '#ffc23c',
    metalness: 1,
    roughness: 0.25,
    emissive: new THREE.Color('#ff9d00'),
    emissiveIntensity: 0.5,
  });
  const barGeo = new THREE.BoxGeometry(0.7, 0.09, 0.7);
  [0.26, -0.26].forEach((y) => {
    const bar = new THREE.Mesh(barGeo, frameMat);
    bar.position.y = y;
    bar.castShadow = true;
    group.add(bar);
  });
  [-0.26, 0.26].forEach((z) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.08), frameMat);
    bar.position.z = z;
    bar.scale.y = 0.12;
    group.add(bar);
  });

  // DIGO crest on the front face
  const crest = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.4),
    new THREE.MeshBasicMaterial({ map: logoTexture(), transparent: true }),
  );
  crest.position.set(0, 0, 0.335);
  group.add(crest);

  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.06), frameMat);
  lock.position.set(0, -0.05, 0.35);
  group.add(lock);

  const halo = glowSprite('#ffb340', 2.1, 0.6);
  halo.position.z = -0.2;
  group.add(halo);

  return {
    group,
    update: (dt, elapsed) => {
      group.rotation.y += dt * 1.5;
      group.rotation.x = Math.sin(elapsed * 1.2) * 0.08;
      group.position.z = Math.sin(elapsed * 1.4) * 0.04;
    },
  };
}

function buildGem(): ObjectVisual {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#7fe3ff',
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.62,
    thickness: 0.9,
    ior: 1.85,
    emissive: new THREE.Color('#1a9bff'),
    emissiveIntensity: 0.5,
    clearcoat: 1,
    envMapIntensity: 2.2,
  });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), mat);
  gem.scale.set(1, 1.28, 1);
  gem.castShadow = true;
  group.add(gem);

  const facets = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.435, 0),
    new THREE.MeshBasicMaterial({
      color: '#d6f6ff',
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    }),
  );
  facets.scale.set(1, 1.28, 1);
  group.add(facets);

  const halo = glowSprite('#5fd8ff', 2.0, 0.62);
  group.add(halo);

  return {
    group,
    update: (dt, elapsed) => {
      gem.rotation.y += dt * 1.7;
      facets.rotation.y = gem.rotation.y;
      gem.position.y = Math.sin(elapsed * 2) * 0.05;
      facets.position.y = gem.position.y;
    },
  };
}

function buildRelic(): ObjectVisual {
  const group = new THREE.Group();
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: '#ffd166',
    metalness: 1,
    roughness: 0.16,
    emissive: new THREE.Color('#b26bff'),
    emissiveIntensity: 0.8,
    envMapIntensity: 2.2,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), coreMat);
  core.castShadow = true;
  group.add(core);

  const ringMat = new THREE.MeshPhysicalMaterial({
    color: '#c084fc',
    metalness: 0.9,
    roughness: 0.2,
    emissive: new THREE.Color('#7c3aed'),
    emissiveIntensity: 1.6,
  });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.028, 10, 48), ringMat);
  ring1.rotation.x = Math.PI / 2.6;
  group.add(ring1);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.022, 10, 48), ringMat);
  ring2.rotation.y = Math.PI / 2.2;
  group.add(ring2);

  const halo = glowSprite('#c084fc', 2.6, 0.7);
  group.add(halo);

  return {
    group,
    update: (dt, elapsed) => {
      core.rotation.y += dt * 1.9;
      core.rotation.x += dt * 0.8;
      ring1.rotation.z += dt * 1.5;
      ring2.rotation.x += dt * 1.1;
      const pulse = 1 + Math.sin(elapsed * 3.4) * 0.06;
      core.scale.setScalar(pulse);
      halo.scale.setScalar(2.6 * (0.94 + Math.sin(elapsed * 3.4) * 0.06));
    },
  };
}

/* ------------------------------------------------------------------ */
/* hazards                                                             */
/* ------------------------------------------------------------------ */

function warningRing(color: string): { sprite: THREE.Sprite; update: (elapsed: number) => void } {
  const sprite = glowSprite(color, 2.3, 0.5);
  return {
    sprite,
    update: (elapsed) => {
      const pulse = 0.45 + Math.abs(Math.sin(elapsed * 6)) * 0.5;
      (sprite.material as THREE.SpriteMaterial).opacity = pulse;
      sprite.scale.setScalar(2.2 + Math.sin(elapsed * 6) * 0.22);
    },
  };
}

function buildBomb(): ObjectVisual {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.44, 32, 24), cache.iron);
  body.castShadow = true;
  group.add(body);

  const band = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.045, 10, 40), cache.redGlow);
  band.rotation.x = Math.PI / 2;
  group.add(band);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.16, 16), cache.goldDark);
  neck.position.y = 0.44;
  group.add(neck);

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.5, 0),
    new THREE.Vector3(0.1, 0.66, 0.04),
    new THREE.Vector3(0.2, 0.74, -0.02),
  ]);
  const fuse = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 14, 0.028, 8, false),
    new THREE.MeshStandardMaterial({ color: '#c9a06a', roughness: 0.9 }),
  );
  group.add(fuse);

  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 12, 10),
    new THREE.MeshBasicMaterial({ color: '#fff3b0' }),
  );
  spark.position.set(0.2, 0.76, -0.02);
  group.add(spark);
  const sparkGlow = glowSprite('#ff8a00', 0.95, 0.95);
  sparkGlow.position.copy(spark.position);
  group.add(sparkGlow);

  const warn = warningRing('#ff2d1a');
  warn.sprite.position.z = -0.35;
  group.add(warn.sprite);

  const skull = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.42),
    new THREE.MeshBasicMaterial({
      map: labelTexture('!', '#00000000', '#ff3b30'),
      transparent: true,
      depthWrite: false,
    }),
  );
  skull.position.set(0, 0.05, 0.46);
  group.add(skull);

  return {
    group,
    danger: true,
    update: (dt, elapsed) => {
      group.rotation.y += dt * 0.6;
      group.rotation.z = Math.sin(elapsed * 1.6) * 0.12;
      warn.update(elapsed);
      const flick = 0.7 + Math.random() * 0.5;
      (sparkGlow.material as THREE.SpriteMaterial).opacity = flick;
      spark.scale.setScalar(0.85 + Math.random() * 0.4);
      (cache.redGlow.emissiveIntensity as number) = 2.4;
    },
  };
}

function buildMine(): ObjectVisual {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 20), cache.iron);
  shell.scale.set(1, 0.72, 1);
  shell.castShadow = true;
  group.add(shell);

  const spikeGeo = new THREE.ConeGeometry(0.075, 0.26, 8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spike = new THREE.Mesh(spikeGeo, cache.ironDark);
    spike.position.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4);
    spike.rotation.z = Math.PI / 2;
    spike.rotation.y = -a;
    group.add(spike);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const spike = new THREE.Mesh(spikeGeo, cache.ironDark);
    spike.position.set(Math.cos(a) * 0.22, 0.26, Math.sin(a) * 0.22);
    spike.rotation.x = 0.5;
    spike.rotation.y = -a;
    group.add(spike);
  }

  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), cache.redGlow);
  lens.position.y = 0.3;
  group.add(lens);
  const lensGlow = glowSprite('#ff2d1a', 1.2, 0.85);
  lensGlow.position.y = 0.3;
  group.add(lensGlow);

  const warn = warningRing('#ff5a2d');
  warn.sprite.position.z = -0.3;
  group.add(warn.sprite);

  return {
    group,
    danger: true,
    update: (dt, elapsed) => {
      group.rotation.y += dt * 0.4;
      warn.update(elapsed);
      const blink = Math.sin(elapsed * 7) > 0 ? 1 : 0.15;
      (lensGlow.material as THREE.SpriteMaterial).opacity = blink;
      lens.visible = blink > 0.5;
    },
  };
}

function buildBarrel(): ObjectVisual {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.8, 24, 1), cache.hazard);
  body.castShadow = true;
  group.add(body);

  [-0.3, 0, 0.3].forEach((y) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.345, 0.03, 8, 28), cache.ironDark);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    group.add(band);
  });

  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 24), cache.ironDark);
  lid.position.y = 0.41;
  group.add(lid);

  const hazardLight = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), cache.redGlow);
  hazardLight.position.set(0.12, 0.46, 0);
  group.add(hazardLight);
  const hGlow = glowSprite('#ff6a00', 1.4, 0.8);
  hGlow.position.copy(hazardLight.position);
  group.add(hGlow);

  const warn = warningRing('#ff8f1f');
  warn.sprite.position.z = -0.3;
  group.add(warn.sprite);

  return {
    group,
    danger: true,
    update: (dt, elapsed) => {
      group.rotation.y += dt * 0.8;
      group.rotation.z = Math.sin(elapsed * 2) * 0.07;
      warn.update(elapsed);
      (hGlow.material as THREE.SpriteMaterial).opacity = 0.55 + Math.sin(elapsed * 5) * 0.35;
    },
  };
}

function buildMeteor(): ObjectVisual {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.44, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const f = 0.82 + Math.random() * 0.35;
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
  }
  geo.computeVertexNormals();

  const rock = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map: noiseTexture('#5a3a2e', '#1b0f0b', 0.6),
      emissive: new THREE.Color('#ff5a00'),
      emissiveIntensity: 0.55,
      roughness: 0.9,
      metalness: 0.1,
    }),
  );
  rock.castShadow = true;
  group.add(rock);

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 1.5, 14, 1, true),
    new THREE.MeshBasicMaterial({
      color: '#ff7a18',
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  flame.position.y = 1.0;
  flame.rotation.x = Math.PI;
  group.add(flame);

  const glow = glowSprite('#ff5722', 2.4, 0.75);
  group.add(glow);

  const warn = warningRing('#ff5722');
  warn.sprite.position.z = -0.35;
  group.add(warn.sprite);

  return {
    group,
    danger: true,
    update: (dt, elapsed) => {
      group.rotation.y += dt * 1.3;
      group.rotation.x += dt * 0.6;
      const flick = 0.55 + Math.random() * 0.4;
      (flame.material as THREE.MeshBasicMaterial).opacity = flick;
      flame.scale.set(0.85 + Math.random() * 0.3, 0.85 + Math.random() * 0.4, 1);
      warn.update(elapsed);
      glow.scale.setScalar(2.3 + Math.sin(elapsed * 8) * 0.2);
    },
  };
}

/* ------------------------------------------------------------------ */
/* power-ups                                                           */
/* ------------------------------------------------------------------ */

function powerShell(color: string, iconColor: string): { group: THREE.Group; inner: THREE.Group } {
  const group = new THREE.Group();
  const shellMat = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.35,
    roughness: 0.15,
    transmission: 0.45,
    thickness: 0.6,
    clearcoat: 1,
    emissive: new THREE.Color(iconColor),
    emissiveIntensity: 0.35,
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), shellMat);
  shell.scale.set(1, 1, 0.55);
  group.add(shell);
  const inner = new THREE.Group();
  group.add(inner);
  const halo = glowSprite(iconColor, 1.9, 0.55);
  group.add(halo);
  return { group, inner };
}

function buildPower(kind: PowerKind): ObjectVisual {
  const meta = POWER_META[kind];
  const { group, inner } = powerShell(meta.color, meta.color);
  const iconMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: new THREE.Color(meta.color),
    emissiveIntensity: 2.2,
    metalness: 0.4,
    roughness: 0.25,
  });

  if (kind === 'shield') {
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.07, 6), iconMat);
    shield.rotation.x = Math.PI / 2;
    inner.add(shield);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.04), iconMat);
    cross.position.z = 0.05;
    inner.add(cross);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.04), iconMat);
    cross2.position.z = 0.05;
    inner.add(cross2);
  } else if (kind === 'magnet') {
    const horseshoe = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.075, 12, 32, Math.PI * 1.25),
      iconMat,
    );
    horseshoe.rotation.z = -Math.PI * 0.62;
    inner.add(horseshoe);
    [-1, 1].forEach((s) => {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.1), iconMat);
      pole.position.set(s * 0.19, -0.1, 0);
      inner.add(pole);
    });
  } else if (kind === 'slow') {
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.22, 4), iconMat);
    top.position.y = 0.12;
    inner.add(top);
    const bottom = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.22, 4), iconMat);
    bottom.position.y = -0.12;
    bottom.rotation.x = Math.PI;
    inner.add(bottom);
  } else if (kind === 'double') {
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.44, 0.44),
      new THREE.MeshBasicMaterial({
        map: labelTexture('2x', '#00000000', '#ffe9a8'),
        transparent: true,
        depthWrite: false,
      }),
    );
    plate.position.z = 0.24;
    inner.add(plate);
    const plate2 = plate.clone();
    plate2.rotation.y = Math.PI;
    plate2.position.z = -0.24;
    inner.add(plate2);
  } else {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), iconMat);
    star.scale.set(1, 1.3, 0.5);
    inner.add(star);
    const star2 = star.clone();
    star2.rotation.y = Math.PI / 2;
    inner.add(star2);
  }

  return {
    group,
    update: (dt, elapsed) => {
      group.rotation.y += dt * 1.9;
      inner.rotation.z = Math.sin(elapsed * 2.4) * 0.18;
      group.position.y += Math.sin(elapsed * 2.8) * 0.0016;
      const pulse = 1 + Math.sin(elapsed * 4) * 0.05;
      inner.scale.setScalar(pulse);
    },
  };
}

/* ------------------------------------------------------------------ */
/* factory                                                             */
/* ------------------------------------------------------------------ */

export function createObjectVisual(kind: FallingKind): ObjectVisual {
  switch (kind) {
    case 'coin':
      return buildCoin();
    case 'crate':
      return buildCrate();
    case 'gem':
      return buildGem();
    case 'relic':
      return buildRelic();
    case 'bomb':
      return buildBomb();
    case 'mine':
      return buildMine();
    case 'barrel':
      return buildBarrel();
    case 'meteor':
      return buildMeteor();
    default:
      return buildPower(kind as PowerKind);
  }
}

export const OBJECT_RADIUS: Record<FallingKind, number> = {
  coin: 0.44,
  crate: 0.46,
  gem: 0.46,
  relic: 0.5,
  bomb: 0.46,
  mine: 0.48,
  barrel: 0.44,
  meteor: 0.48,
  shield: 0.44,
  magnet: 0.44,
  slow: 0.44,
  double: 0.44,
  invincible: 0.44,
};

export function objectLabel(kind: FallingKind): string {
  if (kind in REWARD_META) return REWARD_META[kind as RewardKind].label;
  if (kind in DANGER_META) return DANGER_META[kind as DangerKind].label;
  return POWER_META[kind as PowerKind].label;
}

export function objectColor(kind: FallingKind): string {
  if (kind in REWARD_META) return REWARD_META[kind as RewardKind].color;
  if (kind in DANGER_META) return DANGER_META[kind as DangerKind].color;
  return POWER_META[kind as PowerKind].color;
}
