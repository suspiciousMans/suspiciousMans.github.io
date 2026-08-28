import { applyDither, applyAdjustments } from './dither.js';
import { PRESET_PALETTES, paletteToRgb, hexToRgb } from './palettes.js';
import { medianCutPalette } from './quantize.js';
import { EFFECT_DEFS, applyEffects, applyTemporalJitter } from './effects.js';
import {
  OVERLAY_DEFS, applyOverlays,
  CUSTOM_OVERLAY_SHAPES, CUSTOM_OVERLAY_MOTIONS, CUSTOM_OVERLAY_PRESETS, applyCustomOverlays,
} from './overlays.js';
import {
  FILTER_BLEND_MODES, FILTER_PRESET_COLORS, GRADIENT_PRESETS,
  MIN_GRADIENT_STOPS, MAX_GRADIENT_STOPS, applyColorFilter,
} from './colorfilter.js';
import { ASCII_RAMPS, ASCII_COLOR_MODES, renderAsciiArt } from './ascii.js';
import { loadFavorites, addFavorite, removeFavorite } from './favorites.js';
import { decodeGIF, encodeGIF } from './gif.js';
import { extractVideoFrames } from './video.js';
import { createZip } from './zip.js';

const $ = (id) => document.getElementById(id);

// ---------- DOM ----------

const dropZone = $('dropZone');
const fileInput = $('fileInput');
const chooseFileBtn = $('chooseFileBtn');
const sampleBtn = $('sampleBtn');
const webcamBtn = $('webcamBtn');
const capturePhotoBtn = $('capturePhotoBtn');
const stopWebcamBtn = $('stopWebcamBtn');
const stopMotionBtn = $('stopMotionBtn');
const stopMotionFileInput = $('stopMotionFileInput');
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
const asciiRampField = $('asciiRampField');
const asciiRampSelect = $('asciiRamp');
const asciiColorModeField = $('asciiColorModeField');
const asciiColorModeSelect = $('asciiColorMode');
const asciiCustomColorField = $('asciiCustomColorField');
const asciiCustomColor = $('asciiCustomColor');
const amountField = $('amountField');
const amountInput = $('amount');
const amountOut = $('amountOut');

const colorModeFields = $('colorModeFields');
const colorModeSelect = $('colorMode');
const levelsField = $('levelsField');
const levelsInput = $('levels');
const levelsOut = $('levelsOut');
const paletteField = $('paletteField');
const presetPaletteSelect = $('presetPalette');
const duotoneField = $('duotoneField');
const duotoneDark = $('duotoneDark');
const duotoneLight = $('duotoneLight');
const duotoneSaveBtn = $('duotoneSaveBtn');
const duotoneFavoritesEl = $('duotoneFavorites');
const autoField = $('autoField');
const autoColorsInput = $('autoColors');
const autoOut = $('autoOut');
const referenceField = $('referenceField');
const referenceThumb = $('referenceThumb');
const referencePickBtn = $('referencePickBtn');
const referenceClearBtn = $('referenceClearBtn');
const referenceFileInput = $('referenceFileInput');
const referenceHint = $('referenceHint');
const invertCheckbox = $('invert');

const pixelSizeInput = $('pixelSize');
const pixelSizeOut = $('pixelSizeOut');
const brightnessInput = $('brightness');
const brightnessOut = $('brightnessOut');
const contrastInput = $('contrast');
const contrastOut = $('contrastOut');

