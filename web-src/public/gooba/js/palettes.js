export function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

export const PRESET_PALETTES = {
  gameboy: {
    label: 'Game Boy',
    colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  },
  pocket: {
    label: 'Game Boy Pocket',
    colors: ['#000000', '#545454', '#a9a9a9', '#ffffff'],
  },
  cgaCyan: {
    label: 'CGA (Cyan/Magenta)',
    colors: ['#000000', '#55ffff', '#ff55ff', '#ffffff'],
  },
  cgaGreen: {
    label: 'CGA (Green/Red)',
    colors: ['#000000', '#55ff55', '#ff5555', '#ffff55'],
  },
  c64: {
    label: 'Commodore 64',
    colors: [
      '#000000', '#ffffff', '#68372b', '#70a4b2',
      '#6f3d86', '#588d43', '#352879', '#b8c76f',
      '#6f4f25', '#433900', '#9a6759', '#444444',
      '#6c6c6c', '#9ad284', '#6c5eb5', '#959595',
    ],
  },
  sepia: {
    label: 'Sepia Duotone',
    colors: ['#2b1b0e', '#d9c7a3'],
  },
  bw: {
    label: 'Black & White',
    colors: ['#000000', '#ffffff'],
  },
};

export function paletteToRgb(hexColors) {
  return hexColors.map(hexToRgb);
}

export function nearestColorIndex(r, g, b, palette) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i];
    const dr = r - pr, dg = g - pg, db = b - pb;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}
