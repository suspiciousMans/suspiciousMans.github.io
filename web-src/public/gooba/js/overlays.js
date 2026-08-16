// Animated decorative overlays composited on top of the dithered image —
// rain, snow, scanline sweeps, VHS glitch bars, film scratches, light leaks.
// Unlike js/effects.js (which filters the existing pixels), these draw new
// elements whose position is a pure function of frameIndex, so scrubbing to
// any frame — or rendering a single still frame — always gives a correct,
// reproducible result with no simulated/mutable state.

export const OVERLAY_DEFS = [
  { id: 'rain', label: 'Rain', defaultAmount: 40 },
  { id: 'snow', label: 'Snow', defaultAmount: 35 },
  { id: 'scanSweep', label: 'Scanline Sweep', defaultAmount: 50 },
  { id: 'vhsBars', label: 'VHS Glitch Bars', defaultAmount: 30 },
  { id: 'filmScratches', label: 'Film Scratches', defaultAmount: 25 },
  { id: 'lightLeak', label: 'Light Leak', defaultAmount: 30 },
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

function blend(data, i, r, g, b, alpha) {
  data[i] = clamp(data[i] * (1 - alpha) + r * alpha);
  data[i + 1] = clamp(data[i + 1] * (1 - alpha) + g * alpha);
  data[i + 2] = clamp(data[i + 2] * (1 - alpha) + b * alpha);
}

function rain(imageData, amount, frameIndex) {
  if (amount <= 0) return imageData;
  const { data, width, height } = imageData;
  const density = Math.round(6 + (amount / 100) * 54);
  for (let i = 0; i < density; i++) {
    const rand = mulberry32(i * 7907 + 13);
    const x0 = rand() * width;
    const len = 6 + rand() * 10;
    const fallSpeed = (0.5 + rand()) * (height / 40);
    const startOffset = rand() * height;
    const wind = (rand() - 0.5) * 0.6;
    const y0 = (((startOffset + frameIndex * fallSpeed) % (height + len)) + (height + len)) % (height + len) - len;
    for (let s = 0; s < len; s++) {
      const y = Math.round(y0 + s);
      const x = Math.round(x0 + wind * s);
      if (y < 0 || y >= height || x < 0 || x >= width) continue;
      const idx = (y * width + x) * 4;
      const alpha = Math.min(1, 0.5 * (1 - s / len) + 0.15);
      blend(data, idx, 210, 230, 255, alpha);
    }
  }
  return imageData;
}

function snow(imageData, amount, frameIndex) {
  if (amount <= 0) return imageData;
  const { data, width, height } = imageData;
  const density = Math.round(4 + (amount / 100) * 40);
  for (let i = 0; i < density; i++) {
    const rand = mulberry32(i * 5303 + 91);
    const size = rand() < 0.7 ? 1 : 2;
    const baseX = rand() * width;
    const fallSpeed = (0.15 + rand() * 0.35) * (height / 60);
    const sway = 3 + rand() * 6;
    const swayFreq = 0.05 + rand() * 0.05;
    const startY = rand() * height;
    const y = (((startY + frameIndex * fallSpeed) % (height + size)) + (height + size)) % (height + size) - size;
    const x = baseX + Math.sin(frameIndex * swayFreq + i) * sway;
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const px = Math.round(x + dx), py = Math.round(y + dy);
        if (px < 0 || px >= width || py < 0 || py >= height) continue;
        blend(data, (py * width + px) * 4, 255, 255, 255, 0.85);
      }
    }
  }
  return imageData;
}

function scanSweep(imageData, amount, frameIndex) {
  if (amount <= 0) return imageData;
  const { data, width, height } = imageData;
  const bandHeight = Math.max(4, Math.round(height * 0.12));
  const period = Math.max(20, Math.round(60 - (amount / 100) * 40));
  const phase = Math.round(period * 0.35);
  const t = (frameIndex + phase) % period;
  const centerY = (t / period) * (height + bandHeight) - bandHeight;
  for (let y = 0; y < height; y++) {
    const dist = Math.abs(y - centerY);
    if (dist > bandHeight) continue;
    const strength = (1 - dist / bandHeight) * (amount / 100) * 0.6;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = clamp(data[idx] + 255 * strength * 0.5);
      data[idx + 1] = clamp(data[idx + 1] + 255 * strength * 0.5);
      data[idx + 2] = clamp(data[idx + 2] + 255 * strength * 0.5);
    }
  }
  return imageData;
}