const colorFilterEnabled = $('colorFilterEnabled');
const colorFilterFields = $('colorFilterFields');
const colorFilterType = $('colorFilterType');
const colorFilterSolidFields = $('colorFilterSolidFields');
const colorFilterGradientFields = $('colorFilterGradientFields');
const filterSwatchesEl = $('filterSwatches');
const colorFilterColor = $('colorFilterColor');
const filterColorSaveBtn = $('filterColorSaveBtn');
const gradientPresetSwatchesEl = $('gradientPresetSwatches');
const gradientPreviewEl = $('gradientPreview');
const gradientStopsListEl = $('gradientStopsList');
const gradientAddStopBtn = $('gradientAddStopBtn');
const gradientSaveBtn = $('gradientSaveBtn');
const gradientTypeSelect = $('gradientType');
const gradientAngleField = $('gradientAngleField');
const gradientAngleInput = $('gradientAngle');
const gradientAngleOut = $('gradientAngleOut');
const gradientAnimateCheckbox = $('gradientAnimate');
const gradientSpeedField = $('gradientSpeedField');
const gradientSpeedInput = $('gradientSpeed');
const gradientSpeedOut = $('gradientSpeedOut');
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

const liveVideoEl = document.createElement('video');
liveVideoEl.muted = true;
liveVideoEl.playsInline = true;
const liveCanvas = document.createElement('canvas');
const liveCtx = liveCanvas.getContext('2d', { willReadFrequently: true });
let liveStream = null;

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
let referenceImageData = null;
let referenceImageVersion = 0;
let referencePaletteCache = { key: null, palette: null };

let batchItems = []; // [{ id, name, imageData }]

Object.entries(PRESET_PALETTES).forEach(([key, palette]) => {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = palette.label;
  presetPaletteSelect.appendChild(opt);
});
presetPaletteSelect.value = 'gameboy';

ASCII_RAMPS.forEach((ramp) => {
  const opt = document.createElement('option');
  opt.value = ramp.chars;
  opt.textContent = ramp.label;
  asciiRampSelect.appendChild(opt);
});
ASCII_COLOR_MODES.forEach((mode) => {
  const opt = document.createElement('option');
  opt.value = mode.id;
  opt.textContent = mode.label;
  asciiColorModeSelect.appendChild(opt);
});

let effectsStack = EFFECT_DEFS.map((def) => ({ ...def, enabled: false, amount: def.defaultAmount }));
let overlaysStack = OVERLAY_DEFS.map((def) => ({ ...def, enabled: false, amount: def.defaultAmount }));
let customOverlays = [];
let customOverlaySeq = 0;
let colorFilterConfig = {
  enabled: false,
  type: 'solid',
  color: FILTER_PRESET_COLORS[0].color,
  gradientStops: ['#ff6b6b', '#8a6fe0'],
  gradientType: 'spatial',
  gradientAngle: 90,
  gradientAnimate: false,
  gradientSpeed: 50,
  blendMode: 'multiply',
  amount: 60,
};

// ---------- helpers ----------

function clampCurrentFrame() {
  const total = totalFramesCount();
  if (currentFrame >= total) currentFrame = 0;
}

function isAnimated() {
  if (mediaMode === 'live') return true;
  if (mediaMode === 'sequence') return sourceFrames.length > 1;
  if (mediaMode === 'image') return animateStillCheckbox.checked;
  return false;
}

function totalFramesCount() {
  if (mediaMode === 'live') return 2; // unused by the live render path; just needs to be >1 for play() to proceed
  if (mediaMode === 'sequence') return Math.max(1, sourceFrames.length);
  if (mediaMode === 'image' && animateStillCheckbox.checked) {
    return Math.max(2, Math.round(+temporalDurationInput.value * +temporalFpsInput.value));
  }
  return 1;
}

function grabLiveVideoFrame() {
  liveCtx.drawImage(liveVideoEl, 0, 0, mediaWidth, mediaHeight);
  return liveCtx.getImageData(0, 0, mediaWidth, mediaHeight);
}

function getSourceFrameData(index) {
  if (mediaMode === 'live') return grabLiveVideoFrame();
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
    asciiChars: asciiRampSelect.value,
    asciiColorMode: asciiColorModeSelect.value,
    asciiCustomColor: asciiCustomColor.value,
  };
}

