// Dependency-free animated GIF decoder + encoder (GIF89a, LZW).
// Frames are plain {width, height, data: Uint8ClampedArray(RGBA)} objects —
// interchangeable with the DOM's ImageData so this module works the same
// in a browser or a plain Node test harness.

import { medianCutPalette } from './quantize.js';
import { nearestColorIndex } from './palettes.js';

// ---------- bit-level readers/writers (GIF packs LSB-first) ----------

class BitReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.pos = 0; // bit position
  }
  readBits(n) {
    let value = 0;
    for (let i = 0; i < n; i++) {
      const byteIndex = this.pos >> 3;
      const bitIndex = this.pos & 7;
      const bit = byteIndex < this.bytes.length ? (this.bytes[byteIndex] >> bitIndex) & 1 : 0;
      value |= bit << i;
      this.pos++;
    }
    return value;
  }
}

class BitWriter {
  constructor() {
    this.bytes = [];
    this.bitBuf = 0;
    this.bitCount = 0;
  }
  writeBits(value, n) {
    this.bitBuf |= value << this.bitCount;
    this.bitCount += n;
    while (this.bitCount >= 8) {
      this.bytes.push(this.bitBuf & 0xff);
      this.bitBuf >>= 8;
      this.bitCount -= 8;
    }
  }
  flush() {
    if (this.bitCount > 0) {
      this.bytes.push(this.bitBuf & 0xff);
      this.bitBuf = 0;
      this.bitCount = 0;
    }
  }
}

// ---------- LZW (GIF variant) ----------

function lzwDecode(indexStream, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const reader = new BitReader(indexStream);
  const out = [];

  let codeSize, dict, prev;
  const resetDict = () => {
    codeSize = minCodeSize + 1;
    dict = [];
    for (let i = 0; i < clearCode; i++) dict.push([i]);
    dict.push(null); // clear
    dict.push(null); // end
    prev = null;
  };
  resetDict();

  const totalBits = indexStream.length * 8;
  while (reader.pos + codeSize <= totalBits) {
    const code = reader.readBits(codeSize);
    if (code === clearCode) {
      resetDict();
      continue;
    }
    if (code === endCode) break;

    let entry;
    if (code < dict.length && dict[code]) {
      entry = dict[code];
    } else if (code === dict.length && prev) {
      entry = prev.concat([prev[0]]);
    } else {
      break; // corrupt stream
    }

    for (const idx of entry) out.push(idx);

    if (prev) {
      dict.push(prev.concat([entry[0]]));
      if (dict.length === (1 << codeSize) && codeSize < 12) codeSize++;
    }
    prev = entry;
  }

  return out;
}

function lzwEncode(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const writer = new BitWriter();

  let codeSize, dict;
  const resetDict = () => {
    codeSize = minCodeSize + 1;
    dict = new Map();
    for (let i = 0; i < clearCode; i++) dict.set(String(i), i);
    return clearCode + 2;
  };
  let nextCode = resetDict();
  writer.writeBits(clearCode, codeSize);

  let w = '';
  for (let i = 0; i < indices.length; i++) {
    const k = indices[i];
    const wk = w === '' ? String(k) : `${w},${k}`;
    if (dict.has(wk)) {
      w = wk;
    } else {
      writer.writeBits(dict.get(w), codeSize);
      dict.set(wk, nextCode);
      nextCode++;
      if (nextCode > (1 << codeSize)) {
        if (codeSize < 12) {
          codeSize++;
        } else {
          writer.writeBits(clearCode, codeSize);
          nextCode = resetDict();
        }
      }
      w = String(k);
    }
  }
  if (w !== '') writer.writeBits(dict.get(w), codeSize);
  writer.writeBits(endCode, codeSize);
  writer.flush();
  return new Uint8Array(writer.bytes);
}

// ---------- decoder ----------

