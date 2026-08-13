// Simple median-cut color quantizer for extracting an N-color palette from an image.
export function medianCutPalette(imageData, colorCount) {
  const { data, width, height } = imageData;
  const samples = [];
  const step = Math.max(1, Math.floor((width * height) / 4000));

  for (let i = 0; i < width * height; i += step) {
    const idx = i * 4;
    if (data[idx + 3] < 16) continue;
    samples.push([data[idx], data[idx + 1], data[idx + 2]]);
  }

  if (samples.length === 0) return [[0, 0, 0], [255, 255, 255]];

  let buckets = [samples];
  const targetBuckets = Math.max(1, colorCount);

  while (buckets.length < targetBuckets) {
    buckets.sort((a, b) => rangeOf(b) - rangeOf(a));
    const bucket = buckets.shift();
    if (!bucket || bucket.length < 2) {
      if (bucket) buckets.push(bucket);
      break;
    }
    const channel = widestChannel(bucket);
    bucket.sort((a, b) => a[channel] - b[channel]);
    const mid = Math.floor(bucket.length / 2);
    buckets.push(bucket.slice(0, mid), bucket.slice(mid));
  }

  return buckets.map(averageColor);
}

function rangeOf(bucket) {
  const ch = widestChannel(bucket);
  let min = 255, max = 0;
  for (const px of bucket) {
    if (px[ch] < min) min = px[ch];
    if (px[ch] > max) max = px[ch];
  }
  return max - min;
}

function widestChannel(bucket) {
  const mins = [255, 255, 255];
  const maxs = [0, 0, 0];
  for (const px of bucket) {
    for (let c = 0; c < 3; c++) {
      if (px[c] < mins[c]) mins[c] = px[c];
      if (px[c] > maxs[c]) maxs[c] = px[c];
    }
  }
  const ranges = [maxs[0] - mins[0], maxs[1] - mins[1], maxs[2] - mins[2]];
  return ranges.indexOf(Math.max(...ranges));
}

function averageColor(bucket) {
  let r = 0, g = 0, b = 0;
  for (const px of bucket) { r += px[0]; g += px[1]; b += px[2]; }
  const n = bucket.length;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}
