import { useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToyButtons } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// Stable fluids (Jos Stam, 1999) on a coarse grid: velocity is diffused,
// carried along by itself and then made incompressible, and dye rides the
// flow. Vorticity confinement puts back the small swirls the grid smooths
// out. Drag to push the fluid and pour in dye.
const CELL = 5;
const ITERS = 16;

const BAYER = Float32Array.from([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], (v) => (v + 0.5) / 16);

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let W = 0; // row stride, with a one-cell border all round
    let u, v, u0, v0, dye, dye0, curl;
    let img = null;
    let drag = null;
    let prev = null;
    let playing = !reduced;
    const opts = { visc: 0, fade: 0.7, vort: 12, force: 1, stir: true, look: "dither" };

    const IX = (x, y) => x + W * y;

    function alloc() {
        W = w + 2;
        const n = W * (h + 2);
        [u, v, u0, v0, dye, dye0, curl] = Array.from({ length: 7 }, () => new Float32Array(n));
    }

    function bound(b, x) {
        for (let i = 1; i <= w; i++) {
            x[IX(i, 0)] = b === 2 ? -x[IX(i, 1)] : x[IX(i, 1)];
            x[IX(i, h + 1)] = b === 2 ? -x[IX(i, h)] : x[IX(i, h)];
        }
        for (let j = 1; j <= h; j++) {
            x[IX(0, j)] = b === 1 ? -x[IX(1, j)] : x[IX(1, j)];
            x[IX(w + 1, j)] = b === 1 ? -x[IX(w, j)] : x[IX(w, j)];
        }
        x[IX(0, 0)] = 0.5 * (x[IX(1, 0)] + x[IX(0, 1)]);
        x[IX(0, h + 1)] = 0.5 * (x[IX(1, h + 1)] + x[IX(0, h)]);
        x[IX(w + 1, 0)] = 0.5 * (x[IX(w, 0)] + x[IX(w + 1, 1)]);
        x[IX(w + 1, h + 1)] = 0.5 * (x[IX(w, h + 1)] + x[IX(w + 1, h)]);
    }

    function solve(b, x, x0, a, c) {
        const inv = 1 / c;
        for (let k = 0; k < ITERS; k++) {
            for (let j = 1; j <= h; j++) {
                let i0 = IX(1, j);
                for (let i = 1; i <= w; i++, i0++) {
                    x[i0] = (x0[i0] + a * (x[i0 - 1] + x[i0 + 1] + x[i0 - W] + x[i0 + W])) * inv;
                }
            }
            bound(b, x);
        }
    }

    function diffuse(b, x, x0, rate, dt) {
        const a = dt * rate;
        solve(b, x, x0, a, 1 + 4 * a);
    }

    // Trace each cell back along the velocity and sample what was there.
    function advect(b, d, d0, uu, vv, dt) {
        for (let j = 1; j <= h; j++) {
            for (let i = 1; i <= w; i++) {
                const id = IX(i, j);
                let x = i - dt * uu[id];
                let y = j - dt * vv[id];
                x = Math.min(w + 0.5, Math.max(0.5, x));
                y = Math.min(h + 0.5, Math.max(0.5, y));
                const i0 = Math.floor(x);
                const j0 = Math.floor(y);
                const s1 = x - i0;
                const t1 = y - j0;
                const s0 = 1 - s1;
                const t0 = 1 - t1;
                d[id] =
                    s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j0 + 1)]) +
                    s1 * (t0 * d0[IX(i0 + 1, j0)] + t1 * d0[IX(i0 + 1, j0 + 1)]);
            }
        }
        bound(b, d);
    }

    // Remove the part of the flow that compresses or expands.
    function project(p, div) {
        for (let j = 1; j <= h; j++) {
            for (let i = 1; i <= w; i++) {
                const id = IX(i, j);
                div[id] = -0.5 * (u[id + 1] - u[id - 1] + v[id + W] - v[id - W]);
                p[id] = 0;
            }
        }
        bound(0, div);
        bound(0, p);
        solve(0, p, div, 1, 4);
        for (let j = 1; j <= h; j++) {
            for (let i = 1; i <= w; i++) {
                const id = IX(i, j);
                u[id] -= 0.5 * (p[id + 1] - p[id - 1]);
                v[id] -= 0.5 * (p[id + W] - p[id - W]);
            }
        }
        bound(1, u);
        bound(2, v);
    }

    function confine(dt) {
        // The slider's 0-40 maps to 0-0.8 in grid units; more than that and the
        // swirls feed on themselves until the flow blows up.
        const eps = opts.vort * 0.02;
        if (!eps) return;
        for (let j = 1; j <= h; j++) {
            for (let i = 1; i <= w; i++) {
                const id = IX(i, j);
                curl[id] = 0.5 * (v[id + 1] - v[id - 1] - (u[id + W] - u[id - W]));
            }
        }
        for (let j = 2; j < h; j++) {
            for (let i = 2; i < w; i++) {
                const id = IX(i, j);
                const nx = 0.5 * (Math.abs(curl[id + 1]) - Math.abs(curl[id - 1]));
                const ny = 0.5 * (Math.abs(curl[id + W]) - Math.abs(curl[id - W]));
                const len = Math.hypot(nx, ny) + 1e-5;
                u[id] += (eps * dt * (ny / len) * curl[id]);
                v[id] -= (eps * dt * (nx / len) * curl[id]);
            }
        }
    }

    function splat(x, y, fx, fy, amount, r) {
        const cx = Math.round(x) + 1;
        const cy = Math.round(y) + 1;
        for (let j = -r; j <= r; j++) {
            for (let i = -r; i <= r; i++) {
                const gx = cx + i;
                const gy = cy + j;
                if (gx < 1 || gy < 1 || gx > w || gy > h) continue;
                const k = Math.exp(-(i * i + j * j) / (r * r * 0.4));
                const id = IX(gx, gy);
                u[id] += fx * k;
                v[id] += fy * k;
                dye[id] = Math.min(3, dye[id] + amount * k);
            }
        }
    }

    function step(dt, t) {
        // Forces: the pointer, then the two stirrers if they're on.
        if (drag) {
            const from = prev || drag;
            const fx = (drag.x - from.x) / Math.max(dt, 1 / 120);
            const fy = (drag.y - from.y) / Math.max(dt, 1 / 120);
            const n = Math.max(1, Math.ceil(Math.hypot(drag.x - from.x, drag.y - from.y) / 2));
            for (let s = 1; s <= n; s++) {
                const px = from.x + ((drag.x - from.x) * s) / n;
                const py = from.y + ((drag.y - from.y) * s) / n;
                splat(px, py, (fx * opts.force * 0.15) / n, (fy * opts.force * 0.15) / n, drag.button === 2 ? 0 : 0.9 / n, 4);
            }
            prev = { x: drag.x, y: drag.y };
        }
        if (opts.stir) {
            for (let e = 0; e < 2; e++) {
                const a = t * 0.35 + e * Math.PI;
                const x = w / 2 + Math.cos(a) * w * 0.28;
                const y = h / 2 + Math.sin(a * 1.3) * h * 0.28;
                const dir = a + Math.PI / 2 + Math.sin(t * 0.8 + e) * 0.8;
                splat(x, y, Math.cos(dir) * 3 * opts.force, Math.sin(dir) * 3 * opts.force, 0.15, 3);
            }
        }

        confine(dt);
        if (opts.visc > 0) {
            [u, u0] = [u0, u];
            [v, v0] = [v0, v];
            diffuse(1, u, u0, opts.visc, dt);
            diffuse(2, v, v0, opts.visc, dt);
        }
        project(u0, v0);
        [u, u0] = [u0, u];
        [v, v0] = [v0, v];
        advect(1, u, u0, u0, v0, dt);
        advect(2, v, v0, u0, v0, dt);
        project(u0, v0);

        [dye, dye0] = [dye0, dye];
        advect(0, dye, dye0, u, v, dt);
        // dt runs at ~30 per second, so this keeps (1 - fade / 2) of the dye each second.
        const keep = Math.pow(1 - opts.fade * 0.5, dt / 30);
        for (let i = 0; i < dye.length; i++) dye[i] *= keep;
    }

    function draw() {
        const [r, g, b] = ink().split(",").map(Number);
        const d = img.data;
        const dither = opts.look === "dither";
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                // A soft curve, so thin wisps still show and thick dye doesn't clip.
                const c = 1 - Math.exp(-dye[IX(x + 1, y + 1)] * 3);
                const o = (y * w + x) * 4;
                d[o] = r;
                d[o + 1] = g;
                d[o + 2] = b;
                d[o + 3] = dither ? (c > BAYER[(y & 3) * 4 + (x & 3)] ? 255 : 0) : c * 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    return {
        resize(nw, nh) {
            w = nw;
            h = nh;
            alloc();
            img = ctx.createImageData(w, h);
        },
        frame(t, dt) {
            if (playing || drag) step(Math.min(dt, 1 / 30) * 60 * 0.5, t);
            draw();
        },
        down(p) {
            drag = p;
            prev = null;
        },
        up() {
            drag = null;
            prev = null;
        },
        running: () => playing,
        set(key, value) {
            opts[key] = value;
            wake();
        },
        play(on) {
            playing = on;
            wake();
        },
        clear() {
            [u, v, u0, v0, dye, dye0].forEach((a) => a.fill(0));
            wake();
        },
    };
}

