import { applyDither, applyAdjustments } from './dither.js';
import { PRESET_PALETTES, paletteToRgb, hexToRgb } from './palettes.js';
import { medianCutPalette } from './quantize.js';
import { EFFECT_DEFS, applyEffects, applyTemporalJitter } from './effects.js';
import {
  OVERLAY_DEFS, applyOverlays,
  CUSTOM_OVERLAY_SHAPES, CUSTOM_OVERLAY_MOTIONS, CUSTOM_OVERLAY_PRESETS, applyCustomOverlays,
} from './overlays.js';
import { FILTER_BLEND_MODES, FILTER_PRESET_COLORS, applyColorFilter } from './colorfilter.js';
import { decodeGIF, encodeGIF } from './gif.js';
import { extractVideoFrames } from './video.js';
import { createZip } from './zip.js';

const $ = (id) => document.getElementById(id);

// ---------- DOM ----------

const dropZone = $('dropZone');
const fileInput = $('fileInput');
const chooseFileBtn = $('chooseFileBtn');
const sampleBtn = $('sampleBtn');
const batchEnterBtn = $('batchEnterBtn');
const changeImageBtn = $('changeImageBtn');
const downloadPngBtn = $('downloadPngBtn');
const downloadGifBtn = $('downloadGifBtn');
const downloadWebmBtn = $('downloadWebmBtn');
const previewCanvas = $('previewCanvas');
const emptyState = $('emptyState');
const stageActions = $('stageActions');
const mediaInfo = $('mediaInfo');
const loadingOverlay = $('loadingOverlay');
const loadingText = $('loadingText');

const playbackBar = $('playbackBar');
const playPauseBtn = $('playPauseBtn');
const frameScrubber = $('frameScrubber');
const frameCounter = $('frameCounter');

const batchPanel = $('batchPanel');
const batchAddBtn = $('batchAddBtn');
const batchFileInput = $('batchFileInput');
const batchDownloadBtn = $('batchDownloadBtn');
const batchExitBtn = $('batchExitBtn');
const batchGrid = $('batchGrid');

const algorithmSelect = $('algorithm');
const matrixTypeField = $('matrixTypeField');
const matrixTypeSelect = $('matrixType');
const bayerField = $('bayerField');
const bayerSizeSelect = $('bayerSize');
const haltoneCellField = $('haltoneCellField');
const haltoneCellSizeSelect = $('haltoneCellSize');
const amountInput = $('amount');
const amountOut = $('amountOut');

const colorModeSelect = $('colorMode');
const levelsField = $('levelsField');
const levelsInput = $('levels');
const levelsOut = $('levelsOut');
const paletteField = $('paletteField');
const presetPaletteSelect = $('presetPalette');
const duotoneField = $('duotoneField');
const duotoneDark = $('duotoneDark');
const duotoneLight = $('duotoneLight');
const autoField = $('autoField');
const autoColorsInput = $('autoColors');
const autoOut = $('autoOut');
const invertCheckbox = $('invert');

const pixelSizeInput = $('pixelSize');
const pixelSizeOut = $('pixelSizeOut');
const brightnessInput = $('brightness');
const brightnessOut = $('brightnessOut');
const contrastInput = $('contrast');
const contrastOut = $('contrastOut');

const colorFilterEnabled = $('colorFilterEnabled');
const colorFilterFields = $('colorFilterFields');
const filterSwatchesEl = $('filterSwatches');
const colorFilterColor = $('colorFilterColor');
const colorFilterBlendMode = $('colorFilterBlendMode');
const colorFilterAmount = $('colorFilterAmount');
const colorFilterAmountOut = $('colorFilterAmountOut');

const resetBtn = $('resetBtn');

const effectsListEl = $('effectsList');
const overlaysListEl = $('overlaysList');
const customOverlaysListEl = $('customOverlaysList');
const customOverlayAddBtns = document.querySelectorAll('[data-custom-overlay-preset]');

const animateStillField = $('animateStillField');
const animateStillCheckbox = $('animateStill');
const temporalDurationField = $('temporalDurationField');
const temporalDurationInput = $('temporalDuration');
const temporalDurationOut = $('temporalDurationOut');
const temporalFpsField = $('temporalFpsField');
const temporalFpsInput = $('temporalFps');
const temporalFpsOut = $('temporalFpsOut');
const temporalJitterField = $('temporalJitterField');
const temporalJitterInput = $('temporalJitter');
const temporalJitterOut = $('temporalJitterOut');

// ---------- canvases ----------

const previewCtx = previewCanvas.getContext('2d');

const mainTarget = {
  rawCanvas: document.createElement('canvas'),
  smallCanvas: document.createElement('canvas'),
};
mainTarget.rawCtx = mainTarget.rawCanvas.getContext('2d');
mainTarget.smallCtx = mainTarget.smallCanvas.getContext('2d', { willReadFrequently: true });

const batchTarget = {
  rawCanvas: document.createElement('canvas'),
  smallCanvas: document.createElement('canvas'),
};
batchTarget.rawCtx = batchTarget.rawCanvas.getContext('2d');
batchTarget.smallCtx = batchTarget.smallCanvas.getContext('2d', { willReadFrequently: true });

// ---------- state ----------

const STILL_MAX_DIMENSION = 1600;
const ANIMATED_MAX_DIMENSION = 480;
const MAX_ANIMATED_FRAMES = 240;

