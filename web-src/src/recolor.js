// Recolors the site's two-tone dithered art for the custom theme. Every PNG
// under /assets/img/theme/saffron/ holds exactly two colors (the Saffron
// ground and ink), so each pixel maps cleanly onto the visitor's own ground
// or ink. The shapes don't need this: they're masks painted with the theme's
// colors in CSS.
export const ART = [
    "bg-dither.png",
    "hero-board.png",
    "hero-board-m.png",
    "hex-colony-preview-dither.png",
    "autocode-preview-dither.png",
    "hex-toy.png",
];

const SOURCE = "/assets/img/theme/saffron/";
// Saffron's ground is dark and its ink bright, so luminance splits them.
const SPLIT = 100;

function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

const idle = () => new Promise((r) => setTimeout(r, 0));

async function recolorOne(file, bg, ink) {
    const img = await loadImage(SOURCE + file);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // One 32-bit read/write per pixel; byte order matches the platform's, so
    // pack the replacement colors the same way the pixels are laid out.
    const px = new Uint32Array(data.data.buffer);
    const probe = new Uint8ClampedArray(new Uint32Array([0x11223344]).buffer);
    const little = probe[0] === 0x44;
    const pack = ([r, g, b]) => (little ? (255 << 24) | (b << 16) | (g << 8) | r : (r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
    const inkPx = pack(ink);
    const bgPx = pack(bg);
    const bytes = data.data;
    for (let i = 0; i < px.length; i++) {
        const o = i * 4;
        if (bytes[o + 3] === 0) continue;
        px[i] = bytes[o] * 0.3 + bytes[o + 1] * 0.59 + bytes[o + 2] * 0.11 > SPLIT ? inkPx : bgPx;
    }
    ctx.putImageData(data, 0, 0);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    return URL.createObjectURL(blob);
}

// Resolves to { file: blobUrl } for every piece of art. Images are done one
// at a time with a yield in between so the page stays responsive, and each
// is handed to `onEach` as soon as it's ready so the page fills in
// progressively. `cancelled()` stops the run early.
export async function recolorArt(bgHex, inkHex, onEach = () => {}, cancelled = () => false) {
    const bg = rgb(bgHex);
    const ink = rgb(inkHex);
    const out = {};
    for (const file of ART) {
        if (cancelled()) break;
        try {
            out[file] = await recolorOne(file, bg, ink);
            if (!cancelled()) onEach(file, out[file]);
        } catch {
            // leave it on the Saffron original
        }
        await idle();
    }
    return out;
}