function resolveReferencePalette(colorCount) {
  if (!referenceImageData) return null;
  const key = `${referenceImageVersion}:${colorCount}`;
  if (referencePaletteCache.key !== key) {
    referencePaletteCache = { key, palette: medianCutPalette(referenceImageData, colorCount) };
  }
  return referencePaletteCache.palette;
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

  const isAscii = settings.algorithm === 'ascii';
  const smallW = isAscii ? rawImageData.width : Math.max(1, Math.round(rawImageData.width / settings.pixelSize));
  const smallH = isAscii ? rawImageData.height : Math.max(1, Math.round(rawImageData.height / settings.pixelSize));
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

  let result;
  if (isAscii) {
    result = renderAsciiArt(imageData, smallCanvas, smallCtx, {
      cellSize: Math.max(6, settings.pixelSize + 4),
      chars: settings.asciiChars,
      colorMode: settings.asciiColorMode,
      customColor: settings.asciiCustomColor,
      invert: settings.invert,
    });
  } else {
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
    } else if (settings.colorMode === 'reference') {
      ditherMode = 'palette';
      palette = resolveReferencePalette(settings.autoColors) || resolveAutoPalette(
        imageData,
        settings.autoColors,
        useAutoPaletteCache,
        `${settings.pixelSize}:${settings.brightness}:${settings.contrast}`,
      );
    }

    const phase = animated && (settings.algorithm === 'ordered' || settings.algorithm === 'halftone')
      ? { x: frameIndex, y: 0 }
      : { x: 0, y: 0 };

    result = applyDither(imageData, {
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
  }

  result = applyEffects(result, effectsStack, frameIndex);
  result = applyOverlays(result, overlaysStack, frameIndex);
  result = applyCustomOverlays(result, customOverlays, frameIndex);
  result = applyColorFilter(result, colorFilterConfig, frameIndex);

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
  if (mediaMode === 'live') {
    renderCurrentFrame();
    rafId = requestAnimationFrame(loop);
    return;
  }
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
  const isAscii = algorithmSelect.value === 'ascii';
  matrixTypeField.hidden = algorithmSelect.value !== 'ordered';
  bayerField.hidden = algorithmSelect.value !== 'ordered';
  haltoneCellField.hidden = algorithmSelect.value !== 'halftone';
  amountField.hidden = isAscii;
  asciiRampField.hidden = !isAscii;
  asciiColorModeField.hidden = !isAscii;
  asciiCustomColorField.hidden = !isAscii || asciiColorModeSelect.value !== 'custom';
  colorModeFields.hidden = isAscii;

  const mode = colorModeSelect.value;
  levelsField.hidden = !(mode === 'levels' || mode === 'grayscale');
  paletteField.hidden = mode !== 'palette';
  duotoneField.hidden = mode !== 'duotone';
  autoField.hidden = !(mode === 'auto' || mode === 'reference');
  referenceField.hidden = mode !== 'reference';

  animateStillField.hidden = !(mediaLoaded && mediaMode === 'image');
  const showTemporalControls = mediaLoaded && mediaMode === 'image' && animateStillCheckbox.checked;
  temporalDurationField.hidden = !showTemporalControls;
  temporalFpsField.hidden = !showTemporalControls;
  temporalJitterField.hidden = !(mediaLoaded && isAnimated());
}

function updatePlaybackUI() {
  const animated = isAnimated();
  const isLive = mediaMode === 'live';
  clampCurrentFrame();
  playbackBar.hidden = !animated || isLive;
  if (animated && !isLive) {
    frameScrubber.max = String(Math.max(1, totalFramesCount() - 1));
    frameScrubber.value = String(currentFrame);
    updateFrameCounterText();
  }
  downloadGifBtn.hidden = !animated || isLive;
  downloadWebmBtn.hidden = !animated || isLive || !mediaRecorderSupported();
  capturePhotoBtn.hidden = !isLive;
  stopWebcamBtn.hidden = !isLive;
  changeImageBtn.hidden = isLive;
  downloadPngBtn.hidden = isLive;
  updateControlVisibility();
}

// ---------- media loading ----------

function stopLiveStream() {
  if (liveStream) {
    liveStream.getTracks().forEach((t) => t.stop());
    liveStream = null;
  }
}

function setMediaFromFrames(mode, width, height, frames, infoText) {
  if (mediaMode === 'live' && mode !== 'live') stopLiveStream();
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

async function startWebcam() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError('This browser cannot access the camera');
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
  } catch (err) {
    console.error(err);
    showError('Could not access the camera');
    return;
  }

  liveStream = stream;
  liveVideoEl.srcObject = stream;
  try {
    await liveVideoEl.play();
  } catch (err) {
    console.error(err);
    stopLiveStream();
    showError('Could not start the camera preview');
    return;
  }

  const scale = Math.min(1, ANIMATED_MAX_DIMENSION / Math.max(liveVideoEl.videoWidth, liveVideoEl.videoHeight));
  const w = Math.max(1, Math.round(liveVideoEl.videoWidth * scale));
  const h = Math.max(1, Math.round(liveVideoEl.videoHeight * scale));
  liveCanvas.width = w;
  liveCanvas.height = h;

  mediaMode = 'live';
  mediaWidth = w;
  mediaHeight = h;
  sourceFrames = [];
  mediaVersion++;
  currentFrame = 0;
  accumulated = 0;
  autoPaletteCache = { key: null, palette: null };
  mediaLoaded = true;

  mediaInfo.textContent = `Webcam — ${w}×${h} live`;
  emptyState.style.display = 'none';
  previewCanvas.style.display = 'block';
  stageActions.hidden = false;

  updatePlaybackUI();
  play();
}

