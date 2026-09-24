import { useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToySelect, ToyButtons } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// Gray-Scott reaction-diffusion. Two chemicals spread at different rates;
// V eats U to make more of itself and is slowly removed. Two numbers, feed
// (how fast U is topped up) and kill (how fast V is removed), decide
// whether you get coral, dividing cells, fingerprints or worms.
const CELL = 3;
const DU = 1.0;
const DV = 0.5;

export const PRESETS = [
    { id: "coral", label: "Coral", f: 0.0545, k: 0.062 },
    { id: "mitosis", label: "Mitosis", f: 0.0367, k: 0.0649 },
    { id: "fingerprint", label: "Fingerprint", f: 0.037, k: 0.06 },
    { id: "worms", label: "Worms", f: 0.058, k: 0.065 },
    { id: "maze", label: "Maze", f: 0.029, k: 0.057 },
    { id: "solitons", label: "Solitons", f: 0.03, k: 0.062 },
    { id: "chaos", label: "Chaos", f: 0.026, k: 0.051 },
];

const BAYER = Float32Array.from(
    [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5],
    (v) => (v + 0.5) / 16
);

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let u = new Float32Array(0);
    let v = new Float32Array(0);
    let u2 = new Float32Array(0);
    let v2 = new Float32Array(0);
    let img = null;
    let brush = null;
    const opts = { f: PRESETS[0].f, k: PRESETS[0].k, speed: 10, size: 6, look: "dither" };
    let playing = !reduced;

    function reset() {
        u.fill(1);
        v.fill(0);
    }

    function blob(cx, cy, r, erase) {
        for (let y = -r; y <= r; y++) {
            for (let x = -r; x <= r; x++) {
                if (x * x + y * y > r * r) continue;
                const gx = (Math.round(cx) + x + w) % w;
                const gy = (Math.round(cy) + y + h) % h;
                const i = gy * w + gx;
                if (erase) {
                    u[i] = 1;
                    v[i] = 0;
                } else {
                    u[i] = 0.5;
                    v[i] = 0.25 + Math.random() * 0.05;
                }
            }
        }
    }

    function seed() {
        const n = Math.max(6, Math.round((w * h) / 2500));
        for (let i = 0; i < n; i++) blob(Math.random() * w, Math.random() * h, 2 + Math.floor(Math.random() * 4), false);
    }

    function step() {
        const { f, k } = opts;
        for (let y = 0; y < h; y++) {
            const yu = (y - 1 + h) % h;
            const yd = (y + 1) % h;
            for (let x = 0; x < w; x++) {
                const xl = (x - 1 + w) % w;
                const xr = (x + 1) % w;
                const i = y * w + x;
                const a = u[i];
                const b = v[i];
                const lu =
                    0.2 * (u[y * w + xl] + u[y * w + xr] + u[yu * w + x] + u[yd * w + x]) +
                    0.05 * (u[yu * w + xl] + u[yu * w + xr] + u[yd * w + xl] + u[yd * w + xr]) -
                    a;
                const lv =
                    0.2 * (v[y * w + xl] + v[y * w + xr] + v[yu * w + x] + v[yd * w + x]) +
                    0.05 * (v[yu * w + xl] + v[yu * w + xr] + v[yd * w + xl] + v[yd * w + xr]) -
                    b;
                const abb = a * b * b;
                u2[i] = a + DU * lu - abb + f * (1 - a);
                v2[i] = b + DV * lv + abb - (k + f) * b;
            }
        }
        [u, u2] = [u2, u];
        [v, v2] = [v2, v];
    }

    function draw() {
        const [r, g, bl] = ink().split(",").map(Number);
        const d = img.data;
        const dither = opts.look === "dither";
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                const o = i * 4;
                const c = Math.min(1, Math.max(0, (v[i] - 0.05) * 3.2));
                d[o] = r;
                d[o + 1] = g;
                d[o + 2] = bl;
                d[o + 3] = dither ? (c > BAYER[(y & 3) * 4 + (x & 3)] ? 255 : 0) : c * 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    return {
        resize(nw, nh) {
            w = nw;
            h = nh;
            u = new Float32Array(w * h);
            v = new Float32Array(w * h);
            u2 = new Float32Array(w * h);
            v2 = new Float32Array(w * h);
            img = ctx.createImageData(w, h);
            reset();
            seed();
        },
        frame() {
            if (brush) blob(brush.x, brush.y, opts.size, brush.button === 2);
            if (playing) for (let s = 0; s < opts.speed; s++) step();
            draw();
        },
        down(p) {
            brush = p;
        },
        up() {
            brush = null;
        },
        running: () => playing,
        set(key, value) {
            opts[key] = value;
        },
        play(on) {
            playing = on;
            wake();
        },
        stepOnce() {
            for (let s = 0; s < opts.speed; s++) step();
            wake();
        },
        seed() {
            seed();
            wake();
        },
        clear() {
            reset();
            wake();
        },
    };
}

