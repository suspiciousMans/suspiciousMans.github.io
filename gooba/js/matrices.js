// Threshold matrices for ordered-style dithering: classic Bayer, clustered-dot
// halftone, and a couple of line/pattern dithers. Each generator returns
// { size, data } where data is a Float32Array of size*size values in [0,1),
// each position occupied exactly once (a valid dither threshold permutation).

function bayerMatrix(n) {
  if (n === 1) return { size: 1, data: new Float32Array([0]) };

  const half = bayerMatrix(n / 2);
  const size = n;
  const data = new Float32Array(size * size);
  const h = half.size;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < h; x++) {
      const base = half.data[y * h + x] * 4;
      data[y * size + x] = base;
      data[y * size + (x + h)] = base + 2;
      data[(y + h) * size + x] = base + 3;
      data[(y + h) * size + (x + h)] = base + 1;
    }
  }

  const total = size * size;
  for (let i = 0; i < total; i++) data[i] = data[i] / total;

  return { size, data };
}

function halftoneMatrix(n) {
  const cx = (n - 1) / 2;
  const cy = (n - 1) / 2;
  const positions = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x - cx, dy = y - cy;
      positions.push({ x, y, d: dx * dx + dy * dy });
    }
  }
  positions.sort((a, b) => a.d - b.d);
  const data = new Float32Array(n * n);
  positions.forEach((p, i) => { data[p.y * n + p.x] = i / (n * n); });
  return { size: n, data };
}

function diagonalMatrix(n) {
  const data = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      data[y * n + x] = ((x + y) % n) / n;
    }
  }
  return { size: n, data };
}

function crossHatchMatrix(n) {
  const data = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v1 = (x + y) % n;
      const v2 = (x - y + n) % n;
      data[y * n + x] = Math.min(v1, v2) / n;
    }
  }
  return { size: n, data };
}

const GENERATORS = {
  bayer: bayerMatrix,
  halftone: halftoneMatrix,
  diagonal: diagonalMatrix,
  crosshatch: crossHatchMatrix,
};

const cache = new Map();
export function getMatrix(type, n) {
  const key = `${type}:${n}`;
  if (!cache.has(key)) {
    const gen = GENERATORS[type] || GENERATORS.bayer;
    cache.set(key, gen(n));
  }
  return cache.get(key);
}
