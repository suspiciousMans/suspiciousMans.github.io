import { useEffect, useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToySelect, ToyButtons, ToyReadout } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// A Mandelbrot and Julia set explorer. Each pixel is a complex number c;
// iterate z -> z² + c and count how long z takes to escape. Points that
// never escape are the set itself. The picture renders in two passes, a
// coarse one then the full one, spread over frames so zooming stays smooth.
const CELL = 2;
const COARSE = 4;

const BAYER = Float32Array.from([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], (v) => (v + 0.5) / 16);

export const PLACES = [
    { id: "home", label: "Whole set", x: -0.6, y: 0, span: 3.2 },
    { id: "seahorse", label: "Seahorse valley", x: -0.7436438, y: 0.1318259, span: 0.012 },
    { id: "elephant", label: "Elephant valley", x: 0.2925, y: 0.0149, span: 0.035 },
    { id: "spiral", label: "Double spiral", x: -0.7616, y: -0.0848, span: 0.012 },
    { id: "mini", label: "A tiny copy", x: -1.7497, y: 0, span: 0.0012 },
    { id: "rabbit", label: "Julia: Douady rabbit", julia: [-0.123, 0.745] },
    { id: "dendrite", label: "Julia: dendrite", julia: [0, 1] },
    { id: "siegel", label: "Julia: Siegel disk", julia: [-0.391, -0.587] },
    { id: "dragon", label: "Julia: San Marco dragon", julia: [-0.75, 0.06] },
    { id: "galaxy", label: "Julia: spiral galaxy", julia: [-0.8, 0.156] },
];