let mediaLoaded = false;
let mediaMode = 'none'; // 'none' | 'image' | 'sequence'
let mediaWidth = 0;
let mediaHeight = 0;
let sourceFrames = []; // [{ imageData, delay }]
let mediaVersion = 0;

let currentFrame = 0;
let playing = false;
let rafId = null;
let lastTickTime = 0;
let accumulated = 0;
let renderScheduled = false;

let autoPaletteCache = { key: null, palette: null };

let batchItems = []; // [{ id, name, imageData }]

Object.entries(PRESET_PALETTES).forEach(([key, palette]) => {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = palette.label;
  presetPaletteSelect.appendChild(opt);
});
presetPaletteSelect.value = 'gameboy';

let effectsStack = EFFECT_DEFS.map((def) => ({ ...def, enabled: false, amount: def.defaultAmount }));
let overlaysStack = OVERLAY_DEFS.map((def) => ({ ...def, enabled: false, amount: def.defaultAmount }));
let customOverlays = [];
let customOverlaySeq = 0;
let colorFilterConfig = { enabled: false, color: FILTER_PRESET_COLORS[0].color, blendMode: 'multiply', amount: 60 };

// ---------- helpers ----------

function clampCurrentFrame() {
  const total = totalFramesCount();
  if (currentFrame >= total) currentFrame = 0;
}

function isAnimated() {
  if (mediaMode === 'sequence') return sourceFrames.length > 1;
  if (mediaMode === 'image') return animateStillCheckbox.checked;
  return false;
}

function totalFramesCount() {
  if (mediaMode === 'sequence') return Math.max(1, sourceFrames.length);
  if (mediaMode === 'image' && animateStillCheckbox.checked) {
    return Math.max(2, Math.round(+temporalDurationInput.value * +temporalFpsInput.value));
  }
  return 1;
}

function getSourceFrameData(index) {
  if (mediaMode === 'sequence') return sourceFrames[index % sourceFrames.length].imageData;
  return sourceFrames[0].imageData;
}

function delayForFrame(index) {
  if (mediaMode === 'sequence') return sourceFrames[index % sourceFrames.length].delay || 100;
  return 1000 / Math.max(1, +temporalFpsInput.value);
}

function capFrameCount(frames, maxCount) {
  if (frames.length <= maxCount) return frames;
  const result = [];
  const step = frames.length / maxCount;
  for (let i = 0; i < maxCount; i++) result.push(frames[Math.floor(i * step)]);
  return result;
}

function mediaRecorderSupported() {
  return typeof MediaRecorder !== 'undefined' && typeof previewCanvas.captureStream === 'function';
}

