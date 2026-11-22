import * as THREE from 'three';
import type { WorldId } from './types';
import { groundTexture, noiseTexture, windowTexture } from './render/textures';

export interface WorldDef {
  id: WorldId;
  index: number;
  name: string;
  subtitle: string;
  description: string;
  accent: string;
  accent2: string;
  skyTop: string;
  skyBottom: string;
  fog: string;
  fogDensity: number;
  ground: string;
  groundAlt: string;
  groundStyle: 'sand' | 'neon' | 'stone' | 'asteroid' | 'basalt' | 'crystal' | 'ice';
  propStyle: 'palms' | 'towers' | 'pillars' | 'asteroids' | 'volcano' | 'crystals' | 'ice';
  weather: 'petals' | 'rain' | 'dust' | 'stars' | 'embers' | 'sparkles' | 'snow';
  sun: string;
  sunIntensity: number;
  ambient: string;
  ambientIntensity: number;
  scale: number[];
  tempo: number;
  hazard: string;
}

export const WORLDS: WorldDef[] = [
  {
    id: 'island',
    index: 0,
    name: 'Tropical Island',
    subtitle: 'Golden shore',
    description: 'Warm sand, turquoise water and palms swaying in the trade wind.',
    accent: '#ffd166',
    accent2: '#22d3a6',
    skyTop: '#1b7fd4',
    skyBottom: '#bfeaff',
    fog: '#cdeaff',
    fogDensity: 0.012,
    ground: '#e8cf9c',
    groundAlt: '#d6b782',
    groundStyle: 'sand',
    propStyle: 'palms',
    weather: 'petals',
    sun: '#fff3d6',
    sunIntensity: 2.6,
    ambient: '#9fd7ff',
    ambientIntensity: 0.7,
    scale: [0, 2, 4, 7, 9, 12],
    tempo: 112,
    hazard: 'Falling bombs',
  },
  {
    id: 'cyber',
    index: 1,
    name: 'Neon City',
    subtitle: 'Rooftop grid',
    description: 'Rain-slick rooftops above a sleepless megacity of holograms.',
    accent: '#38f5ff',
    accent2: '#ff3ea5',
    skyTop: '#080b23',
    skyBottom: '#2a1a5e',
    fog: '#241a52',
    fogDensity: 0.02,
    ground: '#141a33',
    groundAlt: '#1d2444',
    groundStyle: 'neon',
    propStyle: 'towers',
    weather: 'rain',
    sun: '#b7c7ff',
    sunIntensity: 1.5,
    ambient: '#4b3cff',
    ambientIntensity: 0.85,
    scale: [0, 3, 5, 7, 10, 12],
    tempo: 128,
    hazard: 'Electric arcs',
  },
  {
    id: 'temple',
    index: 2,
    name: 'Golden Temple',
    subtitle: 'Sunken ruins',
    description: 'Ancient stone corridors lit by braziers and lost gold.',
    accent: '#ffb43a',
    accent2: '#7cf3c0',
    skyTop: '#3c2412',
    skyBottom: '#e8a855',
    fog: '#c88f4d',
    fogDensity: 0.022,
    ground: '#9c7a4f',
    groundAlt: '#7d5f3c',
    groundStyle: 'stone',
    propStyle: 'pillars',
    weather: 'dust',
    sun: '#ffd9a0',
    sunIntensity: 2.2,
    ambient: '#ffb066',
    ambientIntensity: 0.6,
    scale: [0, 2, 3, 5, 7, 10, 12],
    tempo: 96,
    hazard: 'Rolling boulders',
  },
  {
    id: 'space',
    index: 3,
    name: 'Deep Space',
    subtitle: 'Meteor belt',
    description: 'Drifting asteroid field under a violet nebula.',
    accent: '#8b5cf6',
    accent2: '#38bdf8',
    skyTop: '#04030f',
    skyBottom: '#1b1147',
    fog: '#120d33',
    fogDensity: 0.008,
    ground: '#3a3f52',
    groundAlt: '#2a2e3d',
    groundStyle: 'asteroid',
    propStyle: 'asteroids',
    weather: 'stars',
    sun: '#dcd6ff',
    sunIntensity: 2.0,
    ambient: '#5b4bff',
    ambientIntensity: 0.55,
    scale: [0, 2, 5, 7, 10, 12],
    tempo: 104,
    hazard: 'Meteors',
  },
  {
    id: 'lava',
    index: 4,
    name: 'Lava World',
    subtitle: 'Molten core',
    description: 'Basalt shelves above a river of glowing magma.',
    accent: '#ff7a18',
    accent2: '#ffd166',
    skyTop: '#1a0603',
    skyBottom: '#7a1d05',
    fog: '#57190a',
    fogDensity: 0.028,
    ground: '#3a2018',
    groundAlt: '#26130e',
    groundStyle: 'basalt',
    propStyle: 'volcano',
    weather: 'embers',
    sun: '#ffb27a',
    sunIntensity: 2.1,
    ambient: '#ff5b1f',
    ambientIntensity: 0.7,
    scale: [0, 1, 3, 5, 7, 10, 12],
    tempo: 136,
    hazard: 'Eruptions',
  },
  {
    id: 'crystal',
    index: 5,
    name: 'Crystal Kingdom',
    subtitle: 'Prism caverns',
    description: 'Cathedral of light-refracting crystals and floating shards.',
    accent: '#a78bfa',
    accent2: '#5eead4',
    skyTop: '#0b0a2a',
    skyBottom: '#3b2a7a',
    fog: '#2a2260',
    fogDensity: 0.018,
    ground: '#3b3470',
    groundAlt: '#2b2557',
    groundStyle: 'crystal',
    propStyle: 'crystals',
    weather: 'sparkles',
    sun: '#e0d4ff',
    sunIntensity: 2.3,
    ambient: '#8b7bff',
    ambientIntensity: 0.8,
    scale: [0, 2, 4, 7, 9, 12],
    tempo: 118,
    hazard: 'Crystal shards',
  },
  {
    id: 'frozen',
    index: 6,
    name: 'Frozen Peak',
    subtitle: 'Aurora ridge',
    description: 'Blizzard-swept ice ridge under a green aurora.',
    accent: '#7dd3fc',
    accent2: '#a7f3d0',
    skyTop: '#071a2e',
    skyBottom: '#8fd4f2',
    fog: '#a9d8ee',
    fogDensity: 0.024,
    ground: '#dbeafe',
    groundAlt: '#b6d4ea',
    groundStyle: 'ice',
    propStyle: 'ice',
    weather: 'snow',
    sun: '#eaf6ff',
    sunIntensity: 2.4,
    ambient: '#9fd6ff',
    ambientIntensity: 0.85,
    scale: [0, 2, 3, 5, 7, 10, 12],
    tempo: 100,
    hazard: 'Avalanche ice',
  },
];

