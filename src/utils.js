import * as THREE from 'three';

export const TAU = Math.PI * 2;

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (min = 0, max = 1) => min + Math.random() * (max - min);
export const randInt = (min, max) => Math.floor(rand(min, max + 1));
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInCubic = (t) => Math.pow(clamp(t, 0, 1), 3);
export const easeInOutQuad = (t) => {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
};

export function angleDelta(a, b) {
  let d = (b - a + Math.PI) % TAU;
  if (d < 0) d += TAU;
  return d - Math.PI;
}

export function roman(value) {
  const table = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let n = Math.max(0, Math.floor(value));
  let out = '';
  for (const [amount, numeral] of table) {
    while (n >= amount) {
      out += numeral;
      n -= amount;
    }
  }
  return out || '0';
}

export function canvas2d(width, height = width) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d') };
}

export function textureFromCanvas(canvas, { repeat = null, colorSpace = true } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  if (colorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  return texture;
}

export function makeNoiseTexture(size, base, options = {}) {
  const { canvas, ctx } = canvas2d(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  const {
    specks = 2800,
    speckColors = ['#000000', '#ffffff'],
    speckAlpha = 0.08,
    speckSize = 1.6,
    streaks = 0,
    streakColor = '#000000',
  } = options;

  for (let i = 0; i < specks; i++) {
    ctx.globalAlpha = rand(speckAlpha * 0.15, speckAlpha);
    ctx.fillStyle = pick(speckColors);
    const s = rand(0.4, speckSize);
    ctx.fillRect(rand(0, size), rand(0, size), s, s);
  }

  for (let i = 0; i < streaks; i++) {
    ctx.globalAlpha = rand(0.02, 0.1);
    ctx.strokeStyle = streakColor;
    ctx.lineWidth = rand(0.5, 4);
    ctx.beginPath();
    let x = rand(0, size);
    let y = rand(0, size);
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += rand(-18, 18);
      y += rand(4, 26);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  return textureFromCanvas(canvas);
}

export function radialTexture(size = 64, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const { canvas, ctx } = canvas2d(size);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.38, inner);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return textureFromCanvas(canvas);
}

export function disposeObject(root) {
  if (!root) return;
  root.traverse((child) => {
    if (child.isMesh || child.isPoints || child.isLine) {
      child.geometry?.dispose?.();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!material) continue;
        for (const key of Object.keys(material)) {
          const value = material[key];
          if (value?.isTexture) value.dispose?.();
        }
        material.dispose?.();
      }
    }
  });
}

export function projectedScreenDistance(camera, point, target = new THREE.Vector2()) {
  const projected = point.clone().project(camera);
  return target.set(projected.x, projected.y).length();
}

export function makeBoneMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xe4d7bd,
    roughness: 0.68,
    metalness: 0.02,
    flatShading: true,
  });
}

export function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}