function triggerDownload(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function showError(msg) {
  loadingText.textContent = msg;
  loadingOverlay.classList.add('error');
  loadingOverlay.hidden = false;
  setTimeout(() => {
    loadingOverlay.hidden = true;
    loadingOverlay.classList.remove('error');
  }, 3500);
}

function showLoading(msg) {
  loadingText.textContent = msg;
  loadingOverlay.classList.remove('error');
  loadingOverlay.hidden = false;
}

function hideLoading() {
  loadingOverlay.hidden = true;
}

// ---------- settings ----------

function getCurrentSettings() {
  return {
    algorithm: algorithmSelect.value,
    matrixType: matrixTypeSelect.value,
    bayerSize: +bayerSizeSelect.value,
    haltoneCellSize: +haltoneCellSizeSelect.value,
    amount: +amountInput.value,
    invert: invertCheckbox.checked,
    colorMode: colorModeSelect.value,
    levels: +levelsInput.value,
    presetPalette: presetPaletteSelect.value,
    duotoneDark: duotoneDark.value,
    duotoneLight: duotoneLight.value,
    autoColors: +autoColorsInput.value,
    pixelSize: Math.max(1, +pixelSizeInput.value),
    brightness: +brightnessInput.value,
    contrast: +contrastInput.value,
    temporalJitter: +temporalJitterInput.value,
  };
}

function resolveAutoPalette(imageDataForPalette, autoColors, useCache, cacheKeyExtra) {
  if (!useCache) return medianCutPalette(imageDataForPalette, autoColors);
  const key = `${mediaVersion}:${autoColors}:${cacheKeyExtra}`;
  if (autoPaletteCache.key !== key) {
    autoPaletteCache = { key, palette: medianCutPalette(imageDataForPalette, autoColors) };
  }
  return autoPaletteCache.palette;
}

// ---------- core pipeline ----------

function runPipeline(rawImageData, target, frameIndex, animated, useAutoPaletteCache) {
  const settings = getCurrentSettings();
  const { rawCanvas, rawCtx, smallCanvas, smallCtx } = target;

  rawCanvas.width = rawImageData.width;
  rawCanvas.height = rawImageData.height;
  rawCtx.putImageData(rawImageData, 0, 0);

  const smallW = Math.max(1, Math.round(rawImageData.width / settings.pixelSize));
  const smallH = Math.max(1, Math.round(rawImageData.height / settings.pixelSize));
  smallCanvas.width = smallW;
  smallCanvas.height = smallH;
  smallCtx.imageSmoothingEnabled = true;
  smallCtx.clearRect(0, 0, smallW, smallH);
  smallCtx.drawImage(rawCanvas, 0, 0, smallW, smallH);

  let imageData = smallCtx.getImageData(0, 0, smallW, smallH);
  imageData = applyAdjustments(imageData, { brightness: settings.brightness, contrast: settings.contrast });

  if (animated && settings.temporalJitter > 0) {
    imageData = applyTemporalJitter(imageData, settings.temporalJitter, frameIndex);
  }

  let ditherMode = 'levels';
  let palette;
  if (settings.colorMode === 'levels') {
    ditherMode = 'levels';
  } else if (settings.colorMode === 'grayscale') {
    ditherMode = 'grayscale';
  } else if (settings.colorMode === 'palette') {
    ditherMode = 'palette';
    palette = paletteToRgb(PRESET_PALETTES[settings.presetPalette].colors);
  } else if (settings.colorMode === 'duotone') {
    ditherMode = 'palette';
    palette = [hexToRgb(settings.duotoneDark), hexToRgb(settings.duotoneLight)];
  } else if (settings.colorMode === 'auto') {
    ditherMode = 'palette';
    palette = resolveAutoPalette(
      imageData,
      settings.autoColors,
      useAutoPaletteCache,
      `${settings.pixelSize}:${settings.brightness}:${settings.contrast}`,
    );
  }

  const phase = animated && (settings.algorithm === 'ordered' || settings.algorithm === 'halftone')
    ? { x: frameIndex, y: 0 }
    : { x: 0, y: 0 };

  let result = applyDither(imageData, {
    algorithm: settings.algorithm,
    mode: ditherMode,
    palette,
    levels: settings.levels,
    bayerSize: settings.bayerSize,
    matrixType: settings.matrixType,
    haltoneCellSize: settings.haltoneCellSize,
    phase,
    amount: settings.amount,
    invert: settings.invert,
  });

  result = applyEffects(result, effectsStack, frameIndex);
  result = applyOverlays(result, overlaysStack, frameIndex);
  result = applyCustomOverlays(result, customOverlays, frameIndex);
  result = applyColorFilter(result, colorFilterConfig);

  smallCtx.putImageData(result, 0, 0);
  return { smallCanvas, smallW, smallH };
}

function composeAndDrawMain(index) {
  const raw = getSourceFrameData(index);
  const animated = isAnimated();
  const { smallCanvas } = runPipeline(raw, mainTarget, index, animated, true);

  previewCanvas.width = mediaWidth;
  previewCanvas.height = mediaHeight;
  previewCtx.imageSmoothingEnabled = false;
  previewCtx.clearRect(0, 0, mediaWidth, mediaHeight);
  previewCtx.drawImage(smallCanvas, 0, 0, mediaWidth, mediaHeight);
}

function renderCurrentFrame() {
  if (!mediaLoaded) return;
  composeAndDrawMain(currentFrame);
  updateFrameCounterText();
}

function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    if (!batchPanel.hidden) {
      renderBatchGrid();
      return;
    }
    if (!mediaLoaded || playing) return;
    renderCurrentFrame();
  });
}

// ---------- playback ----------

function updateFrameCounterText() {
  frameCounter.textContent = `${currentFrame + 1} / ${totalFramesCount()}`;
}

function loop(now) {
  if (!playing) return;
  const dt = now - lastTickTime;
  lastTickTime = now;
  accumulated += dt;
  const delay = delayForFrame(currentFrame);
  if (accumulated >= delay) {
    accumulated = 0;
    currentFrame = (currentFrame + 1) % totalFramesCount();
    frameScrubber.value = String(currentFrame);
  }
  renderCurrentFrame();
  rafId = requestAnimationFrame(loop);
}

function play() {
  if (totalFramesCount() <= 1) return;
  playing = true;
  playPauseBtn.textContent = '⏸';
  lastTickTime = performance.now();
  accumulated = 0;
  rafId = requestAnimationFrame(loop);
}

function pause() {
  playing = false;
  playPauseBtn.textContent = '▶';
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

playPauseBtn.addEventListener('click', () => {
  if (playing) pause();
  else play();
});

frameScrubber.addEventListener('input', () => {
  pause();
  currentFrame = +frameScrubber.value;
  updateFrameCounterText();
  scheduleRender();
});

// ---------- visibility ----------

function updateControlVisibility() {
  matrixTypeField.hidden = algorithmSelect.value !== 'ordered';
  bayerField.hidden = algorithmSelect.value !== 'ordered';
  haltoneCellField.hidden = algorithmSelect.value !== 'halftone';

  const mode = colorModeSelect.value;
  levelsField.hidden = !(mode === 'levels' || mode === 'grayscale');
  paletteField.hidden = mode !== 'palette';
  duotoneField.hidden = mode !== 'duotone';
  autoField.hidden = mode !== 'auto';

  animateStillField.hidden = !(mediaLoaded && mediaMode === 'image');
  const showTemporalControls = mediaLoaded && mediaMode === 'image' && animateStillCheckbox.checked;
  temporalDurationField.hidden = !showTemporalControls;
  temporalFpsField.hidden = !showTemporalControls;
  temporalJitterField.hidden = !(mediaLoaded && isAnimated());
}

function updatePlaybackUI() {
  const animated = isAnimated();
  clampCurrentFrame();
  playbackBar.hidden = !animated;
  if (animated) {
    frameScrubber.max = String(Math.max(1, totalFramesCount() - 1));
    frameScrubber.value = String(currentFrame);
    updateFrameCounterText();
  }
  downloadGifBtn.hidden = !animated;
  downloadWebmBtn.hidden = !animated || !mediaRecorderSupported();
  updateControlVisibility();
}

// ---------- media loading ----------

function setMediaFromFrames(mode, width, height, frames, infoText) {
  mediaMode = mode;
  mediaWidth = width;
  mediaHeight = height;
  sourceFrames = frames;
  mediaVersion++;
  currentFrame = 0;
  accumulated = 0;
  autoPaletteCache = { key: null, palette: null };
  mediaLoaded = true;

  mediaInfo.textContent = infoText;
  emptyState.style.display = 'none';
  previewCanvas.style.display = 'block';
  stageActions.hidden = false;

  updatePlaybackUI();

  if (isAnimated()) play();
  else { pause(); scheduleRender(); }
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, STILL_MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const tmp = document.createElement('canvas');
      tmp.width = w; tmp.height = h;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(img, 0, 0, w, h);
      const imageData = tctx.getImageData(0, 0, w, h);
      URL.revokeObjectURL(url);
      setMediaFromFrames('image', w, h, [{ imageData, delay: 1000 / 12 }], `Image — ${w}×${h}`);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showError('Could not load image');
      reject(new Error('Could not load image'));
    };
    img.src = url;
  });
}

