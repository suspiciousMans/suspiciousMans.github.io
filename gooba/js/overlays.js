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

// ---------- customizable particle overlays ----------
// User-built overlay layers: pick a shape, a color, an optional glow, and a
// motion mode. Each particle's position is still a pure function of
// (frameIndex, its own index, the layer's seed) — no simulated state — so
// these behave identically to the built-in overlays under scrubbing/export.

export const CUSTOM_OVERLAY_SHAPES = ['circle', 'square', 'triangle', 'star', 'diamond', 'streak'];
export const CUSTOM_OVERLAY_MOTIONS = [
  { id: 'falling', label: 'Falling' },
  { id: 'floating', label: 'Floating' },
  { id: 'static', label: 'Static Twinkle' },
  { id: 'sweep', label: 'Sweep' },
];

export const CUSTOM_OVERLAY_PRESETS = {
  blank: { name: 'Custom', shape: 'circle', color: '#ffffff', motion: 'falling', speed: 40, count: 20, size: 2, glow: false, glowAmount: 40 },
  sparkles: { name: 'Sparkles', shape: 'star', color: '#fff6c9', motion: 'static', speed: 40, count: 18, size: 3, glow: true, glowAmount: 60 },
  embers: { name: 'Embers', shape: 'circle', color: '#ff6a1f', motion: 'floating', speed: 30, count: 14, size: 2, glow: true, glowAmount: 70 },
  orbs: { name: 'Orbs', shape: 'circle', color: '#7fd8ff', motion: 'floating', speed: 20, count: 6, size: 6, glow: true, glowAmount: 80 },
};

function hexToRgbLocal(hex) {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function plot(data, width, height, x, y, r, g, b, alpha) {
  if (alpha <= 0 || x < 0 || x >= width || y < 0 || y >= height) return;
  const i = (y * width + x) * 4;
  data[i] = clamp(data[i] * (1 - alpha) + r * alpha);
  data[i + 1] = clamp(data[i + 1] * (1 - alpha) + g * alpha);
  data[i + 2] = clamp(data[i + 2] * (1 - alpha) + b * alpha);
}

function drawParticle(imageData, cx, cy, size, shape, rgb, alpha, glowAmount) {
  const { data, width, height } = imageData;
  const r = Math.max(0.6, size);
  const [cr, cg, cb] = rgb;

  if (glowAmount > 0) {
    const glowR = r * 2.2;
    const gR = Math.ceil(glowR);
    for (let dy = -gR; dy <= gR; dy++) {
      for (let dx = -gR; dx <= gR; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > glowR) continue;
        const falloff = Math.max(0, 1 - dist / glowR);
        const a = falloff * falloff * (glowAmount / 100) * 0.5 * alpha;
        plot(data, width, height, Math.round(cx + dx), Math.round(cy + dy), cr, cg, cb, a);
      }
    }
  }

  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      let inside = false;
      if (shape === 'circle') {
        inside = dx * dx + dy * dy <= r * r;
      } else if (shape === 'square') {
        inside = Math.abs(dx) <= r && Math.abs(dy) <= r;
      } else if (shape === 'diamond') {
        inside = Math.abs(dx) + Math.abs(dy) <= r;
      } else if (shape === 'triangle') {
        if (dy < -r || dy > r) {
          inside = false;
        } else {
          const w = r * ((dy + r) / (2 * r || 1));
          inside = Math.abs(dx) <= w;
        }
      } else if (shape === 'star') {
        const onAxis = (Math.abs(dx) <= 0.6 && Math.abs(dy) <= r) || (Math.abs(dy) <= 0.6 && Math.abs(dx) <= r);
        const center = dx * dx + dy * dy <= Math.max(1, r * 0.35) * Math.max(1, r * 0.35);
        inside = onAxis || center;
      } else if (shape === 'streak') {
        inside = Math.abs(dx) <= Math.max(1, r * 0.35) && dy >= -r * 2.5 && dy <= r * 0.6;
      } else {
        inside = dx * dx + dy * dy <= r * r;
      }
      if (!inside) continue;
      plot(data, width, height, Math.round(cx + dx), Math.round(cy + dy), cr, cg, cb, alpha);
    }
  }
}

function renderCustomOverlay(imageData, config, frameIndex) {
  if (!config.enabled || config.count <= 0) return imageData;
  const { width, height } = imageData;
  const rgb = hexToRgbLocal(config.color);
  const speed = config.speed / 100;

  for (let i = 0; i < config.count; i++) {
    const rand = mulberry32(config.seed * 100003 + i * 7907 + 13);
    const baseX = rand() * width;
    const baseY = rand() * height;
    const size = Math.max(0.6, config.size * (0.6 + rand() * 0.8));
    let x, y, alpha = 1;

    if (config.motion === 'falling') {
      const fallSpeed = (0.3 + speed * 2.2) * (height / 50) * (0.6 + rand() * 0.8);
      const wind = (rand() - 0.5) * 5;
      const span = height + size * 2;
      y = (((baseY + frameIndex * fallSpeed) % span) + span) % span - size;
      x = baseX + Math.sin(frameIndex * 0.05 + i) * wind;
    } else if (config.motion === 'sweep') {
      const sweepSpeed = (0.3 + speed * 2.2) * (width / 50) * (0.6 + rand() * 0.8);
      const span = width + size * 2;
      x = (((baseX + frameIndex * sweepSpeed) % span) + span) % span - size;
      y = baseY;
    } else if (config.motion === 'static') {
      x = baseX;
      y = baseY;
      alpha = 0.35 + 0.65 * Math.abs(Math.sin(frameIndex * (0.04 + speed * 0.12) + i * 1.7));
    } else {
      // floating
      const freq = 0.015 + speed * 0.03 + rand() * 0.01;
      const ampX = (4 + rand() * 10) * (0.4 + speed);
      const ampY = (4 + rand() * 10) * (0.4 + speed);
      x = baseX + Math.sin(frameIndex * freq + i * 3.1) * ampX;
      y = baseY + Math.cos(frameIndex * freq * 1.4 + i * 2.3) * ampY;
    }

    drawParticle(imageData, x, y, size, config.shape, rgb, alpha, config.glow ? config.glowAmount : 0);
  }
  return imageData;
}

export function applyCustomOverlays(imageData, list, frameIndex = 0) {
  let result = imageData;
  for (const config of list) {
    result = renderCustomOverlay(result, config, frameIndex);
  }
  return result;
}