function readSubBlocks(bytes, pos) {
  const chunks = [];
  let total = 0;
  while (true) {
    const size = bytes[pos++];
    if (!size) break;
    chunks.push(bytes.subarray(pos, pos + size));
    total += size;
    pos += size;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return { data: out, pos };
}

function deinterlace(rows, width, height) {
  const out = new Array(height);
  const passes = [
    { start: 0, step: 8 }, { start: 4, step: 8 },
    { start: 2, step: 4 }, { start: 1, step: 2 },
  ];
  let src = 0;
  for (const pass of passes) {
    for (let y = pass.start; y < height; y += pass.step) {
      out[y] = rows[src++];
    }
  }
  return out;
}

export function decodeGIF(buffer) {
  const bytes = new Uint8Array(buffer);
  let pos = 6; // skip "GIF8Xa"

  const screenWidth = bytes[pos] | (bytes[pos + 1] << 8); pos += 2;
  const screenHeight = bytes[pos] | (bytes[pos + 1] << 8); pos += 2;
  const packed = bytes[pos++];
  const gctFlag = (packed & 0x80) !== 0;
  const gctSize = 2 << (packed & 0x07);
  pos += 2; // background color index, pixel aspect ratio

  let globalColorTable = null;
  if (gctFlag) {
    globalColorTable = [];
    for (let i = 0; i < gctSize; i++) {
      globalColorTable.push([bytes[pos], bytes[pos + 1], bytes[pos + 2]]);
      pos += 3;
    }
  }

  const frames = [];
  let loopCount = 0;
  let gceDelay = 10;
  let gceTransparentIndex = -1;
  let gceDisposal = 0;

  const canvas = new Uint8ClampedArray(screenWidth * screenHeight * 4);
  let prevCanvasSnapshot = null;
  let prevDirtyRect = null;

  while (pos < bytes.length) {
    const introducer = bytes[pos++];
    if (introducer === 0x3b) break; // trailer

    if (introducer === 0x21) {
      const label = bytes[pos++];
      if (label === 0xf9) {
        pos++; // block size (4)
        const flags = bytes[pos++];
        gceDisposal = (flags >> 2) & 0x07;
        const transparentFlag = (flags & 0x01) !== 0;
        gceDelay = bytes[pos] | (bytes[pos + 1] << 8); pos += 2;
        gceTransparentIndex = transparentFlag ? bytes[pos] : -1;
        pos++;
        pos++; // terminator
      } else if (label === 0xff) {
        pos++; // block size (11)
        const appId = String.fromCharCode(...bytes.subarray(pos, pos + 11));
        pos += 11;
        const sub = readSubBlocks(bytes, pos);
        pos = sub.pos;
        if (appId.startsWith('NETSCAPE') && sub.data.length >= 3) {
          loopCount = sub.data[1] | (sub.data[2] << 8);
        }
      } else {
        const sub = readSubBlocks(bytes, pos);
        pos = sub.pos;
      }
      continue;
    }

    if (introducer === 0x2c) {
      const left = bytes[pos] | (bytes[pos + 1] << 8); pos += 2;
      const top = bytes[pos] | (bytes[pos + 1] << 8); pos += 2;
      const imgWidth = bytes[pos] | (bytes[pos + 1] << 8); pos += 2;
      const imgHeight = bytes[pos] | (bytes[pos + 1] << 8); pos += 2;
      const imgPacked = bytes[pos++];
      const lctFlag = (imgPacked & 0x80) !== 0;
      const interlaced = (imgPacked & 0x40) !== 0;
      const lctSize = 2 << (imgPacked & 0x07);

      let colorTable = globalColorTable;
      if (lctFlag) {
        colorTable = [];
        for (let i = 0; i < lctSize; i++) {
          colorTable.push([bytes[pos], bytes[pos + 1], bytes[pos + 2]]);
          pos += 3;
        }
      }

      const minCodeSize = bytes[pos++];
      const sub = readSubBlocks(bytes, pos);
      pos = sub.pos;

      const indices = lzwDecode(sub.data, minCodeSize);

      // snapshot for "restore to previous" disposal, before drawing this frame
      if (gceDisposal === 3) {
        prevCanvasSnapshot = canvas.slice();
        prevDirtyRect = { left, top, width: imgWidth, height: imgHeight };
      }

      let rowOrder = null;
      if (interlaced) {
        const rows = [];
        for (let y = 0; y < imgHeight; y++) rows.push(indices.slice(y * imgWidth, y * imgWidth + imgWidth));
        rowOrder = deinterlace(rows, imgWidth, imgHeight);
      }

      for (let y = 0; y < imgHeight; y++) {
        const rowIndices = interlaced ? rowOrder[y] : indices.slice(y * imgWidth, y * imgWidth + imgWidth);
        const cy = top + y;
        if (cy >= screenHeight) continue;
        for (let x = 0; x < imgWidth; x++) {
          const cx = left + x;
          if (cx >= screenWidth) continue;
          const colorIndex = rowIndices[x];
          if (colorIndex === gceTransparentIndex) continue;
          const color = (colorTable && colorTable[colorIndex]) || [0, 0, 0];
          const ci = (cy * screenWidth + cx) * 4;
          canvas[ci] = color[0];
          canvas[ci + 1] = color[1];
          canvas[ci + 2] = color[2];
          canvas[ci + 3] = 255;
        }
      }

      frames.push({
        imageData: { width: screenWidth, height: screenHeight, data: canvas.slice() },
        delay: Math.max(20, gceDelay * 10),
      });

      if (gceDisposal === 2) {
        for (let y = top; y < top + imgHeight && y < screenHeight; y++) {
          for (let x = left; x < left + imgWidth && x < screenWidth; x++) {
            const ci = (y * screenWidth + x) * 4;
            canvas[ci] = 0; canvas[ci + 1] = 0; canvas[ci + 2] = 0; canvas[ci + 3] = 0;
          }
        }
      } else if (gceDisposal === 3 && prevCanvasSnapshot) {
        canvas.set(prevCanvasSnapshot);
      }

      gceTransparentIndex = -1;
      continue;
    }

    // Unknown block type — bail out safely rather than looping forever.
    break;
  }

  return { width: screenWidth, height: screenHeight, frames, loopCount };
}

// ---------- encoder ----------

export function encodeGIF({ width, height, frames, loopCount = 0, maxColors = 256 }) {
  const sampleFrame = frames[Math.floor(frames.length / 2)].imageData;
  const palette = medianCutPalette(sampleFrame, Math.min(maxColors, 256));
  const paletteSize = Math.max(2, palette.length);

  let bits = 1;
  while ((1 << bits) < paletteSize) bits++;
  const minCodeSize = Math.max(2, bits);
  const gctEntries = 1 << minCodeSize;

  const parts = [];
  const push = (arr) => parts.push(arr instanceof Uint8Array ? arr : new Uint8Array(arr));

  push([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // "GIF89a"
  push([width & 0xff, (width >> 8) & 0xff, height & 0xff, (height >> 8) & 0xff]);
  push([0x80 | (minCodeSize - 1), 0, 0]); // GCT flag, color res, sort=0, size

  const gct = new Uint8Array(gctEntries * 3);
  for (let i = 0; i < gctEntries; i++) {
    const c = palette[i] || [0, 0, 0];
    gct[i * 3] = c[0]; gct[i * 3 + 1] = c[1]; gct[i * 3 + 2] = c[2];
  }
  push(gct);

  // NETSCAPE2.0 looping extension
  push([0x21, 0xff, 0x0b]);
  push('NETSCAPE2.0'.split('').map((c) => c.charCodeAt(0)));
  push([0x03, 0x01, loopCount & 0xff, (loopCount >> 8) & 0xff, 0x00]);

  for (const frame of frames) {
    const { imageData, delay } = frame;
    const delayCs = Math.max(1, Math.round(delay / 10));

    push([0x21, 0xf9, 0x04, 0x00, delayCs & 0xff, (delayCs >> 8) & 0xff, 0x00, 0x00]);
    push([0x2c, 0, 0, 0, 0, width & 0xff, (width >> 8) & 0xff, height & 0xff, (height >> 8) & 0xff, 0x00]);

    const pixelCount = width * height;
    const indices = new Uint8Array(pixelCount);
    const data = imageData.data;
    for (let p = 0; p < pixelCount; p++) {
      const i = p * 4;
      indices[p] = nearestColorIndex(data[i], data[i + 1], data[i + 2], palette);
    }

    push([minCodeSize]);
    const compressed = lzwEncode(indices, minCodeSize);
    for (let i = 0; i < compressed.length; i += 255) {
      const chunk = compressed.subarray(i, Math.min(i + 255, compressed.length));
      push([chunk.length]);
      push(chunk);
    }
    push([0x00]);
  }

  push([0x3b]);

  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}