function stopWebcam() {
  stopLiveStream();
  pause();
  mediaMode = 'none';
  mediaLoaded = false;
  emptyState.style.display = 'flex';
  previewCanvas.style.display = 'none';
  stageActions.hidden = true;
  mediaInfo.textContent = '';
  updatePlaybackUI();
}

function capturePhoto() {
  const scale = Math.min(1, STILL_MAX_DIMENSION / Math.max(liveVideoEl.videoWidth, liveVideoEl.videoHeight));
  const w = Math.max(1, Math.round(liveVideoEl.videoWidth * scale));
  const h = Math.max(1, Math.round(liveVideoEl.videoHeight * scale));
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(liveVideoEl, 0, 0, w, h);
  const imageData = tctx.getImageData(0, 0, w, h);
  setMediaFromFrames('image', w, h, [{ imageData, delay: 1000 / 12 }], `Webcam photo — ${w}×${h}`);
}

async function loadStopMotionFiles(files) {
  const imageFiles = files.filter((f) => f.type.startsWith('image/'));
  if (imageFiles.length < 2) {
    showError('Pick at least 2 images for stop-motion');
    return;
  }
  showLoading('Loading stop-motion frames…');
  try {
    const rawDatas = [];
    for (const file of imageFiles) {
      rawDatas.push(await loadImageAsData(file, 1200));
    }

    const firstW = rawDatas[0].width, firstH = rawDatas[0].height;
    const scale = Math.min(1, ANIMATED_MAX_DIMENSION / Math.max(firstW, firstH));
    const targetW = Math.max(1, Math.round(firstW * scale));
    const targetH = Math.max(1, Math.round(firstH * scale));

    const srcCanvas = document.createElement('canvas');
    const srcCtx = srcCanvas.getContext('2d');
    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = targetW;
    dstCanvas.height = targetH;
    const dstCtx = dstCanvas.getContext('2d');

    const fps = 6;
    const delay = 1000 / fps;
    const frames = rawDatas.map((data) => {
      srcCanvas.width = data.width;
      srcCanvas.height = data.height;
      srcCtx.putImageData(data, 0, 0);
      const coverScale = Math.max(targetW / data.width, targetH / data.height);
      const dw = data.width * coverScale, dh = data.height * coverScale;
      dstCtx.clearRect(0, 0, targetW, targetH);
      dstCtx.drawImage(srcCanvas, (targetW - dw) / 2, (targetH - dh) / 2, dw, dh);
      return { imageData: dstCtx.getImageData(0, 0, targetW, targetH), delay };
    });

    hideLoading();
    setMediaFromFrames('sequence', targetW, targetH, frames, `Stop-motion — ${frames.length} frames`);
  } catch (err) {
    hideLoading();
    console.error(err);
    showError('Could not load stop-motion frames');
  }
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

webcamBtn.addEventListener('click', startWebcam);
capturePhotoBtn.addEventListener('click', capturePhoto);
stopWebcamBtn.addEventListener('click', stopWebcam);

stopMotionBtn.addEventListener('click', () => stopMotionFileInput.click());
stopMotionFileInput.addEventListener('change', () => {
  loadStopMotionFiles(Array.from(stopMotionFileInput.files));
  stopMotionFileInput.value = '';
});

document.addEventListener('paste', (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        handleFile(file);
      }
      break;
    }
  }
});

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
asciiRampSelect.addEventListener('change', scheduleRender);
asciiColorModeSelect.addEventListener('change', () => { updateControlVisibility(); scheduleRender(); });
asciiCustomColor.addEventListener('input', scheduleRender);
colorModeSelect.addEventListener('change', () => { updateControlVisibility(); scheduleRender(); });
presetPaletteSelect.addEventListener('change', scheduleRender);