export const WORLD_MAP: Record<WorldId, WorldDef> = WORLDS.reduce(
  (acc, world) => {
    acc[world.id] = world;
    return acc;
  },
  {} as Record<WorldId, WorldDef>,
);

export function worldById(id: WorldId): WorldDef {
  return WORLD_MAP[id] ?? WORLDS[0];
}

/* ------------------------------------------------------------------ */
/* Scene construction                                                  */
/* ------------------------------------------------------------------ */

export interface WorldVisual {
  group: THREE.Group;
  sun: THREE.DirectionalLight;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

const disposables: THREE.BufferGeometry[] = [];

function disposeGroup(group: THREE.Object3D) {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
  disposables.length = 0;
}

function skyDome(world: WorldDef): THREE.Mesh {
  const geo = new THREE.SphereGeometry(90, 40, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(world.skyTop) },
      bottom: { value: new THREE.Color(world.skyBottom) },
      accent: { value: new THREE.Color(world.accent2) },
      sunDir: { value: new THREE.Vector3(0.35, 0.55, 0.75).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 bottom;
      uniform vec3 accent;
      uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(bottom, top, pow(h, 0.85));
        float sun = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 42.0);
        col += accent * sun * 0.55;
        float glow = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 6.0);
        col += accent * glow * 0.12;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

function starField(count: number, radius: number, color: string): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.9);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi) * 0.8 + 6;
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size: 0.42,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}

