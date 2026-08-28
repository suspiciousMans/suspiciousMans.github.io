// Stackable post-processing effects. Each effect operates on an ImageData
// (post-dither) and optionally varies over time via frameIndex, so a stack
// of effects can turn even a still image into a lively looping animation.

export const EFFECT_DEFS = [
  { id: 'scanlines', label: 'Scanlines', defaultAmount: 50 },
  { id: 'vignette', label: 'Vignette', defaultAmount: 40 },
  { id: 'chromaticAberration', label: 'Chromatic Aberration', defaultAmount: 30 },
  { id: 'grain', label: 'Grain', defaultAmount: 25 },
  { id: 'glow', label: 'Glow', defaultAmount: 30 },
  { id: 'jpegGlitch', label: 'JPEG Glitch', defaultAmount: 30 },
  { id: 'pixelSort', label: 'Pixel Sort', defaultAmount: 35 },
  { id: 'crtWarp', label: 'CRT Warp', defaultAmount: 40 },
  { id: 'phosphorMask', label: 'Phosphor Mask', defaultAmount: 35 },
];

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scanlines(imageData, amount, frameIndex) {
  if (amount <= 0) return imageData;
  const { data, width, height } = imageData;
  const strength = amount / 100;
  const offset = Math.floor(frameIndex / 2) % 2;
  for (let y = 0; y < height; y++) {
    if ((y + offset) % 2 !== 0) continue;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] *= 1 - strength;
      data[i + 1] *= 1 - strength;
      data[i + 2] *= 1 - strength;
    }
  }
  return imageData;
}

function vignette(imageData, amount) {
  if (amount <= 0) return imageData;
  const { data, width, height } = imageData;
  const strength = amount / 100;
  const cx = width / 2, cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const falloff = 1 - strength * dist * dist;
      const i = (y * width + x) * 4;
      data[i] = clamp(data[i] * falloff);
      data[i + 1] = clamp(data[i + 1] * falloff);
      data[i + 2] = clamp(data[i + 2] * falloff);
    }
  }
  return imageData;
}

function chromaticAberration(imageData, amount, frameIndex) {
  if (amount <= 0) return imageData;
  const { data, width, height } = imageData;
  const src = data.slice();
  const maxShift = 6;
  const jitter = Math.sin(frameIndex * 0.6) * 0.5 + 0.5;
  const shift = Math.max(1, Math.round((amount / 100) * maxShift * (0.7 + 0.3 * jitter)));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const rx = Math.min(width - 1, Math.max(0, x - shift));
      const bx = Math.min(width - 1, Math.max(0, x + shift));
      const ri = (y * width + rx) * 4;
      const bi = (y * width + bx) * 4;
      data[i] = src[ri];
      data[i + 1] = src[i + 1];
      data[i + 2] = src[bi + 2];
    }
  }
  return imageData;
}

function grain(imageData, amount) {
  if (amount <= 0) return imageData;
  const { data } = imageData;
  const strength = (amount / 100) * 60;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * strength;
    data[i] = clamp(data[i] + n);
    data[i + 1] = clamp(data[i + 1] + n);
    data[i + 2] = clamp(data[i + 2] + n);
  }
  return imageData;
}

function boxBlurPass(src, width, height, radius, horizontal) {
  const out = new Float32Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = horizontal ? x + k : x;
        const yy = horizontal ? y : y + k;
        if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
        const p = (yy * width + xx) * 3;
        r += src[p]; g += src[p + 1]; b += src[p + 2]; count++;
      }
      const p = (y * width + x) * 3;
      out[p] = r / count; out[p + 1] = g / count; out[p + 2] = b / count;
    }
  }
  return out;
}

function glow(imageData, amount) {
  if (amount <= 0) return imageData;
  const { data, width, height } = imageData;
  const strength = amount / 100;
  const bright = new Float32Array(width * height * 3);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 3) {
    bright[p] = data[i] > 150 ? data[i] : 0;
    bright[p + 1] = data[i + 1] > 150 ? data[i + 1] : 0;
    bright[p + 2] = data[i + 2] > 150 ? data[i + 2] : 0;
  }
  let blurred = boxBlurPass(bright, width, height, 2, true);
  blurred = boxBlurPass(blurred, width, height, 2, false);
  blurred = boxBlurPass(blurred, width, height, 2, true);
  blurred = boxBlurPass(blurred, width, height, 2, false);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 3) {
    data[i] = clamp(data[i] + blurred[p] * strength * 0.6);
    data[i + 1] = clamp(data[i + 1] + blurred[p + 1] * strength * 0.6);
    data[i + 2] = clamp(data[i + 2] + blurred[p + 2] * strength * 0.6);
  }
  return imageData;
}