function vhsBars(imageData, amount, frameIndex) {
  if (amount <= 0) return imageData;
  const { data, width, height } = imageData;
  const src = data.slice();
  const rand = mulberry32(Math.floor(frameIndex / 3) * 1013 + 7);
  const barCount = Math.round(1 + (amount / 100) * 4);
  for (let b = 0; b < barCount; b++) {
    if (rand() > 0.5) continue;
    const barY = Math.floor(rand() * height);
    const barH = 1 + Math.floor(rand() * Math.max(2, height * 0.06));
    const shift = Math.round((rand() - 0.5) * width * 0.25 * (amount / 100));
    for (let y = barY; y < Math.min(height, barY + barH); y++) {
      for (let x = 0; x < width; x++) {
        const srcX = ((x - shift) % width + width) % width;
        const si = (y * width + srcX) * 4;
        const di = (y * width + x) * 4;
        data[di] = clamp(src[si] + 35);
        data[di + 1] = clamp(src[si + 1] + 35);
        data[di + 2] = clamp(src[si + 2] + 35);
      }
    }
  }
  return imageData;
}

function filmScratches(imageData, amount, frameIndex) {
  if (amount <= 0) return imageData;
  const { data, width, height } = imageData;
  const count = Math.round(1 + (amount / 100) * 5);
  const rand = mulberry32(frameIndex * 181 + 3);
  for (let i = 0; i < count; i++) {
    if (rand() > 0.6) continue;
    const x0 = rand() * width;
    const jitter = (rand() - 0.5) * 2;
    const bright = rand() < 0.5;
    for (let y = 0; y < height; y++) {
      const x = Math.round(x0 + Math.sin(y * 0.2 + i) * jitter);
      if (x < 0 || x >= width) continue;
      const idx = (y * width + x) * 4;
      if (bright) {
        data[idx] = clamp(data[idx] + 120);
        data[idx + 1] = clamp(data[idx + 1] + 120);
        data[idx + 2] = clamp(data[idx + 2] + 120);
      } else {
        data[idx] = clamp(data[idx] * 0.3);
        data[idx + 1] = clamp(data[idx + 1] * 0.3);
        data[idx + 2] = clamp(data[idx + 2] * 0.3);
      }
    }
  }
  return imageData;
}

function lightLeak(imageData, amount, frameIndex) {
  if (amount <= 0) return imageData;
  const { data, width, height } = imageData;
  const strength = amount / 100;
  const cx = width * (0.5 + 0.4 * Math.sin(frameIndex * 0.02));
  const cy = height * (0.3 + 0.3 * Math.cos(frameIndex * 0.017));
  const radius = Math.max(width, height) * 0.6;
  const color = [255, 150, 80];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / radius;
      const falloff = Math.max(0, 1 - dist);
      const alpha = falloff * falloff * strength * 0.5;
      if (alpha <= 0) continue;
      const idx = (y * width + x) * 4;
      data[idx] = clamp(data[idx] + color[0] * alpha);
      data[idx + 1] = clamp(data[idx + 1] + color[1] * alpha);
      data[idx + 2] = clamp(data[idx + 2] + color[2] * alpha);
    }
  }
  return imageData;
}

const OVERLAY_FNS = { rain, snow, scanSweep, vhsBars, filmScratches, lightLeak };

export function applyOverlays(imageData, stack, frameIndex = 0) {
  let result = imageData;
  for (const overlay of stack) {
    if (!overlay.enabled) continue;
    const fn = OVERLAY_FNS[overlay.id];
    if (fn) result = fn(result, overlay.amount, frameIndex);
  }
  return result;
}