export default function Fluid() {
    const { canvasRef, toyRef } = useToy(create, { cell: CELL });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [s, setS] = useState({ visc: 0, fade: 0.7, vort: 12, force: 1, stir: true, look: "dither" });
    const [playing, setPlaying] = useState(!reduced);
    const set = (key) => (val) => {
        setS((o) => ({ ...o, [key]: val }));
        toyRef.current?.set(key, val);
    };

    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas pixel-canvas" />
            <ToyPanel>
                <ToySlider label="Viscosity" value={s.visc} min={0} max={0.5} step={0.01} onChange={set("visc")} format={(x) => (x ? x.toFixed(2) : "none")} />
                <ToySlider label="Swirl" value={s.vort} min={0} max={40} onChange={set("vort")} />
                <ToySlider label="Dye fade" value={s.fade} min={0} max={1.5} step={0.05} onChange={set("fade")} format={(x) => x.toFixed(2)} />
                <ToySlider label="Push" value={s.force} min={0.2} max={3} step={0.1} onChange={set("force")} format={(x) => x.toFixed(1) + "×"} />
                <ToyButtons
                    items={[
                        { id: "dither", label: "Dither", active: s.look === "dither", onClick: () => set("look")("dither") },
                        { id: "smooth", label: "Smooth", active: s.look === "smooth", onClick: () => set("look")("smooth") },
                    ]}
                />
                <ToyButtons
                    items={[
                        { id: "play", label: playing ? "Pause" : "Play", onClick: () => (setPlaying(!playing), toyRef.current?.play(!playing)) },
                        { id: "stir", label: "Stirrers", active: s.stir, onClick: () => set("stir")(!s.stir) },
                        { id: "clear", label: "Clear", onClick: () => toyRef.current?.clear() },
                    ]}
                />
            </ToyPanel>
            <ToyTools tools={[]} hint="Drag to stir and pour · right-drag to stir without dye" />
        </>
    );
}