function jpegGlitch(imageData, amount, frameIndex) {
  if (amount <= 0) return imageData;
  const { data, width, height } = imageData;
  const strength = amount / 100;
  const block = 8;
  const rand = mulberry32(frameIndex * 9973 + 17);
  for (let by = 0; by < height; by += block) {
    for (let bx = 0; bx < width; bx += block) {
      if (rand() > strength * 0.6) continue;
      const bw = Math.min(block, width - bx);
      const bh = Math.min(block, height - by);
      let r = 0, g = 0, b = 0, count = 0;
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          const i = (y * width + x) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
        }
      }
      r /= count; g /= count; b /= count;
      const colorShift = (rand() - 0.5) * 40 * strength;
      const xOffset = Math.round((rand() - 0.5) * bw * strength);
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          const i = (y * width + x) * 4;
          const srcX = Math.min(width - 1, Math.max(0, x + xOffset));
          const si = (y * width + srcX) * 4;
          data[i] = clamp(data[si] * (1 - strength * 0.5) + (r + colorShift) * (strength * 0.5));
          data[i + 1] = clamp(data[si + 1] * (1 - strength * 0.5) + (g + colorShift) * (strength * 0.5));
          data[i + 2] = clamp(data[si + 2] * (1 - strength * 0.5) + (b + colorShift) * (strength * 0.5));
        }
      }
    }
  }
  return imageData;
}

function luminance(data, i) {
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

function pixelSort(imageData, amount, frameIndex) {
  if (amount <= 0) return imageData;
  const { data, width, height } = imageData;
  const strength = amount / 100;
  const rand = mulberry32(frameIndex * 4211 + 29);
  const threshold = 235 - strength * 175;
  const rowCoverage = 0.25 + strength * 0.65;

  for (let y = 0; y < height; y++) {
    if (rand() > rowCoverage) continue;
    let x = 0;
    while (x < width) {
      if (luminance(data, (y * width + x) * 4) < threshold) { x++; continue; }
      let runEnd = x;
      while (runEnd < width && luminance(data, (y * width + runEnd) * 4) >= threshold) runEnd++;

      const run = [];
      for (let px = x; px < runEnd; px++) {
        const i = (y * width + px) * 4;
        run.push([data[i], data[i + 1], data[i + 2], data[i + 3]]);
      }
      run.sort((a, b) => (0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2]) - (0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2]));
      for (let k = 0; k < run.length; k++) {
        const i = (y * width + x + k) * 4;
        data[i] = run[k][0]; data[i + 1] = run[k][1]; data[i + 2] = run[k][2]; data[i + 3] = run[k][3];
      }
      x = runEnd + 1;
    }
  }
  return imageData;
}

function crtWarp(imageData, amount) {
  if (amount <= 0) return imageData;
  const { data, width, height } = imageData;
  const src = data.slice();
  const strength = (amount / 100) * 0.35;
  const cx = width / 2, cy = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = cx ? (x - cx) / cx : 0;
      const ny = cy ? (y - cy) / cy : 0;
      const r2 = nx * nx + ny * ny;
      const factor = 1 + strength * r2;
      const srcX = cx + nx * factor * cx;
      const srcY = cy + ny * factor * cy;
      const i = (y * width + x) * 4;

      if (srcX < 0 || srcX >= width - 1 || srcY < 0 || srcY >= height - 1) {
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
        continue;
      }
      const si = (Math.round(srcY) * width + Math.round(srcX)) * 4;
      const darken = 1 - Math.min(0.85, r2 * 0.75 * strength);
      data[i] = clamp(src[si] * darken);
      data[i + 1] = clamp(src[si + 1] * darken);
      data[i + 2] = clamp(src[si + 2] * darken);
    }
  }
  return imageData;
}

function phosphorMask(imageData, amount) {
  if (amount <= 0) return imageData;
  const { data, width, height } = imageData;
  const strength = amount / 100;
  const mult = 1 - strength * 0.7;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const channel = x % 3;
      if (channel !== 0) data[i] = clamp(data[i] * mult);
      if (channel !== 1) data[i + 1] = clamp(data[i + 1] * mult);
      if (channel !== 2) data[i + 2] = clamp(data[i + 2] * mult);
    }
  }
  return imageData;
}

export function applyTemporalJitter(imageData, amount, frameIndex) {
  if (amount <= 0) return imageData;
  const { data } = imageData;
  const rand = mulberry32(frameIndex * 7919 + 3);
  const strength = (amount / 100) * 24;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rand() - 0.5) * strength;
    data[i] = clamp(data[i] + n);
    data[i + 1] = clamp(data[i + 1] + n);
    data[i + 2] = clamp(data[i + 2] + n);
  }
  return imageData;
}

const EFFECT_FNS = {
  scanlines, vignette, chromaticAberration, grain, glow, jpegGlitch,
  pixelSort, crtWarp, phosphorMask,
};

export function applyEffects(imageData, stack, frameIndex = 0) {
  let result = imageData;
  for (const effect of stack) {
    if (!effect.enabled) continue;
    const fn = EFFECT_FNS[effect.id];
    if (fn) result = fn(result, effect.amount, frameIndex);
  }
  return result;
}
