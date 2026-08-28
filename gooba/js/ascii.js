// ASCII art rendering: maps each cell's average brightness to a character
// from a density ramp (sparse -> dense) and draws it with the canvas 2D
// text API, instead of dithering pixels directly. Runs as an alternate
// path in the main pipeline — everything downstream (effects, overlays,
// color filter) still applies on top of the rendered glyphs.

export const ASCII_RAMPS = [
  { id: 'classic', label: 'Classic', chars: ' .:-=+*#%@' },
  { id: 'blocks', label: 'Blocks', chars: ' ░▒▓█' },
  { id: 'binary', label: 'Binary', chars: ' .01' },
  { id: 'dense', label: 'Dense', chars: ' .,-~:;=!*#$@' },
];

export const ASCII_COLOR_MODES = [
  { id: 'green', label: 'Terminal Green', color: '#33ff66' },
  { id: 'amber', label: 'Amber', color: '#ffb000' },
  { id: 'white', label: 'White', color: '#e6e6e6' },
  { id: 'custom', label: 'Custom' },
  { id: 'source', label: 'Source Colors' },
];

// options: { cellSize, chars, colorMode, customColor, invert }
export function renderAsciiArt(imageData, canvas, ctx, options) {
  const { cellSize, chars, colorMode, customColor, invert } = options;
  const { data, width, height } = imageData;

  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.font = `${cellSize}px monospace`;
  ctx.textBaseline = 'top';

  const modeColor = colorMode === 'custom' ? customColor
    : (ASCII_COLOR_MODES.find((m) => m.id === colorMode) || {}).color || '#e6e6e6';

  for (let y0 = 0; y0 < height; y0 += cellSize) {
    const y1 = Math.min(height, y0 + cellSize);
    for (let x0 = 0; x0 < width; x0 += cellSize) {
      const x1 = Math.min(width, x0 + cellSize);
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
          count++;
        }
      }
      if (count === 0) continue;
      const r = rSum / count, g = gSum / count, b = bSum / count;
      let lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (invert) lum = 1 - lum;

      const charIdx = Math.min(chars.length - 1, Math.floor(lum * chars.length));
      const ch = chars[charIdx];
      if (ch === ' ') continue;

      ctx.fillStyle = colorMode === 'source' ? `rgb(${r | 0}, ${g | 0}, ${b | 0})` : modeColor;
      ctx.fillText(ch, x0, y0);
    }
  }

  return ctx.getImageData(0, 0, width, height);
}