referencePickBtn.addEventListener('click', () => referenceFileInput.click());
referenceFileInput.addEventListener('change', async () => {
  const file = referenceFileInput.files[0];
  referenceFileInput.value = '';
  if (!file) return;
  try {
    referenceImageData = await loadImageAsData(file, 500);
    referenceImageVersion++;
    referencePaletteCache = { key: null, palette: null };
    const tctx = referenceThumb.getContext('2d');
    tctx.imageSmoothingEnabled = true;
    tctx.clearRect(0, 0, referenceThumb.width, referenceThumb.height);
    const scale = Math.max(referenceThumb.width / referenceImageData.width, referenceThumb.height / referenceImageData.height);
    const dw = referenceImageData.width * scale, dh = referenceImageData.height * scale;
    const tmp = document.createElement('canvas');
    tmp.width = referenceImageData.width; tmp.height = referenceImageData.height;
    tmp.getContext('2d').putImageData(referenceImageData, 0, 0);
    tctx.drawImage(tmp, (referenceThumb.width - dw) / 2, (referenceThumb.height - dh) / 2, dw, dh);
    referenceClearBtn.hidden = false;
    referenceHint.textContent = `${referenceImageData.width}×${referenceImageData.height} reference loaded.`;
    scheduleRender();
  } catch (err) {
    console.error(err);
    showError('Could not load reference image');
  }
});
referenceClearBtn.addEventListener('click', () => {
  referenceImageData = null;
  referenceImageVersion++;
  referencePaletteCache = { key: null, palette: null };
  referenceThumb.getContext('2d').clearRect(0, 0, referenceThumb.width, referenceThumb.height);
  referenceClearBtn.hidden = true;
  referenceHint.textContent = 'No reference image chosen — using the current photo instead.';
  scheduleRender();
});
duotoneDark.addEventListener('input', scheduleRender);
duotoneLight.addEventListener('input', scheduleRender);
invertCheckbox.addEventListener('change', scheduleRender);

bindRange(amountInput, amountOut);
bindRange(levelsInput, levelsOut);
bindRange(autoColorsInput, autoOut);
bindRange(pixelSizeInput, pixelSizeOut);
bindRange(brightnessInput, brightnessOut);
bindRange(contrastInput, contrastOut);

function makeColorSwatch(color, label, onPick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'filter-swatch';
  btn.style.background = color;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.addEventListener('click', onPick);
  return btn;
}

