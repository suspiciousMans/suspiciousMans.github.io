// Recursive Bayer (ordered dithering) matrix generator.
// Returns a Float32Array of size n*n with values in [0,1), row-major.
export function bayerMatrix(n) {
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

const cache = new Map();
export function getBayerMatrix(n) {
  if (!cache.has(n)) cache.set(n, bayerMatrix(n));
  return cache.get(n);
}