function create({ canvas, ctx, ink, wake }) {
    let w = 0;
    let h = 0;
    let mu = new Float32Array(0); // smoothed escape count; -1 = inside
    let img = null;
    const view = { x: -0.6, y: 0, span: 3.2 }; // span = width of the view
    let julia = null; // [re, im] when showing a Julia set
    const opts = { iters: 200, bands: 1 };
    let pass = 0; // 0 coarse, 1 fine, 2 done
    let row = 0;
    let press = null;
    let listener = () => {};

    const restart = () => {
        pass = 0;
        row = 0;
        wake();
    };

    function escape(cr, ci) {
        let zr, zi, pr, pi;
        if (julia) {
            zr = cr;
            zi = ci;
            pr = julia[0];
            pi = julia[1];
        } else {
            // Skip the main cardioid and the period-2 bulb: they're always inside.
            const q = (cr - 0.25) ** 2 + ci * ci;
            if (q * (q + (cr - 0.25)) <= 0.25 * ci * ci || (cr + 1) ** 2 + ci * ci <= 0.0625) return -1;
            zr = 0;
            zi = 0;
            pr = cr;
            pi = ci;
        }
        const max = opts.iters;
        let n = 0;
        let r2 = zr * zr;
        let i2 = zi * zi;
        while (n < max && r2 + i2 <= 256) {
            zi = 2 * zr * zi + pi;
            zr = r2 - i2 + pr;
            r2 = zr * zr;
            i2 = zi * zi;
            n++;
        }
        if (n >= max) return -1;
        return n + 1 - Math.log2(Math.log2(r2 + i2) / 2);
    }

    function renderRows(budget) {
        const t0 = performance.now();
        const k = view.span / w;
        const x0 = view.x - (w / 2) * k;
        const y0 = view.y - (h / 2) * k;
        while (pass < 2 && performance.now() - t0 < budget) {
            const y = row;
            if (pass === 0) {
                if (y % COARSE === 0) {
                    for (let x = 0; x < w; x += COARSE) {
                        const m = escape(x0 + x * k, y0 + y * k);
                        for (let j = 0; j < COARSE && y + j < h; j++) mu.fill(m, (y + j) * w + x, (y + j) * w + Math.min(w, x + COARSE));
                    }
                }
            } else {
                for (let x = 0; x < w; x++) {
                    if (x % COARSE === 0 && y % COARSE === 0) continue;
                    mu[y * w + x] = escape(x0 + x * k, y0 + y * k);
                }
            }
            row++;
            if (row >= h) {
                row = 0;
                pass++;
            }
        }
    }

    function draw() {
        const [r, g, b] = ink().split(",").map(Number);
        const d = img.data;
        const f = opts.bands;
        const lmax = Math.log(Math.min(opts.iters, 400));
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                const m = mu[i];
                const o = i * 4;
                d[o] = r;
                d[o + 1] = g;
                d[o + 2] = b;
                if (m < 0) {
                    d[o + 3] = 255;
                    continue;
                }
                // Dark far out, denser toward the edge of the set, with soft bands.
                const near = Math.min(1, Math.log(m + 1) / lmax) ** 2;
                const c = near * (0.55 + 0.45 * Math.cos(Math.log(m + 1) * f * 6));
                d[o + 3] = c > BAYER[(y & 3) * 4 + (x & 3)] ? 255 : 0;
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    function shift(dx, dy) {
        if (!dx && !dy) return;
        const old = mu.slice();
        mu.fill(0);
        for (let y = 0; y < h; y++) {
            const sy = y - dy;
            if (sy < 0 || sy >= h) continue;
            for (let x = 0; x < w; x++) {
                const sx = x - dx;
                if (sx >= 0 && sx < w) mu[y * w + x] = old[sy * w + sx];
            }
        }
    }

    function zoomAt(px, py, factor) {
        const k = view.span / w;
        const cx = view.x + (px - w / 2) * k;
        const cy = view.y + (py - h / 2) * k;
        view.span = Math.min(8, Math.max(1e-13, view.span * factor));
        const k2 = view.span / w;
        view.x = cx - (px - w / 2) * k2;
        view.y = cy - (py - h / 2) * k2;
        restart();
    }

    function onWheel(e) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const s = canvas.width / rect.width;
        zoomAt((e.clientX - rect.left) * s, (e.clientY - rect.top) * s, Math.exp(e.deltaY * 0.0015));
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return {
        resize(nw, nh) {
            w = nw;
            h = nh;
            mu = new Float32Array(w * h);
            img = ctx.createImageData(w, h);
            restart();
        },
        frame() {
            if (pass < 2) renderRows(10);
            draw();
            listener({ zoom: 3.2 / view.span, done: pass >= 2, julia });
        },
        down(p) {
            press = { x: p.x, y: p.y, vx: view.x, vy: view.y, sx: 0, sy: 0, moved: false, button: p.button };
        },
        move(p) {
            if (!press || !p.down) return;
            const dx = p.x - press.x;
            const dy = p.y - press.y;
            if (!press.moved && Math.hypot(dx, dy) < 3) return;
            press.moved = true;
            // Pan by whole pixels and slide what's already drawn along, so the
            // picture follows the pointer before the new edges fill in.
            const ix = Math.round(dx);
            const iy = Math.round(dy);
            shift(ix - press.sx, iy - press.sy);
            press.sx = ix;
            press.sy = iy;
            const k = view.span / w;
            view.x = press.vx - ix * k;
            view.y = press.vy - iy * k;
            restart();
        },
        up(p) {
            if (press && !press.moved) zoomAt(p.x, p.y, press.button === 2 ? 2.5 : 0.4);
            press = null;
        },
        running: () => pass < 2,
        onStats(fn) {
            listener = fn;
        },
        set(key, value) {
            opts[key] = value;
            if (key === "iters") restart();
            wake();
        },
        go(place) {
            if (place.julia) {
                julia = place.julia;
                Object.assign(view, { x: 0, y: 0, span: 3.6 });
            } else {
                julia = null;
                Object.assign(view, { x: place.x, y: place.y, span: place.span });
            }
            restart();
        },
        // Show the Julia set for the point at the middle of the screen.
        juliaHere() {
            julia = [view.x, view.y];
            Object.assign(view, { x: 0, y: 0, span: 3.6 });
            restart();
        },
        destroy() {
            canvas.removeEventListener("wheel", onWheel);
        },
    };
}

export default function Fractal() {
    const { canvasRef, toyRef } = useToy(create, { cell: CELL });
    const [place, setPlace] = useState("home");
    const [iters, setIters] = useState(200);
    const [bands, setBands] = useState(1);
    const [stats, setStats] = useState({ zoom: 1, done: false, julia: null });
    const toy = () => toyRef.current;

    useEffect(() => {
        let lastAt = 0;
        toyRef.current?.onStats((st) => {
            const now = performance.now();
            if (now - lastAt < 200) return;
            lastAt = now;
            setStats(st);
        });
    }, [toyRef]);

    const zoom = stats.zoom < 1000 ? stats.zoom.toFixed(1) : stats.zoom.toExponential(1);

    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas pixel-canvas" />
            <ToyPanel>
                <ToySelect
                    label="Go to"
                    value={place}
                    options={[...PLACES.map((p) => ({ value: p.id, label: p.label })), { value: "custom", label: "Where you are" }]}
                    onChange={(id) => {
                        setPlace(id);
                        const p = PLACES.find((x) => x.id === id);
                        if (p) toy()?.go(p);
                    }}
                />
                <ToySlider label="Detail" value={iters} min={50} max={2000} step={50} onChange={(v) => (setIters(v), toy()?.set("iters", v))} format={(v) => v + " steps"} />
                <ToySlider label="Bands" value={bands} min={0.2} max={4} step={0.1} onChange={(v) => (setBands(v), toy()?.set("bands", v))} format={(v) => v.toFixed(1)} />
                <ToyButtons
                    items={[
                        { id: "julia", label: "Julia of centre", onClick: () => (setPlace("custom"), toy()?.juliaHere()) },
                        { id: "home", label: "Reset", onClick: () => (setPlace("home"), toy()?.go(PLACES[0])) },
                    ]}
                />
                <ToyReadout
                    items={[
                        ["Zoom", zoom + "×"],
                        ["Set", stats.julia ? `Julia ${stats.julia[0].toFixed(3)}${stats.julia[1] < 0 ? "−" : "+"}${Math.abs(stats.julia[1]).toFixed(3)}i` : "Mandelbrot"],
                        ["Render", stats.done ? "done" : "drawing…"],
                    ]}
                />
            </ToyPanel>
            <ToyTools tools={[]} hint="Click to zoom in · right-click out · drag to pan · scroll to zoom" />
        </>
    );
}
