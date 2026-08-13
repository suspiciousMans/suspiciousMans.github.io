import { applyDither, applyAdjustments } from './dither.js';
import { PRESET_PALETTES, paletteToRgb, hexToRgb } from './palettes.js';
import { medianCutPalette } from './quantize.js';

const $ = (id) => document.getElementById(id);

const dropZone = $('dropZone');
const fileInput = $('fileInput');
const chooseFileBtn = $('chooseFileBtn');
const sampleBtn = $('sampleBtn');
const changeImageBtn = $('changeImageBtn');
const downloadBtn = $('downloadBtn');
const previewCanvas = $('previewCanvas');
const emptyState = $('emptyState');
const stageActions = $('stageActions');

const algorithmSelect = $('algorithm');
const bayerField = $('bayerField');
const bayerSizeSelect = $('bayerSize');
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
const resetBtn = $('resetBtn');

const sourceCanvas = document.createElement('canvas');
const sourceCtx = sourceCanvas.getContext('2d');
const smallCanvas = document.createElement('canvas');
const smallCtx = smallCanvas.getContext('2d', { willReadFrequently: true });
const previewCtx = previewCanvas.getContext('2d');

const MAX_DIMENSION = 1600;
let renderScheduled = false;
let hasImage = false;

Object.entries(PRESET_PALETTES).forEach(([key, palette]) => {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = palette.label;
  presetPaletteSelect.appendChild(opt);
});
presetPaletteSelect.value = 'gameboy';

function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    render();
  });
}

function updateFieldVisibility() {
  bayerField.hidden = algorithmSelect.value !== 'ordered';
  const mode = colorModeSelect.value;
  levelsField.hidden = !(mode === 'levels' || mode === 'grayscale');
  paletteField.hidden = mode !== 'palette';
  duotoneField.hidden = mode !== 'duotone';
  autoField.hidden = mode !== 'auto';
}

function bindRange(input, output, onChange) {
  const update = () => {
    if (output) output.textContent = input.step && +input.step < 1 ? (+input.value).toFixed(2) : input.value;
    if (onChange) onChange();
    scheduleRender();
  };
  input.addEventListener('input', update);
  update();
}

function render() {
  if (!hasImage) return;

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const pixelSize = Math.max(1, +pixelSizeInput.value);
  const smallW = Math.max(1, Math.round(w / pixelSize));
  const smallH = Math.max(1, Math.round(h / pixelSize));

  smallCanvas.width = smallW;
  smallCanvas.height = smallH;
  smallCtx.imageSmoothingEnabled = true;
  smallCtx.clearRect(0, 0, smallW, smallH);
  smallCtx.drawImage(sourceCanvas, 0, 0, smallW, smallH);

  let imageData = smallCtx.getImageData(0, 0, smallW, smallH);
  imageData = applyAdjustments(imageData, {
    brightness: +brightnessInput.value,
    contrast: +contrastInput.value,
  });

  const mode = colorModeSelect.value;
  let ditherMode = 'levels';
  let palette;
  let levels = +levelsInput.value;

  if (mode === 'levels') {
    ditherMode = 'levels';
  } else if (mode === 'grayscale') {
    ditherMode = 'grayscale';
  } else if (mode === 'palette') {
    ditherMode = 'palette';
    palette = paletteToRgb(PRESET_PALETTES[presetPaletteSelect.value].colors);
  } else if (mode === 'duotone') {
    ditherMode = 'palette';
    palette = [hexToRgb(duotoneDark.value), hexToRgb(duotoneLight.value)];
  } else if (mode === 'auto') {
    ditherMode = 'palette';
    palette = medianCutPalette(imageData, +autoColorsInput.value);
  }

  const result = applyDither(imageData, {
    algorithm: algorithmSelect.value,
    mode: ditherMode,
    palette,
    levels,
    bayerSize: +bayerSizeSelect.value,
    amount: +amountInput.value,
    invert: invertCheckbox.checked,
  });

  smallCtx.putImageData(result, 0, 0);

  previewCanvas.width = w;
  previewCanvas.height = h;
  previewCtx.imageSmoothingEnabled = false;
  previewCtx.clearRect(0, 0, w, h);
  previewCtx.drawImage(smallCanvas, 0, 0, w, h);

  previewCanvas.style.display = 'block';
  emptyState.style.display = 'none';
  stageActions.hidden = false;
}

function setSourceFromCanvas(canvas) {
  sourceCanvas.width = canvas.width;
  sourceCanvas.height = canvas.height;
  sourceCtx.drawImage(canvas, 0, 0);
  hasImage = true;
  scheduleRender();
}

function setSourceFromImage(img) {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  sourceCanvas.width = w;
  sourceCanvas.height = h;
  sourceCtx.drawImage(img, 0, 0, w, h);
  hasImage = true;
  scheduleRender();
}

function loadImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    setSourceFromImage(img);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function generateSampleImage() {
  const w = 640, h = 480;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
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

  setSourceFromCanvas(canvas);
}

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  loadImageFile(file);
});

chooseFileBtn.addEventListener('click', () => fileInput.click());
changeImageBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => loadImageFile(fileInput.files[0]));
sampleBtn.addEventListener('click', generateSampleImage);

downloadBtn.addEventListener('click', () => {
  previewCanvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gooba-dither.png';
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
});

algorithmSelect.addEventListener('change', () => { updateFieldVisibility(); scheduleRender(); });
colorModeSelect.addEventListener('change', () => { updateFieldVisibility(); scheduleRender(); });
bayerSizeSelect.addEventListener('change', scheduleRender);
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

const DEFAULTS = {
  algorithm: 'floydSteinberg',
  bayerSize: '4',
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
};

resetBtn.addEventListener('click', () => {
  algorithmSelect.value = DEFAULTS.algorithm;
  bayerSizeSelect.value = DEFAULTS.bayerSize;
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

  amountOut.textContent = (+DEFAULTS.amount).toFixed(2);
  levelsOut.textContent = DEFAULTS.levels;
  autoOut.textContent = DEFAULTS.autoColors;
  pixelSizeOut.textContent = DEFAULTS.pixelSize;
  brightnessOut.textContent = DEFAULTS.brightness;
  contrastOut.textContent = DEFAULTS.contrast;

  updateFieldVisibility();
  scheduleRender();
});

updateFieldVisibility();
