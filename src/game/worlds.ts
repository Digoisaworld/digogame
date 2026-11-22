import * as THREE from 'three';
import type { WorldId } from './types';

export interface WorldDef {
  id: WorldId;
  index: number;
  name: string;
  subtitle: string;
  description: string;
  unlockLevel: number;
  accent: string;
  accent2: string;
  skyTop: string;
  skyBottom: string;
  fog: string;
  fogDensity: number;
  ground: string;
  groundEdge: string;
  /** Semitone offsets for the procedural music loop. */
  scale: number[];
  tempo: number;
  /** World-specific danger flavour shown in the codex. */
  hazard: string;
}

export const WORLDS: WorldDef[] = [
  {
    id: 'island',
    index: 0,
    name: 'Tropical Island',
    subtitle: 'Sunlit shores',
    description:
      'Palm trees, turquoise water and golden sand. Falling coconuts and driftwood make the first world friendly but never safe.',
    unlockLevel: 1,
    accent: '#22d3ee',
    accent2: '#ffd166',
    skyTop: '#2ec5ff',
    skyBottom: '#bff4ff',
    fog: '#a9ecff',
    fogDensity: 0.028,
    ground: '#f6d79a',
    groundEdge: '#0ea5a5',
    scale: [0, 2, 4, 7, 9, 12],
    tempo: 108,
    hazard: 'Driftwood spikes and falling coconuts',
  },
  {
    id: 'cyber',
    index: 1,
    name: 'Cyberpunk Neon City',
    subtitle: 'Neon skyline',
    description:
      'Rain-slick rooftops under a purple sky. Holograms flicker while electric hazards arc between the neon towers.',
    unlockLevel: 3,
    accent: '#ff2fd0',
    accent2: '#22e6ff',
    skyTop: '#150428',
    skyBottom: '#3d0f57',
    fog: '#2b0b3f',
    fogDensity: 0.035,
    ground: '#22103a',
    groundEdge: '#ff2fd0',
    scale: [0, 3, 5, 7, 10, 12],
    tempo: 124,
    hazard: 'Electric arcs and rogue drones',
  },
  {
    id: 'temple',
    index: 2,
    name: 'Ancient Treasure Temple',
    subtitle: 'Lost ruins',
    description:
      'Torch-lit stone halls full of golden idols. Ancient traps drop from the ceiling without warning.',
    unlockLevel: 5,
    accent: '#f0b429',
    accent2: '#ff8a3d',
    skyTop: '#2a1a08',
    skyBottom: '#5c3a12',
    fog: '#3a2410',
    fogDensity: 0.04,
    ground: '#6b4a22',
    groundEdge: '#f0b429',
    scale: [0, 2, 3, 7, 8, 12],
    tempo: 96,
    hazard: 'Falling stone traps and spike pits',
  },
  {
    id: 'space',
    index: 3,
    name: 'Space Galaxy',
    subtitle: 'Deep orbit',
    description:
      'A violet nebula above an asteroid platform. Meteors streak in from every direction of the void.',
    unlockLevel: 8,
    accent: '#8b5cf6',
    accent2: '#38bdf8',
    skyTop: '#05030f',
    skyBottom: '#1b1240',
    fog: '#0a0620',
    fogDensity: 0.022,
    ground: '#241a44',
    groundEdge: '#8b5cf6',
    scale: [0, 3, 7, 10, 14, 15],
    tempo: 112,
    hazard: 'Meteor storms and gravity wells',
  },
  {
    id: 'lava',
    index: 4,
    name: 'Lava World',
    subtitle: 'Molten core',
    description:
      'Rivers of fire beneath a cracked black crust. Everything here burns, and the bombs hit harder.',
    unlockLevel: 11,
    accent: '#ff5b1a',
    accent2: '#ffd166',
    skyTop: '#1a0505',
    skyBottom: '#5e1206',
    fog: '#2b0704',
    fogDensity: 0.045,
    ground: '#2a1210',
    groundEdge: '#ff5b1a',
    scale: [0, 1, 5, 7, 8, 12],
    tempo: 132,
    hazard: 'Erupting geysers and fire bombs',
  },
  {
    id: 'crystal',
    index: 5,
    name: 'Crystal Kingdom',
    subtitle: 'Shimmering caverns',
    description:
      'Giant crystal formations refract a turquoise light. Rare diamonds spawn far more often here.',
    unlockLevel: 14,
    accent: '#7ef9ff',
    accent2: '#c084fc',
    skyTop: '#04141c',
    skyBottom: '#0b3b4a',
    fog: '#08222c',
    fogDensity: 0.03,
    ground: '#0f3542',
    groundEdge: '#7ef9ff',
    scale: [0, 4, 7, 11, 14, 16],
    tempo: 104,
    hazard: 'Shattering crystal shards',
  },
  {
    id: 'frozen',
    index: 6,
    name: 'Frozen Mountain',
    subtitle: 'Glacial peak',
    description:
      'Blizzard winds over blue ice. Objects slide sideways as the storm pushes them across the slope.',
    unlockLevel: 17,
    accent: '#bfeaff',
    accent2: '#6ea8ff',
    skyTop: '#0d2233',
    skyBottom: '#2c5876',
    fog: '#173346',
    fogDensity: 0.05,
    ground: '#8fb8cf',
    groundEdge: '#bfeaff',
    scale: [0, 2, 4, 7, 9, 11],
    tempo: 92,
    hazard: 'Avalanche ice and frozen spikes',
  },
];