export default function ReactionDiffusion() {
    const { canvasRef, toyRef } = useToy(create, { cell: CELL });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [preset, setPreset] = useState(PRESETS[0].id);
    const [f, setF] = useState(PRESETS[0].f);
    const [k, setK] = useState(PRESETS[0].k);
    const [speed, setSpeed] = useState(10);
    const [size, setSize] = useState(6);
    const [look, setLook] = useState("dither");
    const [playing, setPlaying] = useState(!reduced);
    const toy = () => toyRef.current;

    const pick = (id) => {
        const p = PRESETS.find((x) => x.id === id);
        setPreset(id);
        if (!p) return;
        setF(p.f);
        setK(p.k);
        toy()?.set("f", p.f);
        toy()?.set("k", p.k);
        // Each pattern grows from fresh seeds; some (like Mitosis) die out
        // if dropped onto another pattern's full-grown field.
        toy()?.clear();
        toy()?.seed();
    };
    const tune = (key, setter) => (val) => {
        setter(val);
        setPreset("custom");
        toy()?.set(key, val);
    };

    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas pixel-canvas" />
            <ToyPanel>
                <ToySelect
                    label="Pattern"
                    value={preset}
                    options={[...PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: "custom", label: "Custom" }]}
                    onChange={pick}
                />
                <ToySlider label="Feed" value={f} min={0.01} max={0.1} step={0.0005} onChange={tune("f", setF)} format={(x) => x.toFixed(4)} />
                <ToySlider label="Kill" value={k} min={0.045} max={0.07} step={0.0005} onChange={tune("k", setK)} format={(x) => x.toFixed(4)} />
                <ToySlider
                    label="Speed"
                    value={speed}
                    min={1}
                    max={24}
                    onChange={(x) => {
                        setSpeed(x);
                        toy()?.set("speed", x);
                    }}
                    format={(x) => x + " steps"}
                />
                <ToySlider
                    label="Brush"
                    value={size}
                    min={2}
                    max={16}
                    onChange={(x) => {
                        setSize(x);
                        toy()?.set("size", x);
                    }}
                />
                <ToyButtons
                    items={[
                        { id: "dither", label: "Dither", active: look === "dither", onClick: () => (setLook("dither"), toy()?.set("look", "dither")) },
                        { id: "smooth", label: "Smooth", active: look === "smooth", onClick: () => (setLook("smooth"), toy()?.set("look", "smooth")) },
                    ]}
                />
                <ToyButtons
                    items={[
                        { id: "play", label: playing ? "Pause" : "Play", onClick: () => (setPlaying(!playing), toy()?.play(!playing)) },
                        { id: "step", label: "Step", onClick: () => toy()?.stepOnce() },
                        { id: "seed", label: "Seed", onClick: () => toy()?.seed() },
                        { id: "clear", label: "Clear", onClick: () => toy()?.clear() },
                    ]}
                />
            </ToyPanel>
            <ToyTools tools={[]} hint="Drag to seed · right-drag to wipe" />
        </>
    );
}
