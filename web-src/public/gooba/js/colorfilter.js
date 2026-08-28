// A camera-style color filter: tints the final composited image the way a
// colored glass filter over a lens would, without touching the dithering
// palette itself. Applied as the very last compositing step, after overlays,
// so it grades the whole shot the way a real lens filter affects everything
// entering the lens.
//
// Two color sources: a solid color, or a gradient of 2-5 stops sampled
// either spatially (a wash across the image at a chosen angle) or by
// per-pixel brightness (a "gradient map" — the classic shadows/midtones/
// highlights film color-grading technique).

export const FILTER_BLEND_MODES = [
  { id: 'multiply', label: 'Multiply' },
  { id: 'tint', label: 'Tint' },
  { id: 'screen', label: 'Screen' },
  { id: 'overlay', label: 'Overlay' },
];

export const FILTER_PRESET_COLORS = [
  { id: 'warm', label: 'Warm', color: '#ff9d3c' },
  { id: 'cool', label: 'Cool', color: '#3ca9ff' },
  { id: 'sepia', label: 'Sepia', color: '#a9762f' },
  { id: 'rose', label: 'Vintage Rose', color: '#e08a9b' },
  { id: 'teal', label: 'Cyanotype', color: '#2fb8b0' },
  { id: 'infrared', label: 'Infrared', color: '#ff2fa0' },
  { id: 'lime', label: 'Lime', color: '#8fd93f' },
  { id: 'violet', label: 'Violet', color: '#8a6fe0' },
];

export const GRADIENT_PRESETS = [
  { id: 'sunset', label: 'Sunset', stops: ['#ff6b6b', '#ffb35c', '#4a3f8f'] },
  { id: 'tealOrange', label: 'Teal & Orange', stops: ['#1f7a6e', '#ff9d3c'] },
  { id: 'vaporwave', label: 'Vaporwave', stops: ['#ff5fc4', '#8a6fe0', '#3ca9ff'] },
  { id: 'toxic', label: 'Toxic', stops: ['#0f380f', '#8fd93f', '#e6ff9c'] },
];

export const MIN_GRADIENT_STOPS = 2;
export const MAX_GRADIENT_STOPS = 5;

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function hexToRgbLocal(hex) {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function overlayChannel(base, blend) {
  return base < 128 ? (2 * base * blend) / 255 : 255 - (2 * (255 - base) * (255 - blend)) / 255;
}

function blendPixel(r, g, b, fr, fg, fb, blendMode) {
  if (blendMode === 'multiply') {
    return [(r * fr) / 255, (g * fg) / 255, (b * fb) / 255];
  }
  if (blendMode === 'screen') {
    return [
      255 - ((255 - r) * (255 - fr)) / 255,
      255 - ((255 - g) * (255 - fg)) / 255,
      255 - ((255 - b) * (255 - fb)) / 255,
    ];
  }
  if (blendMode === 'overlay') {
    return [overlayChannel(r, fr), overlayChannel(g, fg), overlayChannel(b, fb)];
  }
  return [fr, fg, fb]; // tint: blend straight toward the filter color
}

function sampleGradient(stopsRgb, t) {
  const n = stopsRgb.length;
  if (n === 0) return [255, 255, 255];
  if (n === 1) return stopsRgb[0];
  const clampedT = t < 0 ? 0 : t > 1 ? 1 : t;
  const scaled = clampedT * (n - 1);
  const i0 = Math.min(n - 2, Math.floor(scaled));
  const i1 = i0 + 1;
  const frac = scaled - i0;
  const c0 = stopsRgb[i0], c1 = stopsRgb[i1];
  return [
    c0[0] + (c1[0] - c0[0]) * frac,
    c0[1] + (c1[1] - c0[1]) * frac,
    c0[2] + (c1[2] - c0[2]) * frac,
  ];
}

export function applyColorFilter(imageData, config) {
  if (!config.enabled || config.amount <= 0) return imageData;
  const { data, width, height } = imageData;
  const t = config.amount / 100;

  if (config.type === 'gradient' && config.gradientStops && config.gradientStops.length >= 2) {
    const stopsRgb = config.gradientStops.map(hexToRgbLocal);
    const angleRad = ((config.gradientAngle || 0) * Math.PI) / 180;
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);
    const luminanceMapped = config.gradientType === 'luminance';

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        let gt;
        if (luminanceMapped) {
          gt = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        } else {
          const nx = width > 1 ? x / (width - 1) - 0.5 : 0;
          const ny = height > 1 ? y / (height - 1) - 0.5 : 0;
          gt = nx * dirX + ny * dirY + 0.5;
        }
        const [fr, fg, fb] = sampleGradient(stopsRgb, gt);
        const [nr, ng, nb] = blendPixel(r, g, b, fr, fg, fb, config.blendMode);
        data[i] = clamp(r + (nr - r) * t);
        data[i + 1] = clamp(g + (ng - g) * t);
        data[i + 2] = clamp(b + (nb - b) * t);
      }
    }
    return imageData;
  }

  const [fr, fg, fb] = hexToRgbLocal(config.color);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const [nr, ng, nb] = blendPixel(r, g, b, fr, fg, fb, config.blendMode);
    data[i] = clamp(r + (nr - r) * t);
    data[i + 1] = clamp(g + (ng - g) * t);
    data[i + 2] = clamp(b + (nb - b) * t);
  }
  return imageData;
}