function palm(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({
    map: noiseTexture('#7a5230', '#4a2f18', 0.5),
    roughness: 0.85,
  });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 3.4, 8, 3), trunkMat);
  trunk.position.y = 1.7;
  trunk.rotation.z = (rand() - 0.5) * 0.22;
  g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({
    color: '#2fa36b',
    roughness: 0.55,
    side: THREE.DoubleSide,
    metalness: 0.05,
  });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.3, 4, 1, true), leafMat);
    leaf.position.set(0, 3.4, 0);
    leaf.rotation.z = Math.PI / 2.1;
    leaf.rotation.y = (i / 7) * Math.PI * 2;
    leaf.translateY(0.9);
    leaf.scale.set(1, 1, 0.22);
    g.add(leaf);
  }
  const nutMat = new THREE.MeshStandardMaterial({ color: '#6b4423', roughness: 0.7 });
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), nutMat);
    nut.position.set(Math.cos(i * 2.1) * 0.2, 3.25, Math.sin(i * 2.1) * 0.2);
    g.add(nut);
  }
  return g;
}

function tower(rand: () => number, accent: string): THREE.Group {
  const g = new THREE.Group();
  const h = 5 + rand() * 12;
  const w = 1.2 + rand() * 1.6;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, w),
    new THREE.MeshStandardMaterial({
      color: '#111830',
      roughness: 0.4,
      metalness: 0.55,
      map: windowTexture(accent, '#0b1024'),
      emissive: new THREE.Color(accent),
      emissiveIntensity: 0.32,
    }),
  );
  body.position.y = h / 2;
  g.add(body);
  const capMat = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: new THREE.Color(accent),
    emissiveIntensity: 2.2,
    roughness: 0.3,
  });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 0.12, w * 1.05), capMat);
  cap.position.y = h;
  g.add(cap);
  return g;
}

function pillar(rand: () => number, accent: string): THREE.Group {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({
    map: noiseTexture('#b08a5c', '#6d5233', 0.45),
    roughness: 0.9,
  });
  const h = 3 + rand() * 3.5;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, h, 12), stone);
  col.position.y = h / 2;
  g.add(col);
  const capMat = new THREE.MeshStandardMaterial({
    color: accent,
    metalness: 0.85,
    roughness: 0.28,
    emissive: new THREE.Color(accent),
    emissiveIntensity: 0.35,
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.22, 1.15), capMat);
  top.position.y = h;
  g.add(top);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.3, 1.25), stone);
  base.position.y = 0.15;
  g.add(base);
  return g;
}

function asteroidProp(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1 + rand() * 1.6, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const f = 0.72 + rand() * 0.5;
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map: noiseTexture('#5b5468', '#2a2633', 0.5),
      roughness: 0.95,
      metalness: 0.1,
    }),
  );
  mesh.position.y = 1.4 + rand();
  mesh.rotation.set(rand() * 3, rand() * 3, rand() * 3);
  g.add(mesh);
  return g;
}

function volcanoProp(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const h = 4 + rand() * 6;
  const rock = new THREE.Mesh(
    new THREE.ConeGeometry(3 + rand() * 2, h, 9, 2),
    new THREE.MeshStandardMaterial({
      map: noiseTexture('#4a2a20', '#1d0f0b', 0.55),
      roughness: 0.95,
    }),
  );
  rock.position.y = h / 2;
  g.add(rock);
  const lava = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 0.5, 9),
    new THREE.MeshStandardMaterial({
      color: '#ff6a00',
      emissive: new THREE.Color('#ff4d00'),
      emissiveIntensity: 4,
      roughness: 0.4,
    }),
  );
  lava.position.y = h - 0.1;
  g.add(lava);
  return g;
}

