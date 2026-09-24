import useToy from "../useToy.js";
import ToyTools from "../ToyTools.jsx";

// Paint light into a field that's shown the way the site draws its art:
// ordered (Bayer) dithering into dots of the ink color. What you paint
// spreads, drifts upward like heat and slowly fades.
const CELL = 3;

// 8x8 Bayer matrix, as thresholds in 0..1.
const BAYER = (() => {
    const m = [
        [0, 32, 8, 40, 2, 34, 10, 42],
        [48, 16, 56, 24, 50, 18, 58, 26],
        [12, 44, 4, 36, 14, 46, 6, 38],
        [60, 28, 52, 20, 62, 30, 54, 22],
        [3, 35, 11, 43, 1, 33, 9, 41],
        [51, 19, 59, 27, 49, 17, 57, 25],
        [15, 47, 7, 39, 13, 45, 5, 37],
        [63, 31, 55, 23, 61, 29, 53, 21],
    ];
    return Float32Array.from(m.flat(), (v) => (v + 0.5) / 64);
})();

function create({ ctx, ink }) {
    let w = 0;
    let h = 0;
    let field = new Float32Array(0);
    let next = new Float32Array(0);
    let img = null;
    let brush = null;
    let prev = null;

    function stamp(x, y, erase) {
        const r = 7;
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                const gx = Math.round(x) + dx;
                const gy = Math.round(y) + dy;
                if (gx < 0 || gy < 0 || gx >= w || gy >= h) continue;
                const k = Math.exp(-(dx * dx + dy * dy) / (r * r * 0.35));
                const i = gy * w + gx;
                field[i] = erase ? field[i] * (1 - k) : Math.min(1.4, field[i] + k * 0.22);
            }
        }
    }

    function stroke(p) {
        // Fill in fast drags so the line doesn't break into blobs.
        const from = prev || p;
        const n = Math.max(1, Math.ceil(Math.hypot(p.x - from.x, p.y - from.y) / 3));
        for (let s = 1; s <= n; s++) stamp(from.x + ((p.x - from.x) * s) / n, from.y + ((p.y - from.y) * s) / n, p.button === 2);
        prev = { x: p.x, y: p.y };
    }

    function step(t) {
        // Blur a little, rise a little (with a wobble), fade a little.
        for (let y = 0; y < h; y++) {
            const sway = Math.round(Math.sin(t * 1.3 + y * 0.09) * 0.6);
            const ys = Math.min(h - 1, y + 1);
            for (let x = 0; x < w; x++) {
                const xs = Math.min(w - 1, Math.max(0, x + sway));
                const c = field[y * w + x];
                const src = field[ys * w + xs];
                const l = field[y * w + Math.max(0, x - 1)];
                const r = field[y * w + Math.min(w - 1, x + 1)];
                next[y * w + x] = (c * 0.5 + src * 0.3 + (l + r) * 0.1) * 0.997;
            }
        }
        [field, next] = [next, field];
    }

    function draw() {
        const [r, g, b] = ink().split(",").map(Number);
        const d = img.data;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                const o = i * 4;
                const on = field[i] > BAYER[(y & 7) * 8 + (x & 7)];
                d[o] = r;
                d[o + 1] = g;
                d[o + 2] = b;
                d[o + 3] = on ? 255 : 0;
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    return {
        resize(nw, nh) {
            w = nw;
            h = nh;
            field = new Float32Array(w * h);
            next = new Float32Array(w * h);
            img = ctx.createImageData(w, h);
            // Start with something on the canvas.
            for (let i = 0; i < 5; i++) stamp(w * (0.2 + 0.15 * i), h * (0.55 + 0.12 * Math.sin(i * 1.7)), false);
        },
        frame(t) {
            if (brush) stroke(brush);
            step(t);
            draw();
        },
        down(p) {
            brush = p;
            prev = null;
        },
        up() {
            brush = null;
            prev = null;
        },
        clear() {
            field.fill(0);
        },
    };
}

export default function DitherPaint() {
    const { canvasRef, toyRef } = useToy(create, { cell: CELL });
    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas pixel-canvas" />
            <ToyTools
                tools={[{ id: "clear", label: "Clear", onClick: () => toyRef.current?.clear() }]}
                hint="Drag to paint · right-drag to erase"
            />
        </>
    );
}