export const WORLD_MAP: Record<WorldId, WorldDef> = WORLDS.reduce(
  (acc, w) => {
    acc[w.id] = w;
    return acc;
  },
  {} as Record<WorldId, WorldDef>,
);

function starfield(count: number, radius: number, color: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const r = radius * (0.55 + Math.random() * 0.45);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.8 + 2;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size: 0.13,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

export interface WorldVisual {
  group: THREE.Group;
  update: (t: number, dt: number) => void;
  dispose: () => void;
}

/**
 * Builds the 3D backdrop for a world: sky dome, ground slab, horizon props and
 * drifting ambience. Kept procedural so the whole game ships with no binaries.
 */
export function buildWorldVisual(world: WorldDef): WorldVisual {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const accent = new THREE.Color(world.accent);
  const accent2 = new THREE.Color(world.accent2);

  const skyGeo = new THREE.SphereGeometry(60, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(world.skyTop) },
      bottom: { value: new THREE.Color(world.skyBottom) },
      accent: { value: accent },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 bottom;
      uniform vec3 accent;
      varying vec3 vWorld;
      void main() {
        float h = clamp((normalize(vWorld).y + 1.0) * 0.5, 0.0, 1.0);
        vec3 col = mix(bottom, top, pow(h, 0.85));
        col += accent * 0.06 * pow(1.0 - h, 3.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  group.add(sky);
  disposables.push(skyGeo, skyMat);

  const stars = starfield(world.id === 'space' ? 700 : 260, 26, accent2.getHex());
  group.add(stars);
  disposables.push(stars.geometry, stars.material as THREE.Material);

  // Playfield ground: a wide slab with an emissive rim so the movement lane reads clearly.
  const groundGeo = new THREE.BoxGeometry(16, 0.6, 7);
  const groundMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(world.ground),
    roughness: 0.72,
    metalness: 0.18,
    emissive: accent.clone().multiplyScalar(0.1),
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(0, -1.5, -0.5);
  group.add(ground);
  disposables.push(groundGeo, groundMat);

  const rimGeo = new THREE.BoxGeometry(16.4, 0.12, 0.22);
  const rimMat = new THREE.MeshBasicMaterial({ color: accent2 });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.set(0, -1.2, 2.9);
  group.add(rim);
  disposables.push(rimGeo, rimMat);

  // Horizon props: silhouette blocks that give each world its own skyline.
  const propMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(world.skyBottom).offsetHSL(0, 0.1, 0.06),
    roughness: 0.9,
    metalness: 0.1,
    emissive: accent.clone().multiplyScalar(0.16),
  });
  disposables.push(propMat);
  const propGeo = new THREE.BoxGeometry(1, 1, 1);
  disposables.push(propGeo);

  const props: THREE.Mesh[] = [];
  const propCount = 22;
  for (let i = 0; i < propCount; i += 1) {
    const mesh = new THREE.Mesh(propGeo, propMat);
    const spread = 22;
    const x = (i / propCount) * spread - spread / 2 + (Math.random() - 0.5) * 0.6;
    const isCrystal = world.id === 'crystal';
    const h = isCrystal ? 2 + Math.random() * 5 : 1 + Math.random() * 4.2;
    mesh.scale.set(0.8 + Math.random() * 1.6, h, 0.8 + Math.random() * 1.4);
    mesh.position.set(x, -1.2 + h / 2, -9 - Math.random() * 6);
    if (isCrystal) mesh.rotation.z = (Math.random() - 0.5) * 0.4;
    props.push(mesh);
    group.add(mesh);
  }

  // Drifting motes / snow / embers depending on the world.
  const moteCount = 180;
  const motePositions = new Float32Array(moteCount * 3);
  const moteSpeed = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i += 1) {
    motePositions[i * 3] = (Math.random() - 0.5) * 18;
    motePositions[i * 3 + 1] = Math.random() * 12 - 1;
    motePositions[i * 3 + 2] = -6 + Math.random() * 8;
    moteSpeed[i] = 0.3 + Math.random() * 0.9;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMat = new THREE.PointsMaterial({
    color: accent2,
    size: 0.075,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  group.add(motes);
  disposables.push(moteGeo, moteMat);

  const ambient = new THREE.AmbientLight(new THREE.Color(world.fog), 1.5);
  group.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(4, 9, 7);
  group.add(key);
  const fill = new THREE.PointLight(accent.getHex(), 40, 26, 2);
  fill.position.set(-5, 3, 4);
  group.add(fill);

  const update = (t: number, dt: number) => {
    const pos = moteGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < moteCount; i += 1) {
      let y = pos.getY(i) - moteSpeed[i] * dt * (world.id === 'frozen' ? 2.6 : 1);
      let x = pos.getX(i);
      if (world.id === 'frozen') x += Math.sin(t * 0.6 + i) * dt * 0.6;
      if (y < -2) {
        y = 11;
        x = (Math.random() - 0.5) * 18;
      }
      pos.setY(i, y);
      pos.setX(i, x);
    }
    pos.needsUpdate = true;
    fill.intensity = 34 + Math.sin(t * 1.7) * 8;
    rim.material.opacity = 1;
    for (let i = 0; i < props.length; i += 1) {
      props[i].position.y += Math.sin(t * 0.8 + i) * dt * 0.05;
    }
  };

  return {
    group,
    update,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