function crystalProp(rand: () => number, accent: string): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: accent,
    roughness: 0.08,
    metalness: 0.15,
    transmission: 0.55,
    thickness: 1.2,
    ior: 1.7,
    emissive: new THREE.Color(accent),
    emissiveIntensity: 0.35,
    clearcoat: 1,
  });
  for (let i = 0; i < 3 + Math.floor(rand() * 3); i++) {
    const h = 1.4 + rand() * 3.2;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(0.35 + rand() * 0.4, h, 5), mat);
    shard.position.set((rand() - 0.5) * 1.6, h / 2, (rand() - 0.5) * 1.6);
    shard.rotation.set((rand() - 0.5) * 0.5, rand() * 3, (rand() - 0.5) * 0.5);
    g.add(shard);
  }
  return g;
}

function iceProp(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#dff2ff',
    roughness: 0.12,
    metalness: 0.05,
    transmission: 0.4,
    thickness: 1.4,
    clearcoat: 1,
    emissive: new THREE.Color('#9fd6ff'),
    emissiveIntensity: 0.12,
  });
  for (let i = 0; i < 2 + Math.floor(rand() * 3); i++) {
    const h = 1.6 + rand() * 3.6;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.4 + rand() * 0.5, h, 6), mat);
    spike.position.set((rand() - 0.5) * 1.8, h / 2, (rand() - 0.5) * 1.8);
    spike.rotation.set((rand() - 0.5) * 0.35, rand() * 3, (rand() - 0.5) * 0.35);
    g.add(spike);
  }
  return g;
}

