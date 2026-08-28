// A camera-style color filter: tints the final composited image the way a
// colored glass filter over a lens would, without touching the dithering
// palette itself. Applied as the very last compositing step, after overlays,
// so it grades the whole shot the way a real lens filter affects everything
// entering the lens.

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

export function applyColorFilter(imageData, config) {
  if (!config.enabled || config.amount <= 0) return imageData;
  const { data } = imageData;
  const [fr, fg, fb] = hexToRgbLocal(config.color);
  const t = config.amount / 100;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    let nr, ng, nb;

    if (config.blendMode === 'multiply') {
      nr = (r * fr) / 255; ng = (g * fg) / 255; nb = (b * fb) / 255;
    } else if (config.blendMode === 'screen') {
      nr = 255 - ((255 - r) * (255 - fr)) / 255;
      ng = 255 - ((255 - g) * (255 - fg)) / 255;
      nb = 255 - ((255 - b) * (255 - fb)) / 255;
    } else if (config.blendMode === 'overlay') {
      nr = overlayChannel(r, fr); ng = overlayChannel(g, fg); nb = overlayChannel(b, fb);
    } else {
      nr = fr; ng = fg; nb = fb; // tint: blend straight toward the filter color
    }

    data[i] = clamp(r + (nr - r) * t);
    data[i + 1] = clamp(g + (ng - g) * t);
    data[i + 2] = clamp(b + (nb - b) * t);
  }
  return imageData;
}
