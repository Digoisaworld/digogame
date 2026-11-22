import * as THREE from 'three';

/**
 * Procedural texture factory.
 *
 * Everything the game renders is generated here at runtime (canvas + shaders),
 * so the project stays self-contained: no external texture downloads, no
 * missing assets at build time, and the whole look is reproducible from source.
 */

const cache = new Map<string, THREE.Texture>();

function canvas(size: number, height = size): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = height;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function finish(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  return tex;
}

function rnd(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Soft radial glow used by sprites, particles and reward auras. */
export function glowTexture(): THREE.Texture {
  const key = 'glow';
  const hit = cache.get(key);
  if (hit) return hit;
  const { c, ctx } = canvas(256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = finish(c);
  cache.set(key, tex);
  return tex;
}

/** Soft contact shadow blob. */
export function shadowTexture(): THREE.Texture {
  const key = 'shadow';
  const hit = cache.get(key);
  if (hit) return hit;
  const { c, ctx } = canvas(256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.62)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.34)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = finish(c);
  cache.set(key, tex);
  return tex;
}

/** The uploaded official DIGO crest, used on coins, crates and the menu. */
export function logoTexture(): THREE.Texture {
  const key = 'logo';
  const hit = cache.get(key);
  if (hit) return hit;
  const tex = new THREE.TextureLoader().load('/digo/digo-logo.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(key, tex);
  return tex;
}

/** DIGO body skin: creamy vinyl with a warm belly gradient and micro speckle. */
export function bodyTexture(base = '#f8d3b6', shade = '#e6a487', light = '#fff3e6'): THREE.Texture {
  const key = `body-${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  // Drawn at 1.5x and kept in the original 512-unit coordinate space, so the
  // skin has visibly finer grain on high-DPI phone screens without changing the
  // artwork itself.
  const { c, ctx } = canvas(768);
  ctx.scale(1.5, 1.5);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  const g = ctx.createRadialGradient(256, 210, 40, 256, 300, 330);
  g.addColorStop(0, light);
  g.addColorStop(0.55, base);
  g.addColorStop(1, shade);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const rand = rnd(7);
  for (let i = 0; i < 5200; i++) {
    const a = rand() * 0.05;
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(120,60,40,${a * 0.8})`;
    const r = rand() * 1.7 + 0.3;
    ctx.beginPath();
    ctx.arc(rand() * 512, rand() * 512, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = finish(c);
  cache.set(key, tex);
  return tex;
}

/** Sclera with a soft top shadow so the eye reads as a sphere even unlit. */
export function eyeTexture(): THREE.Texture {
  const key = 'eye';
  const hit = cache.get(key);
  if (hit) return hit;
  const { c, ctx } = canvas(384);
  ctx.scale(1.5, 1.5);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#c9d4e2');
  g.addColorStop(0.32, '#ffffff');
  g.addColorStop(0.82, '#f7fbff');
  g.addColorStop(1, '#d7e2ef');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = finish(c);
  cache.set(key, tex);
  return tex;
}

/** Ground surface per biome, tiled across the track. */
export function groundTexture(
  style: 'sand' | 'neon' | 'stone' | 'asteroid' | 'basalt' | 'crystal' | 'ice',
  base: string,
  alt: string,
  accent: string,
): THREE.Texture {
  const key = `ground-${style}-${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 512;
  const { c, ctx } = canvas(S);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  const rand = rnd(style.length * 977 + S);

  // shared grain
  for (let i = 0; i < 9000; i++) {
    const a = rand() * 0.09;
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(rand() * S, rand() * S, 1 + rand() * 2, 1 + rand() * 2);
  }

  if (style === 'sand') {
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.05 + rand() * 0.06})`;
      ctx.lineWidth = 1 + rand() * 2;
      ctx.beginPath();
      const y = rand() * S;
      ctx.moveTo(0, y);
      for (let x = 0; x < S; x += 32) ctx.lineTo(x, y + Math.sin((x + i) * 0.02) * 8);
      ctx.stroke();
    }
  } else if (style === 'neon') {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    for (let i = 0; i <= S; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, S);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(S, i);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.12 + rand() * 0.2})`;
      ctx.fillRect(rand() * S, rand() * S, 30 + rand() * 70, 20 + rand() * 50);
    }
  } else if (style === 'stone') {
    const bw = 84;
    const bh = 52;
    for (let row = 0; row * bh < S; row++) {
      for (let col = -1; col * bw < S; col++) {
        const off = row % 2 === 0 ? 0 : bw / 2;
        const x = col * bw + off;
        const y = row * bh;
        ctx.fillStyle = rand() > 0.5 ? alt : base;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x + 3, y + 3, bw - 6, bh - 6);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, bw - 6, bh - 6);
      }
    }
  } else if (style === 'asteroid') {
    for (let i = 0; i < 34; i++) {
      const x = rand() * S;
      const y = rand() * S;
      const r = 12 + rand() * 44;
      const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,0.5)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0.06)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (style === 'basalt') {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.75;
    for (let i = 0; i < 26; i++) {
      ctx.lineWidth = 1 + rand() * 2.5;
      ctx.beginPath();
      let x = rand() * S;
      let y = rand() * S;
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (rand() - 0.5) * 70;
        y += (rand() - 0.5) * 70;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (style === 'crystal') {
    for (let i = 0; i < 70; i++) {
      const x = rand() * S;
      const y = rand() * S;
      const w = 24 + rand() * 60;
      const h = 24 + rand() * 60;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y + h * 0.25);
      ctx.lineTo(x + w * 0.6, y + h);
      ctx.lineTo(x - w * 0.2, y + h * 0.7);
      ctx.closePath();
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.16)' : accent;
      ctx.globalAlpha = 0.28;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  } else if (style === 'ice') {
    for (let i = 0; i < 44; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.1 + rand() * 0.22})`;
      ctx.lineWidth = 1 + rand() * 3;
      ctx.beginPath();
      const x = rand() * S;
      const y = rand() * S;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 180, y + (rand() - 0.5) * 180);
      ctx.stroke();
    }
    for (let i = 0; i < 16; i++) {
      const x = rand() * S;
      const y = rand() * S;
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.ellipse(x, y, 30 + rand() * 60, 16 + rand() * 40, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // vignette so the track edges fall away
  const vg = ctx.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, S, S);

  const tex = finish(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  cache.set(key, tex);
  return tex;
}

/** Diagonal hazard stripes for explosive barrels and UI warnings. */
export function hazardTexture(a = '#ffb300', b = '#1a1208'): THREE.Texture {
  const key = `hazard-${a}-${b}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { c, ctx } = canvas(256);
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = a;
  ctx.save();
  ctx.translate(128, 128);
  ctx.rotate(-Math.PI / 4);
  for (let i = -320; i < 320; i += 64) ctx.fillRect(i, -320, 32, 640);
  ctx.restore();
  const tex = finish(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  cache.set(key, tex);
  return tex;
}

/** Lit window grid for distant city towers. */
export function windowTexture(color = '#8ef0ff', bg = '#0a1024'): THREE.Texture {
  const key = `window-${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { c, ctx } = canvas(256);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 256);
  const rand = rnd(31);
  for (let y = 8; y < 256; y += 18) {
    for (let x = 8; x < 256; x += 16) {
      if (rand() > 0.42) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.35 + rand() * 0.65;
        ctx.fillRect(x, y, 9, 11);
      }
    }
  }
  ctx.globalAlpha = 1;
  const tex = finish(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  cache.set(key, tex);
  return tex;
}

/** Rock/wood grain used by meteors, crates and pillars. */
export function noiseTexture(base: string, dark: string, contrast = 0.4): THREE.Texture {
  const key = `noise-${base}-${dark}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { c, ctx } = canvas(256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const rand = rnd(base.length * 331);
  for (let i = 0; i < 5200; i++) {
    ctx.fillStyle = rand() > 0.45 ? dark : 'rgba(255,255,255,0.16)';
    ctx.globalAlpha = rand() * contrast;
    ctx.beginPath();
    ctx.arc(rand() * 256, rand() * 256, rand() * 7 + 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = finish(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  cache.set(key, tex);
  return tex;
}

export function disposeTextureCache(): void {
  cache.forEach((tex) => tex.dispose());
  cache.clear();
}