function weather(world: WorldDef): { points: THREE.Points; speed: Float32Array } {
  const count = world.weather === 'rain' ? 900 : world.weather === 'stars' ? 420 : 520;
  const positions = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 26;
    positions[i * 3 + 1] = Math.random() * 20;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    speed[i] = 0.5 + Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const size = world.weather === 'rain' ? 0.1 : world.weather === 'snow' ? 0.16 : 0.12;
  const mat = new THREE.PointsMaterial({
    color: world.weather === 'embers' ? '#ff8a3d' : world.weather === 'snow' ? '#ffffff' : world.accent,
    size,
    transparent: true,
    opacity: world.weather === 'rain' ? 0.55 : 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  return { points: new THREE.Points(geo, mat), speed };
}

/**
 * Builds a complete, lit 3D world: sky dome, ground with a tiled biome
 * texture, illuminated lane edges, background props, weather and lights.
 */
export function buildWorldVisual(world: WorldDef, quality: 'high' | 'medium' | 'low'): WorldVisual {
  const group = new THREE.Group();
  const rand = (() => {
    let s = (world.index + 1) * 9176;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  })();

  // --- Sky ---------------------------------------------------------
  const sky = skyDome(world);
  group.add(sky);

  if (world.id === 'space' || world.id === 'crystal') {
    group.add(starField(quality === 'low' ? 240 : 620, 55, '#ffffff'));
  }

  // --- Ground ------------------------------------------------------
  const groundMap = groundTexture(world.groundStyle, world.ground, world.groundAlt, world.accent2);
  groundMap.repeat.set(6, 4);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 40, 1, 1),
    new THREE.MeshStandardMaterial({
      map: groundMap,
      color: '#ffffff',
      roughness: 0.78,
      metalness: 0.12,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -12);
  ground.receiveShadow = true;
  group.add(ground);

  // Track surface: slightly raised, glossy, catches reflections
  const trackMap = groundMap.clone();
  trackMap.needsUpdate = true;
  trackMap.repeat.set(3, 2);
  const track = new THREE.Mesh(
    new THREE.PlaneGeometry(9.2, 26),
    new THREE.MeshStandardMaterial({
      map: trackMap,
      roughness: 0.55,
      metalness: 0.2,
      color: new THREE.Color(world.ground).lerp(new THREE.Color('#ffffff'), 0.12),
    }),
  );
  track.rotation.x = -Math.PI / 2;
  track.position.set(0, 0.012, -2);
  track.receiveShadow = true;
  group.add(track);

  // Glowing lane edges
  const edgeMat = new THREE.MeshStandardMaterial({
    color: world.accent,
    emissive: new THREE.Color(world.accent),
    emissiveIntensity: 2.6,
    roughness: 0.3,
    metalness: 0.4,
  });
  for (const x of [-4.62, 4.62]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 26), edgeMat);
    rail.position.set(x, 0.08, -2);
    group.add(rail);
  }

  // Horizon band of light
  const band = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 6),
    new THREE.MeshBasicMaterial({
      color: world.accent2,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  band.position.set(0, 3, -22);
  group.add(band);

  // --- Props -------------------------------------------------------
  const propCount = quality === 'low' ? 14 : quality === 'medium' ? 24 : 34;
  const props: THREE.Object3D[] = [];
  for (let i = 0; i < propCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (6.4 + rand() * 9);
    const z = -22 + rand() * 22;
    let prop: THREE.Group;
    switch (world.propStyle) {
      case 'palms':
        prop = palm(rand);
        break;
      case 'towers':
        prop = tower(rand, world.accent2);
        break;
      case 'pillars':
        prop = pillar(rand, world.accent);
        break;
      case 'asteroids':
        prop = asteroidProp(rand);
        break;
      case 'volcano':
        prop = volcanoProp(rand);
        break;
      case 'crystals':
        prop = crystalProp(rand, world.accent);
        break;
      default:
        prop = iceProp(rand);
    }
    prop.position.set(x, 0, z);
    const s = 0.8 + rand() * 0.7;
    prop.scale.setScalar(s);
    prop.rotation.y = rand() * Math.PI * 2;
    prop.userData.baseY = 0;
    prop.userData.sway = rand() * Math.PI * 2;
    group.add(prop);
    props.push(prop);
  }

  // --- Weather -----------------------------------------------------
  const weatherFx = weather(world);
  group.add(weatherFx.points);

  // --- Lights ------------------------------------------------------
  const hemi = new THREE.HemisphereLight(world.ambient, world.ground, world.ambientIntensity);
  group.add(hemi);

  const sun = new THREE.DirectionalLight(world.sun, world.sunIntensity);
  sun.position.set(6, 14, 8);
  sun.castShadow = true;
  const shadowSize = quality === 'low' ? 1024 : quality === 'high' ? 2048 : 1536;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 14;
  sun.shadow.camera.bottom = -6;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 45;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  group.add(sun);
  group.add(sun.target);

  const rim = new THREE.PointLight(world.accent, 26, 26, 2);
  rim.position.set(-7, 5, -6);
  group.add(rim);
  const rim2 = new THREE.PointLight(world.accent2, 22, 24, 2);
  rim2.position.set(7, 4, -4);
  group.add(rim2);

  const update = (dt: number, elapsed: number) => {
    sky.position.z = 0;
    // weather drift
    const pos = weatherFx.points.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < weatherFx.speed.length; i++) {
      const vy = weatherFx.speed[i];
      if (world.weather === 'rain') {
        arr[i * 3 + 1] -= dt * (14 * vy);
        arr[i * 3] -= dt * 1.2;
      } else if (world.weather === 'embers') {
        arr[i * 3 + 1] += dt * (1.6 * vy);
        arr[i * 3] += Math.sin(elapsed + i) * dt * 0.6;
      } else if (world.weather === 'snow') {
        arr[i * 3 + 1] -= dt * (1.9 * vy);
        arr[i * 3] += Math.sin(elapsed * 0.7 + i) * dt * 0.7;
      } else if (world.weather === 'stars') {
        arr[i * 3 + 1] += dt * 0.05 * vy;
      } else {
        arr[i * 3 + 1] -= dt * (0.9 * vy);
        arr[i * 3] += Math.sin(elapsed * 0.5 + i) * dt * 0.5;
      }
      if (arr[i * 3 + 1] < -1) arr[i * 3 + 1] = 20;
      if (arr[i * 3 + 1] > 21) arr[i * 3 + 1] = 0;
    }
    pos.needsUpdate = true;

    props.forEach((prop) => {
      const sway = prop.userData.sway as number;
      prop.rotation.z = Math.sin(elapsed * 0.8 + sway) * 0.02;
    });

    rim.intensity = 24 + Math.sin(elapsed * 2.2) * 4;
    rim2.intensity = 20 + Math.cos(elapsed * 1.7) * 4;
  };

  const dispose = () => {
    disposeGroup(group);
    group.clear();
  };

  return { group, sun, update, dispose };
}