function renderFilterSwatches() {
  filterSwatchesEl.innerHTML = '';
  FILTER_PRESET_COLORS.forEach((preset) => {
    const btn = makeColorSwatch(preset.color, preset.label, () => {
      colorFilterConfig.color = preset.color;
      colorFilterColor.value = preset.color;
      renderFilterSwatches();
      scheduleRender();
    });
    if (preset.color.toLowerCase() === colorFilterConfig.color.toLowerCase()) btn.classList.add('active');
    filterSwatchesEl.appendChild(btn);
  });

  loadFavorites('filterColors').forEach((color, idx) => {
    const item = document.createElement('div');
    item.className = 'favorite-item';
    const btn = makeColorSwatch(color, 'Saved color', () => {
      colorFilterConfig.color = color;
      colorFilterColor.value = color;
      renderFilterSwatches();
      scheduleRender();
    });
    if (color.toLowerCase() === colorFilterConfig.color.toLowerCase()) btn.classList.add('active');
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'favorite-remove';
    removeBtn.textContent = '✕';
    removeBtn.setAttribute('aria-label', 'Remove saved color');
    removeBtn.addEventListener('click', () => {
      removeFavorite('filterColors', idx);
      renderFilterSwatches();
    });
    item.append(btn, removeBtn);
    filterSwatchesEl.appendChild(item);
  });
}

function renderDuotoneFavorites() {
  duotoneFavoritesEl.innerHTML = '';
  loadFavorites('duotones').forEach((pair, idx) => {
    const item = document.createElement('div');
    item.className = 'favorite-item';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-swatch';
    btn.style.background = `linear-gradient(90deg, ${pair.dark} 50%, ${pair.light} 50%)`;
    btn.title = 'Saved duotone';
    btn.setAttribute('aria-label', 'Saved duotone');
    btn.addEventListener('click', () => {
      duotoneDark.value = pair.dark;
      duotoneLight.value = pair.light;
      scheduleRender();
    });
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'favorite-remove';
    removeBtn.textContent = '✕';
    removeBtn.setAttribute('aria-label', 'Remove saved duotone');
    removeBtn.addEventListener('click', () => {
      removeFavorite('duotones', idx);
      renderDuotoneFavorites();
    });
    item.append(btn, removeBtn);
    duotoneFavoritesEl.appendChild(item);
  });
}

function updateGradientPreview() {
  gradientPreviewEl.style.background = `linear-gradient(90deg, ${colorFilterConfig.gradientStops.join(', ')})`;
}