function downscaleFrames(frames, srcW, srcH, maxDim) {
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  if (scale >= 1) return { frames, width: srcW, height: srcH };
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = srcW; srcCanvas.height = srcH;
  const srcCtx = srcCanvas.getContext('2d');
  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = w; dstCanvas.height = h;
  const dstCtx = dstCanvas.getContext('2d');
  const scaledFrames = frames.map((f) => {
    srcCtx.putImageData(f.imageData, 0, 0);
    dstCtx.clearRect(0, 0, w, h);
    dstCtx.drawImage(srcCanvas, 0, 0, w, h);
    return { imageData: dstCtx.getImageData(0, 0, w, h), delay: f.delay };
  });
  return { frames: scaledFrames, width: w, height: h };
}

async function loadGifFile(file) {
  showLoading('Decoding GIF…');
  try {
    const buffer = await file.arrayBuffer();
    const decoded = decodeGIF(buffer);
    if (!decoded.frames.length) throw new Error('No frames found in GIF');
    // decodeGIF returns plain {width,height,data} objects (kept environment-agnostic
    // for Node testability) — the canvas API requires real ImageData instances.
    decoded.frames = decoded.frames.map((f) => ({
      imageData: new ImageData(f.imageData.data, f.imageData.width, f.imageData.height),
      delay: f.delay,
    }));
    const capped = capFrameCount(decoded.frames, MAX_ANIMATED_FRAMES);
    const { frames, width, height } = downscaleFrames(capped, decoded.width, decoded.height, ANIMATED_MAX_DIMENSION);
    hideLoading();
    setMediaFromFrames('sequence', width, height, frames, `GIF — ${frames.length} frames`);
  } catch (err) {
    hideLoading();
    console.error(err);
    showError('Could not decode this GIF');
  }
}

async function loadVideoFile(file) {
  showLoading('Extracting video frames…');
  try {
    const { width, height, frames, fps } = await extractVideoFrames(file, {
      maxFrames: 120,
      targetFps: 12,
      maxDimension: ANIMATED_MAX_DIMENSION,
    });
    hideLoading();
    setMediaFromFrames('sequence', width, height, frames, `Video — ${frames.length} frames @ ${fps.toFixed(1)}fps`);
  } catch (err) {
    hideLoading();
    console.error(err);
    showError('Could not read this video file');
  }
}

function handleFile(file) {
  if (!file) return;
  if (file.type === 'image/gif') { loadGifFile(file); return; }
  if (file.type.startsWith('video/')) { loadVideoFile(file); return; }
  if (file.type.startsWith('image/')) { loadImageFile(file); return; }
  showError('Unsupported file type');
}

function generateSampleImage() {
  const w = 640, h = 480;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2b1055');
  sky.addColorStop(0.55, '#7b5cff');
  sky.addColorStop(1, '#ff6bd6');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.beginPath();
  ctx.fillStyle = '#ffe66d';
  ctx.arc(w * 0.5, h * 0.42, 85, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1c1140';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.72);
  ctx.lineTo(w * 0.22, h * 0.5);
  ctx.lineTo(w * 0.42, h * 0.68);
  ctx.lineTo(w * 0.62, h * 0.46);
  ctx.lineTo(w * 0.82, h * 0.66);
  ctx.lineTo(w, h * 0.56);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    const y = h * 0.74 + i * i * 1.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.74);
    ctx.lineTo(w / 2 + i * 90, h);
    ctx.stroke();
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  setMediaFromFrames('image', w, h, [{ imageData, delay: 1000 / 12 }], `Sample image — ${w}×${h}`);
}

// ---------- upload wiring ----------

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  handleFile(file);
});

chooseFileBtn.addEventListener('click', () => fileInput.click());
changeImageBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
sampleBtn.addEventListener('click', generateSampleImage);

// ---------- export ----------

downloadPngBtn.addEventListener('click', () => {
  previewCanvas.toBlob((blob) => {
    if (blob) triggerDownload(blob, 'gooba-dither.png');
  }, 'image/png');
});

