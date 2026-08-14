import { getMatrix } from './matrices.js';
import { nearestColorIndex } from './palettes.js';

export const KERNELS = {
  floydSteinberg: [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]],
  atkinson: [[1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8], [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]],
  jarvisJudiceNinke: [
    [1, 0, 7 / 48], [2, 0, 5 / 48],
    [-2, 1, 3 / 48], [-1, 1, 5 / 48], [0, 1, 7 / 48], [1, 1, 5 / 48], [2, 1, 3 / 48],
    [-2, 2, 1 / 48], [-1, 2, 3 / 48], [0, 2, 5 / 48], [1, 2, 3 / 48], [2, 2, 1 / 48],
  ],
  stucki: [
    [1, 0, 8 / 42], [2, 0, 4 / 42],
    [-2, 1, 2 / 42], [-1, 1, 4 / 42], [0, 1, 8 / 42], [1, 1, 4 / 42], [2, 1, 2 / 42],
    [-2, 2, 1 / 42], [-1, 2, 2 / 42], [0, 2, 4 / 42], [1, 2, 2 / 42], [2, 2, 1 / 42],
  ],
  burkes: [
    [1, 0, 8 / 32], [2, 0, 4 / 32],
    [-2, 1, 2 / 32], [-1, 1, 4 / 32], [0, 1, 8 / 32], [1, 1, 4 / 32], [2, 1, 2 / 32],
  ],
  sierraLite: [[1, 0, 2 / 4], [-1, 1, 1 / 4], [0, 1, 1 / 4]],
};

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function quantizeChannel(v, levels) {
  if (levels <= 1) return 0;
  const step = 255 / (levels - 1);
  return clamp(Math.round(Math.round(v / step) * step));
}

function buildQuantizer(mode, palette, levels) {
  if (mode === 'palette') {
    return (r, g, b) => palette[nearestColorIndex(r, g, b, palette)];
  }
  if (mode === 'grayscale') {
    return (r, g, b) => {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const q = quantizeChannel(gray, levels);
      return [q, q, q];
    };
  }
  return (r, g, b) => [quantizeChannel(r, levels), quantizeChannel(g, levels), quantizeChannel(b, levels)];
}

function estimatePaletteStep(palette) {
  return 255 / Math.max(2, palette.length);
}

export function applyDither(imageData, opts) {
  const {
    algorithm = 'floydSteinberg',
    mode = 'levels',
    palette = [[0, 0, 0], [255, 255, 255]],
    levels = 2,
    bayerSize = 4,
    matrixType = 'bayer',
    haltoneCellSize = 6,
    phase = { x: 0, y: 0 },
    amount = 1,
    invert = false,
  } = opts;

  const width = imageData.width;
  const height = imageData.height;
  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);
  const quantize = buildQuantizer(mode, palette, levels);

  if (algorithm === 'none') {
    for (let i = 0; i < src.length; i += 4) {
      let r = src[i], g = src[i + 1], b = src[i + 2];
      if (invert) { r = 255 - r; g = 255 - g; b = 255 - b; }
      const [qr, qg, qb] = quantize(r, g, b);
      out[i] = qr; out[i + 1] = qg; out[i + 2] = qb; out[i + 3] = src[i + 3];
    }
  } else if (algorithm === 'ordered' || algorithm === 'random' || algorithm === 'halftone') {
    const matrix = algorithm === 'halftone'
      ? getMatrix('halftone', haltoneCellSize)
      : getMatrix(matrixType, bayerSize);
    const step = mode === 'palette' ? estimatePaletteStep(palette) : 255 / (Math.max(2, levels) - 1);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        let threshold;
        if (algorithm === 'random') {
          threshold = Math.random() - 0.5;
        } else {
          const my = ((y + phase.y) % matrix.size + matrix.size) % matrix.size;
          const mx = ((x + phase.x) % matrix.size + matrix.size) % matrix.size;
          threshold = matrix.data[my * matrix.size + mx] - 0.5;
        }
        const offset = threshold * step * amount;
        let r = src[i] + offset, g = src[i + 1] + offset, b = src[i + 2] + offset;
        if (invert) { r = 255 - r; g = 255 - g; b = 255 - b; }
        r = clamp(r); g = clamp(g); b = clamp(b);
        const [qr, qg, qb] = quantize(r, g, b);
        out[i] = qr; out[i + 1] = qg; out[i + 2] = qb; out[i + 3] = src[i + 3];
      }
    }
  } else {
    const kernel = KERNELS[algorithm] || KERNELS.floydSteinberg;
    const buf = new Float32Array(src.length);
    for (let i = 0; i < src.length; i += 4) {
      let r = src[i], g = src[i + 1], b = src[i + 2];
      if (invert) { r = 255 - r; g = 255 - g; b = 255 - b; }
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = src[i + 3];
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = clamp(buf[i]), g = clamp(buf[i + 1]), b = clamp(buf[i + 2]);
        const [qr, qg, qb] = quantize(r, g, b);
        out[i] = qr; out[i + 1] = qg; out[i + 2] = qb; out[i + 3] = src[i + 3];
        const er = (r - qr) * amount, eg = (g - qg) * amount, eb = (b - qb) * amount;
        for (const [dx, dy, w] of kernel) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const ni = (ny * width + nx) * 4;
          buf[ni] += er * w;
          buf[ni + 1] += eg * w;
          buf[ni + 2] += eb * w;
        }
      }
    }
  }

  return new ImageData(out, width, height);
}

export function applyAdjustments(imageData, { brightness = 0, contrast = 0 }) {
  if (brightness === 0 && contrast === 0) return imageData;
  const data = imageData.data;
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let v = data[i + c] + brightness;
      v = contrastFactor * (v - 128) + 128;
      data[i + c] = clamp(v);
    }
  }
  return imageData;
}