function renderGradientStops() {
  gradientStopsListEl.innerHTML = '';
  colorFilterConfig.gradientStops.forEach((color, idx) => {
    const row = document.createElement('div');
    row.className = 'gradient-stop';

    const input = document.createElement('input');
    input.type = 'color';
    input.value = color;
    input.addEventListener('input', () => {
      colorFilterConfig.gradientStops[idx] = input.value;
      updateGradientPreview();
      scheduleRender();
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'gradient-stop-remove';
    removeBtn.textContent = '✕';
    removeBtn.setAttribute('aria-label', 'Remove stop');
    removeBtn.disabled = colorFilterConfig.gradientStops.length <= MIN_GRADIENT_STOPS;
    removeBtn.addEventListener('click', () => {
      if (colorFilterConfig.gradientStops.length <= MIN_GRADIENT_STOPS) return;
      colorFilterConfig.gradientStops.splice(idx, 1);
      renderGradientStops();
      scheduleRender();
    });

    row.append(input, removeBtn);
    gradientStopsListEl.appendChild(row);
  });
  updateGradientPreview();
  gradientAddStopBtn.disabled = colorFilterConfig.gradientStops.length >= MAX_GRADIENT_STOPS;
}

function renderGradientPresetSwatches() {
  gradientPresetSwatchesEl.innerHTML = '';
  GRADIENT_PRESETS.forEach((preset) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-swatch gradient-preset-swatch';
    btn.style.background = `linear-gradient(90deg, ${preset.stops.join(', ')})`;
    btn.title = preset.label;
    btn.setAttribute('aria-label', preset.label);
    btn.addEventListener('click', () => {
      colorFilterConfig.gradientStops = [...preset.stops];
      renderGradientStops();
      scheduleRender();
    });
    gradientPresetSwatchesEl.appendChild(btn);
  });

  loadFavorites('gradients').forEach((saved, idx) => {
    const item = document.createElement('div');
    item.className = 'favorite-item';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-swatch gradient-preset-swatch';
    btn.style.background = `linear-gradient(90deg, ${saved.stops.join(', ')})`;
    btn.title = 'Saved gradient';
    btn.setAttribute('aria-label', 'Saved gradient');
    btn.addEventListener('click', () => {
      colorFilterConfig.gradientStops = [...saved.stops];
      renderGradientStops();
      scheduleRender();
    });
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'favorite-remove';
    removeBtn.textContent = '✕';
    removeBtn.setAttribute('aria-label', 'Remove saved gradient');
    removeBtn.addEventListener('click', () => {
      removeFavorite('gradients', idx);
      renderGradientPresetSwatches();
    });
    item.append(btn, removeBtn);
    gradientPresetSwatchesEl.appendChild(item);
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
renderGradientPresetSwatches();
renderGradientStops();
renderDuotoneFavorites();

filterColorSaveBtn.addEventListener('click', () => {
  addFavorite('filterColors', colorFilterColor.value);
  renderFilterSwatches();
});
duotoneSaveBtn.addEventListener('click', () => {
  addFavorite('duotones', { dark: duotoneDark.value, light: duotoneLight.value });
  renderDuotoneFavorites();
});
gradientSaveBtn.addEventListener('click', () => {
  addFavorite('gradients', { stops: [...colorFilterConfig.gradientStops] });
  renderGradientPresetSwatches();
});

colorFilterEnabled.addEventListener('change', () => {
  colorFilterConfig.enabled = colorFilterEnabled.checked;
  colorFilterFields.hidden = !colorFilterConfig.enabled;
  scheduleRender();
});
colorFilterType.addEventListener('change', () => {
  colorFilterConfig.type = colorFilterType.value;
  colorFilterSolidFields.hidden = colorFilterConfig.type !== 'solid';
  colorFilterGradientFields.hidden = colorFilterConfig.type !== 'gradient';
  scheduleRender();
});
colorFilterColor.addEventListener('input', () => {
  colorFilterConfig.color = colorFilterColor.value;
  renderFilterSwatches();
  scheduleRender();
});
gradientAddStopBtn.addEventListener('click', () => {
  if (colorFilterConfig.gradientStops.length >= MAX_GRADIENT_STOPS) return;
  colorFilterConfig.gradientStops.push('#ffffff');
  renderGradientStops();
  scheduleRender();
});
gradientTypeSelect.addEventListener('change', () => {
  colorFilterConfig.gradientType = gradientTypeSelect.value;
  gradientAngleField.hidden = colorFilterConfig.gradientType === 'luminance';
  scheduleRender();
});
bindRange(gradientAngleInput, gradientAngleOut, () => { colorFilterConfig.gradientAngle = +gradientAngleInput.value; });
gradientAnimateCheckbox.addEventListener('change', () => {
  colorFilterConfig.gradientAnimate = gradientAnimateCheckbox.checked;
  gradientSpeedField.hidden = !colorFilterConfig.gradientAnimate;
  // Animating the gradient only does anything visible once frames are
  // actually advancing — auto-enable "Animate still image" on a plain
  // photo so turning this on is never a silent no-op.
  if (colorFilterConfig.gradientAnimate && mediaMode === 'image' && !animateStillCheckbox.checked) {
    animateStillCheckbox.checked = true;
    syncAnimateStillState();
  }
  scheduleRender();
});
bindRange(gradientSpeedInput, gradientSpeedOut, () => { colorFilterConfig.gradientSpeed = +gradientSpeedInput.value; });
colorFilterBlendMode.addEventListener('change', () => {
  colorFilterConfig.blendMode = colorFilterBlendMode.value;
  scheduleRender();
});
bindRange(colorFilterAmount, colorFilterAmountOut, () => { colorFilterConfig.amount = +colorFilterAmount.value; });

function syncAnimateStillState() {
  updateControlVisibility();
  updatePlaybackUI();
  currentFrame = 0;
  if (isAnimated()) play();
  else { pause(); scheduleRender(); }
}

animateStillCheckbox.addEventListener('change', syncAnimateStillState);

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
  asciiRamp: ASCII_RAMPS[0].chars,
  asciiColorMode: ASCII_COLOR_MODES[0].id,
  asciiCustomColor: '#e6e6e6',
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
  colorFilterType: 'solid',
  colorFilterColor: FILTER_PRESET_COLORS[0].color,
  colorFilterGradientStops: ['#ff6b6b', '#8a6fe0'],
  colorFilterGradientType: 'spatial',
  colorFilterGradientAngle: '90',
  colorFilterGradientAnimate: false,
  colorFilterGradientSpeed: '50',
  colorFilterBlendMode: 'multiply',
  colorFilterAmount: '60',
};

resetBtn.addEventListener('click', () => {
  algorithmSelect.value = DEFAULTS.algorithm;
  matrixTypeSelect.value = DEFAULTS.matrixType;
  bayerSizeSelect.value = DEFAULTS.bayerSize;
  haltoneCellSizeSelect.value = DEFAULTS.haltoneCellSize;
  amountInput.value = DEFAULTS.amount;
  asciiRampSelect.value = DEFAULTS.asciiRamp;
  asciiColorModeSelect.value = DEFAULTS.asciiColorMode;
  asciiCustomColor.value = DEFAULTS.asciiCustomColor;
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
  colorFilterType.value = DEFAULTS.colorFilterType;
  colorFilterColor.value = DEFAULTS.colorFilterColor;
  gradientTypeSelect.value = DEFAULTS.colorFilterGradientType;
  gradientAngleInput.value = DEFAULTS.colorFilterGradientAngle;
  gradientAngleOut.textContent = DEFAULTS.colorFilterGradientAngle;
  gradientAnimateCheckbox.checked = DEFAULTS.colorFilterGradientAnimate;
  gradientSpeedInput.value = DEFAULTS.colorFilterGradientSpeed;
  gradientSpeedOut.textContent = DEFAULTS.colorFilterGradientSpeed;
  colorFilterBlendMode.value = DEFAULTS.colorFilterBlendMode;
  colorFilterAmount.value = DEFAULTS.colorFilterAmount;
  colorFilterConfig = {
    enabled: DEFAULTS.colorFilterEnabled,
    type: DEFAULTS.colorFilterType,
    color: DEFAULTS.colorFilterColor,
    gradientStops: [...DEFAULTS.colorFilterGradientStops],
    gradientType: DEFAULTS.colorFilterGradientType,
    gradientAngle: +DEFAULTS.colorFilterGradientAngle,
    gradientAnimate: DEFAULTS.colorFilterGradientAnimate,
    gradientSpeed: +DEFAULTS.colorFilterGradientSpeed,
    blendMode: DEFAULTS.colorFilterBlendMode,
    amount: +DEFAULTS.colorFilterAmount,
  };
  colorFilterFields.hidden = !colorFilterConfig.enabled;
  colorFilterSolidFields.hidden = colorFilterConfig.type !== 'solid';
  colorFilterGradientFields.hidden = colorFilterConfig.type !== 'gradient';
  gradientSpeedField.hidden = !colorFilterConfig.gradientAnimate;
  gradientAngleField.hidden = colorFilterConfig.gradientType === 'luminance';
  renderFilterSwatches();
  renderGradientStops();

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