downloadGifBtn.addEventListener('click', async () => {
  if (!mediaLoaded) return;
  const wasPlaying = playing;
  pause();
  downloadGifBtn.disabled = true;
  const originalLabel = downloadGifBtn.textContent;
  try {
    const total = totalFramesCount();
    const frames = [];
    for (let i = 0; i < total; i++) {
      composeAndDrawMain(i);
      frames.push({ imageData: previewCtx.getImageData(0, 0, mediaWidth, mediaHeight), delay: delayForFrame(i) });
      if (i % 5 === 0) {
        downloadGifBtn.textContent = `Encoding ${i + 1}/${total}…`;
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    const bytes = encodeGIF({ width: mediaWidth, height: mediaHeight, frames, loopCount: 0, maxColors: 256 });
    triggerDownload(new Blob([bytes], { type: 'image/gif' }), 'gooba-dither.gif');
  } catch (err) {
    console.error(err);
    showError('GIF export failed');
  } finally {
    downloadGifBtn.disabled = false;
    downloadGifBtn.textContent = originalLabel;
    currentFrame = 0;
    if (wasPlaying) play(); else renderCurrentFrame();
  }
});

downloadWebmBtn.addEventListener('click', async () => {
  if (!mediaLoaded) return;
  if (!mediaRecorderSupported()) {
    showError('WebM export not supported in this browser');
    return;
  }
  const wasPlaying = playing;
  pause();
  downloadWebmBtn.disabled = true;
  const originalLabel = downloadWebmBtn.textContent;
  downloadWebmBtn.textContent = 'Recording…';
  try {
    const total = totalFramesCount();
    let sumDelay = 0;
    for (let i = 0; i < total; i++) sumDelay += delayForFrame(i);
    const fps = Math.min(30, Math.max(4, Math.round(1000 / (sumDelay / total))));

    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find((t) => MediaRecorder.isTypeSupported(t)) || '';
    const stream = previewCanvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((resolve) => { recorder.onstop = resolve; });

    recorder.start();
    for (let i = 0; i < total; i++) {
      currentFrame = i;
      composeAndDrawMain(i);
      await new Promise((r) => setTimeout(r, delayForFrame(i)));
    }
    await new Promise((r) => setTimeout(r, 150));
    recorder.stop();
    await stopped;

    triggerDownload(new Blob(chunks, { type: (mimeType || 'video/webm').split(';')[0] }), 'gooba-dither.webm');
  } catch (err) {
    console.error(err);
    showError('WebM export failed');
  } finally {
    downloadWebmBtn.disabled = false;
    downloadWebmBtn.textContent = originalLabel;
    currentFrame = 0;
    if (wasPlaying) play(); else renderCurrentFrame();
  }
});

// ---------- effects UI ----------

function renderStackList(stack, containerEl, onReorder) {
  containerEl.innerHTML = '';
  stack.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'effect-row';

    const head = document.createElement('div');
    head.className = 'effect-row-head';

    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.enabled;
    checkbox.addEventListener('change', () => {
      item.enabled = checkbox.checked;
      scheduleRender();
    });
    const span = document.createElement('span');
    span.textContent = item.label;
    label.append(checkbox, span);

    const reorder = document.createElement('div');
    reorder.className = 'effect-reorder';
    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.textContent = '↑';
    upBtn.disabled = idx === 0;
    upBtn.addEventListener('click', () => {
      [stack[idx - 1], stack[idx]] = [stack[idx], stack[idx - 1]];
      onReorder();
      scheduleRender();
    });
    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.textContent = '↓';
    downBtn.disabled = idx === stack.length - 1;
    downBtn.addEventListener('click', () => {
      [stack[idx + 1], stack[idx]] = [stack[idx], stack[idx + 1]];
      onReorder();
      scheduleRender();
    });
    reorder.append(upBtn, downBtn);

    head.append(label, reorder);

    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '100';
    range.step = '1';
    range.value = String(item.amount);
    range.addEventListener('input', () => {
      item.amount = +range.value;
      scheduleRender();
    });

    li.append(head, range);
    containerEl.appendChild(li);
  });
}

function renderEffectsList() {
  renderStackList(effectsStack, effectsListEl, renderEffectsList);
}

function renderOverlaysList() {
  renderStackList(overlaysStack, overlaysListEl, renderOverlaysList);
}

// ---------- custom overlay builder ----------

function addCustomOverlay(presetKey) {
  const preset = CUSTOM_OVERLAY_PRESETS[presetKey] || CUSTOM_OVERLAY_PRESETS.blank;
  customOverlaySeq++;
  customOverlays.push({
    ...preset,
    id: `custom-${Date.now()}-${customOverlaySeq}`,
    enabled: true,
    seed: Math.floor(Math.random() * 1e6) + customOverlaySeq,
  });
  renderCustomOverlaysList();
  scheduleRender();
}

function createCustomOverlayCard(config, idx, total) {
  const li = document.createElement('li');
  li.className = 'custom-overlay-card';

  const head = document.createElement('div');
  head.className = 'card-head';

  const enableCheckbox = document.createElement('input');
  enableCheckbox.type = 'checkbox';
  enableCheckbox.checked = config.enabled;
  enableCheckbox.addEventListener('change', () => {
    config.enabled = enableCheckbox.checked;
    scheduleRender();
  });

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'card-name';
  nameInput.value = config.name;
  nameInput.maxLength = 24;
  nameInput.addEventListener('input', () => { config.name = nameInput.value; });

  const reorder = document.createElement('div');
  reorder.className = 'effect-reorder';
  const upBtn = document.createElement('button');
  upBtn.type = 'button';
  upBtn.textContent = '↑';
  upBtn.disabled = idx === 0;
  upBtn.addEventListener('click', () => {
    [customOverlays[idx - 1], customOverlays[idx]] = [customOverlays[idx], customOverlays[idx - 1]];
    renderCustomOverlaysList();
    scheduleRender();
  });
  const downBtn = document.createElement('button');
  downBtn.type = 'button';
  downBtn.textContent = '↓';
  downBtn.disabled = idx === total - 1;
  downBtn.addEventListener('click', () => {
    [customOverlays[idx + 1], customOverlays[idx]] = [customOverlays[idx], customOverlays[idx + 1]];
    renderCustomOverlaysList();
    scheduleRender();
  });
  reorder.append(upBtn, downBtn);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'card-remove';
  removeBtn.textContent = '✕';
  removeBtn.setAttribute('aria-label', 'Remove overlay');
  removeBtn.addEventListener('click', () => {
    customOverlays = customOverlays.filter((c) => c.id !== config.id);
    renderCustomOverlaysList();
    scheduleRender();
  });

  head.append(enableCheckbox, nameInput, reorder, removeBtn);

  const body = document.createElement('div');
  body.className = 'card-body';

  const shapeField = document.createElement('label');
  shapeField.className = 'card-field';
  const shapeSpan = document.createElement('span');
  shapeSpan.textContent = 'Shape';
  const shapeSelect = document.createElement('select');
  CUSTOM_OVERLAY_SHAPES.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s[0].toUpperCase() + s.slice(1);
    if (s === config.shape) opt.selected = true;
    shapeSelect.appendChild(opt);
  });
  shapeSelect.addEventListener('change', () => { config.shape = shapeSelect.value; scheduleRender(); });
  shapeField.append(shapeSpan, shapeSelect);

  const colorField = document.createElement('label');
  colorField.className = 'card-field';
  const colorSpan = document.createElement('span');
  colorSpan.textContent = 'Color';
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = config.color;
  colorInput.addEventListener('input', () => { config.color = colorInput.value; scheduleRender(); });
  colorField.append(colorSpan, colorInput);

  const motionField = document.createElement('label');
  motionField.className = 'card-field';
  const motionSpan = document.createElement('span');
  motionSpan.textContent = 'Motion';
  const motionSelect = document.createElement('select');
  CUSTOM_OVERLAY_MOTIONS.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.label;
    if (m.id === config.motion) opt.selected = true;
    motionSelect.appendChild(opt);
  });
  motionSelect.addEventListener('change', () => { config.motion = motionSelect.value; scheduleRender(); });
  motionField.append(motionSpan, motionSelect);

  function rangeField(label, key, min, max, step, formatter) {
    const field = document.createElement('label');
    field.className = 'card-field';
    const span = document.createElement('span');
    const out = document.createElement('output');
    out.textContent = formatter ? formatter(config[key]) : config[key];
    span.append(`${label} `, out);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(config[key]);
    input.addEventListener('input', () => {
      config[key] = +input.value;
      out.textContent = formatter ? formatter(config[key]) : config[key];
      scheduleRender();
    });
    field.append(span, input);
    return field;
  }

  const speedField = rangeField('Speed', 'speed', 0, 100, 1);
  const countField = rangeField('Count', 'count', 1, 60, 1);
  const sizeField = rangeField('Size', 'size', 1, 12, 1);

  const glowField = document.createElement('label');
  glowField.className = 'card-field checkbox-field';
  const glowSpan = document.createElement('span');
  glowSpan.textContent = 'Glow';
  const glowCheckbox = document.createElement('input');
  glowCheckbox.type = 'checkbox';
  glowCheckbox.checked = config.glow;
  glowField.append(glowSpan, glowCheckbox);

  const glowAmountField = rangeField('Glow amount', 'glowAmount', 0, 100, 1);
  glowAmountField.hidden = !config.glow;
  glowCheckbox.addEventListener('change', () => {
    config.glow = glowCheckbox.checked;
    glowAmountField.hidden = !config.glow;
    scheduleRender();
  });

  body.append(shapeField, colorField, motionField, speedField, countField, sizeField, glowField, glowAmountField);
  li.append(head, body);
  return li;
}

function renderCustomOverlaysList() {
  customOverlaysListEl.innerHTML = '';
  customOverlays.forEach((config, idx) => {
    customOverlaysListEl.appendChild(createCustomOverlayCard(config, idx, customOverlays.length));
  });
}

customOverlayAddBtns.forEach((btn) => {
  btn.addEventListener('click', () => addCustomOverlay(btn.dataset.customOverlayPreset));
});

// ---------- batch mode ----------

function loadImageAsData(file, maxDim) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const cctx = c.getContext('2d');
      cctx.drawImage(img, 0, 0, w, h);
      const data = cctx.getImageData(0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not load ${file.name}`));
    };
    img.src = url;
  });
}

async function addBatchFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const imageData = await loadImageAsData(file, 900);
      batchItems.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name, imageData });
    } catch (err) {
      console.error(err);
    }
  }
  renderBatchGrid();
}

function processBatchItem(item, thumbCanvas) {
  const { smallCanvas } = runPipeline(item.imageData, batchTarget, 0, false, false);
  thumbCanvas.width = item.imageData.width;
  thumbCanvas.height = item.imageData.height;
  const tctx = thumbCanvas.getContext('2d');
  tctx.imageSmoothingEnabled = false;
  tctx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height);
  tctx.drawImage(smallCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
}

function renderBatchGrid() {
  batchGrid.innerHTML = '';
  if (batchItems.length === 0) {
    const p = document.createElement('p');
    p.className = 'batch-empty';
    p.textContent = 'No images yet — click "Add images" to select several files at once. The current settings apply to all of them.';
    batchGrid.appendChild(p);
    batchDownloadBtn.disabled = true;
    return;
  }
  batchDownloadBtn.disabled = false;
  for (const item of batchItems) {
    const wrap = document.createElement('div');
    wrap.className = 'batch-item';
    wrap.dataset.id = item.id;

    const canvas = document.createElement('canvas');
    processBatchItem(item, canvas);

    const nameEl = document.createElement('div');
    nameEl.className = 'batch-name';
    nameEl.textContent = item.name;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'batch-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      batchItems = batchItems.filter((x) => x.id !== item.id);
      renderBatchGrid();
    });

    wrap.append(canvas, nameEl, removeBtn);
    batchGrid.appendChild(wrap);
  }
}

function enterBatchMode() {
  pause();
  dropZone.style.display = 'none';
  playbackBar.hidden = true;
  stageActions.hidden = true;
  batchPanel.hidden = false;
  renderBatchGrid();
}

function exitBatchMode() {
  batchPanel.hidden = true;
  dropZone.style.display = 'flex';
  if (mediaLoaded) {
    stageActions.hidden = false;
    updatePlaybackUI();
    scheduleRender();
  }
}

batchEnterBtn.addEventListener('click', enterBatchMode);
batchExitBtn.addEventListener('click', exitBatchMode);
batchAddBtn.addEventListener('click', () => batchFileInput.click());
batchFileInput.addEventListener('change', () => {
  addBatchFiles(Array.from(batchFileInput.files));
  batchFileInput.value = '';
});

batchDownloadBtn.addEventListener('click', async () => {
  if (batchItems.length === 0) return;
  batchDownloadBtn.disabled = true;
  const originalLabel = batchDownloadBtn.textContent;
  batchDownloadBtn.textContent = 'Zipping…';
  try {
    const files = [];
    for (const item of batchItems) {
      const canvas = batchGrid.querySelector(`[data-id="${item.id}"] canvas`);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const buf = new Uint8Array(await blob.arrayBuffer());
      const safeName = (item.name.replace(/\.[^./]+$/, '') || 'image').replace(/[^a-z0-9_-]+/gi, '_');
      files.push({ name: `${safeName}-gooba.png`, data: buf });
    }
    const zipBytes = createZip(files);
    triggerDownload(new Blob([zipBytes], { type: 'application/zip' }), 'gooba-batch.zip');
  } finally {
    batchDownloadBtn.disabled = false;
    batchDownloadBtn.textContent = originalLabel;
  }
});

// ---------- control wiring ----------

function bindRange(input, output, extra) {
  const update = () => {
    if (output) output.textContent = input.step && +input.step < 1 ? (+input.value).toFixed(2) : input.value;
    if (extra) extra();
    scheduleRender();
  };
  input.addEventListener('input', update);
  update();
}

algorithmSelect.addEventListener('change', () => { updateControlVisibility(); scheduleRender(); });
matrixTypeSelect.addEventListener('change', scheduleRender);
bayerSizeSelect.addEventListener('change', scheduleRender);
haltoneCellSizeSelect.addEventListener('change', scheduleRender);
colorModeSelect.addEventListener('change', () => { updateControlVisibility(); scheduleRender(); });
presetPaletteSelect.addEventListener('change', scheduleRender);
duotoneDark.addEventListener('input', scheduleRender);
duotoneLight.addEventListener('input', scheduleRender);
invertCheckbox.addEventListener('change', scheduleRender);

bindRange(amountInput, amountOut);
bindRange(levelsInput, levelsOut);
bindRange(autoColorsInput, autoOut);
bindRange(pixelSizeInput, pixelSizeOut);
bindRange(brightnessInput, brightnessOut);
bindRange(contrastInput, contrastOut);

function renderFilterSwatches() {
  filterSwatchesEl.innerHTML = '';
  FILTER_PRESET_COLORS.forEach((preset) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-swatch';
    btn.style.background = preset.color;
    btn.title = preset.label;
    btn.setAttribute('aria-label', preset.label);
    if (preset.color.toLowerCase() === colorFilterConfig.color.toLowerCase()) btn.classList.add('active');
    btn.addEventListener('click', () => {
      colorFilterConfig.color = preset.color;
      colorFilterColor.value = preset.color;
      renderFilterSwatches();
      scheduleRender();
    });
    filterSwatchesEl.appendChild(btn);
  });
}

FILTER_BLEND_MODES.forEach((mode) => {
  const opt = document.createElement('option');
  opt.value = mode.id;
  opt.textContent = mode.label;
  if (mode.id === colorFilterConfig.blendMode) opt.selected = true;
  colorFilterBlendMode.appendChild(opt);
});

renderFilterSwatches();

colorFilterEnabled.addEventListener('change', () => {
  colorFilterConfig.enabled = colorFilterEnabled.checked;
  colorFilterFields.hidden = !colorFilterConfig.enabled;
  scheduleRender();
});
colorFilterColor.addEventListener('input', () => {
  colorFilterConfig.color = colorFilterColor.value;
  renderFilterSwatches();
  scheduleRender();
});
colorFilterBlendMode.addEventListener('change', () => {
  colorFilterConfig.blendMode = colorFilterBlendMode.value;
  scheduleRender();
});
bindRange(colorFilterAmount, colorFilterAmountOut, () => { colorFilterConfig.amount = +colorFilterAmount.value; });

animateStillCheckbox.addEventListener('change', () => {
  updateControlVisibility();
  updatePlaybackUI();
  currentFrame = 0;
  if (isAnimated()) play();
  else { pause(); scheduleRender(); }
});

bindRange(temporalDurationInput, temporalDurationOut, updatePlaybackUI);
bindRange(temporalFpsInput, temporalFpsOut, updatePlaybackUI);
bindRange(temporalJitterInput, temporalJitterOut);

// ---------- reset ----------

const DEFAULTS = {
  algorithm: 'floydSteinberg',
  matrixType: 'bayer',
  bayerSize: '4',
  haltoneCellSize: '6',
  amount: '1',
  colorMode: 'levels',
  levels: '4',
  presetPalette: 'gameboy',
  duotoneDark: '#0f380f',
  duotoneLight: '#9bbc0f',
  autoColors: '6',
  invert: false,
  pixelSize: '4',
  brightness: '0',
  contrast: '0',
  animateStill: false,
  temporalDuration: '2',
  temporalFps: '12',
  temporalJitter: '20',
  colorFilterEnabled: false,
  colorFilterColor: FILTER_PRESET_COLORS[0].color,
  colorFilterBlendMode: 'multiply',
  colorFilterAmount: '60',
};

resetBtn.addEventListener('click', () => {
  algorithmSelect.value = DEFAULTS.algorithm;
  matrixTypeSelect.value = DEFAULTS.matrixType;
  bayerSizeSelect.value = DEFAULTS.bayerSize;
  haltoneCellSizeSelect.value = DEFAULTS.haltoneCellSize;
  amountInput.value = DEFAULTS.amount;
  colorModeSelect.value = DEFAULTS.colorMode;
  levelsInput.value = DEFAULTS.levels;
  presetPaletteSelect.value = DEFAULTS.presetPalette;
  duotoneDark.value = DEFAULTS.duotoneDark;
  duotoneLight.value = DEFAULTS.duotoneLight;
  autoColorsInput.value = DEFAULTS.autoColors;
  invertCheckbox.checked = DEFAULTS.invert;
  pixelSizeInput.value = DEFAULTS.pixelSize;
  brightnessInput.value = DEFAULTS.brightness;
  contrastInput.value = DEFAULTS.contrast;
  animateStillCheckbox.checked = DEFAULTS.animateStill;
  temporalDurationInput.value = DEFAULTS.temporalDuration;
  temporalFpsInput.value = DEFAULTS.temporalFps;
  temporalJitterInput.value = DEFAULTS.temporalJitter;
  colorFilterEnabled.checked = DEFAULTS.colorFilterEnabled;
  colorFilterColor.value = DEFAULTS.colorFilterColor;
  colorFilterBlendMode.value = DEFAULTS.colorFilterBlendMode;
  colorFilterAmount.value = DEFAULTS.colorFilterAmount;
  colorFilterConfig = {
    enabled: DEFAULTS.colorFilterEnabled,
    color: DEFAULTS.colorFilterColor,
    blendMode: DEFAULTS.colorFilterBlendMode,
    amount: +DEFAULTS.colorFilterAmount,
  };
  colorFilterFields.hidden = !colorFilterConfig.enabled;
  renderFilterSwatches();

  amountOut.textContent = (+DEFAULTS.amount).toFixed(2);
  levelsOut.textContent = DEFAULTS.levels;
  autoOut.textContent = DEFAULTS.autoColors;
  pixelSizeOut.textContent = DEFAULTS.pixelSize;
  brightnessOut.textContent = DEFAULTS.brightness;
  contrastOut.textContent = DEFAULTS.contrast;
  temporalDurationOut.textContent = (+DEFAULTS.temporalDuration).toFixed(1);
  temporalFpsOut.textContent = DEFAULTS.temporalFps;
  temporalJitterOut.textContent = DEFAULTS.temporalJitter;

  effectsStack = EFFECT_DEFS.map((def) => ({ ...def, enabled: false, amount: def.defaultAmount }));
  renderEffectsList();
  overlaysStack = OVERLAY_DEFS.map((def) => ({ ...def, enabled: false, amount: def.defaultAmount }));
  renderOverlaysList();
  customOverlays = [];
  renderCustomOverlaysList();

  currentFrame = 0;
  if (isAnimated()) play();
  else pause();

  updateControlVisibility();
  updatePlaybackUI();
  scheduleRender();
});

// ---------- init ----------

renderEffectsList();
renderOverlaysList();
renderCustomOverlaysList();
updateControlVisibility();
updatePlaybackUI();
