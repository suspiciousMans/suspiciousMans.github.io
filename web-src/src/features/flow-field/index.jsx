import { useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToyButtons } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// Thousands of specks drifting through a field of Perlin noise. The noise
// gives every point a direction that changes smoothly across space and
// slowly over time; each speck follows it and leaves ink behind, so the
// hidden currents draw themselves. Press to push the specks away.
const CELL = 2;
const TAU = Math.PI * 2;

// Classic 3D Perlin noise, returning roughly -1..1.
function makeNoise(seed) {
    const p = new Uint8Array(512);
    const perm = Array.from({ length: 256 }, (_, i) => i);
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a, b, t) => a + (b - a) * t;
    const grad = (hash, x, y, z) => {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    };
    return (x, y, z) => {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);
        const u = fade(x);
        const v = fade(y);
        const w = fade(z);
        const A = p[X] + Y;
        const AA = p[A] + Z;
        const AB = p[A + 1] + Z;
        const B = p[X + 1] + Y;
        const BA = p[B] + Z;
        const BB = p[B + 1] + Z;
        return lerp(
            lerp(lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u), lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
            lerp(lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u), lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
            w
        );
    };
}

const BAYER = Float32Array.from([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], (v) => (v + 0.5) / 16);

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let buf = new Float32Array(0);
    let img = null;
    let noise = makeNoise(1 + Math.floor(Math.random() * 1e6));
    let px = new Float32Array(0);
    let py = new Float32Array(0);
    let life = new Float32Array(0);
    let z = 0;
    let playing = !reduced;
    let push = null;
    const opts = { count: 3000, scale: 1, speed: 1, fade: 0.5, drift: 0.3, turns: 2, look: "dither" };

    function spawn(i) {
        px[i] = Math.random() * w;
        py[i] = Math.random() * h;
        life[i] = 60 + Math.random() * 240;
    }

    function alloc() {
        const n = opts.count;
        px = new Float32Array(n);
        py = new Float32Array(n);
        life = new Float32Array(n);
        for (let i = 0; i < n; i++) spawn(i);
    }

    function step(dt) {
        const k = 0.012 / opts.scale;
        const sp = opts.speed * 0.8;
        const turns = opts.turns * TAU;
        for (let i = 0; i < px.length; i++) {
            const a = noise(px[i] * k, py[i] * k, z) * turns;
            let vx = Math.cos(a) * sp;
            let vy = Math.sin(a) * sp;
            if (push) {
                const dx = px[i] - push.x;
                const dy = py[i] - push.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < 1600 && d2 > 0.01) {
                    const f = ((push.button === 2 ? -1 : 1) * (1600 - d2)) / 1600 / Math.sqrt(d2);
                    vx += dx * f * 3;
                    vy += dy * f * 3;
                }
            }
            px[i] += vx;
            py[i] += vy;
            life[i] -= 1;
            if (life[i] <= 0 || px[i] < 0 || py[i] < 0 || px[i] >= w || py[i] >= h) {
                spawn(i);
                continue;
            }
            const o = (py[i] | 0) * w + (px[i] | 0);
            buf[o] = Math.min(1.5, buf[o] + 0.18);
        }
        z += dt * opts.drift * 0.2;
        // Per second, keep (1 - fade) of the ink.
        const keep = Math.pow(Math.max(0.001, 1 - opts.fade * 0.9), dt);
        for (let i = 0; i < buf.length; i++) buf[i] *= keep;
    }

    function draw() {
        const [r, g, b] = ink().split(",").map(Number);
        const d = img.data;
        const dither = opts.look === "dither";
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                const o = i * 4;
                const c = Math.min(1, buf[i]);
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
            buf = new Float32Array(w * h);
            img = ctx.createImageData(w, h);
            alloc();
        },
        frame(t, dt) {
            if (playing || push) step(dt);
            draw();
        },
        down(p) {
            push = p;
        },
        up() {
            push = null;
        },
        running: () => playing,
        set(key, v) {
            opts[key] = v;
            if (key === "count") alloc();
            wake();
        },
        reseed() {
            noise = makeNoise(1 + Math.floor(Math.random() * 1e6));
            buf.fill(0);
            wake();
        },
        clear() {
            buf.fill(0);
            wake();
        },
        play(on) {
            playing = on;
            wake();
        },
    };
}

export default function FlowField() {
    const { canvasRef, toyRef } = useToy(create, { cell: CELL });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [s, setS] = useState({ count: 3000, scale: 1, speed: 1, fade: 0.5, drift: 0.3, turns: 2, look: "dither" });
    const [playing, setPlaying] = useState(!reduced);
    const toy = () => toyRef.current;
    const set = (key) => (v) => {
        setS((o) => ({ ...o, [key]: v }));
        toy()?.set(key, v);
    };

    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas pixel-canvas" />
            <ToyPanel>
                <ToySlider label="Specks" value={s.count} min={200} max={12000} step={100} onChange={set("count")} format={(v) => v.toLocaleString()} />
                <ToySlider label="Current size" value={s.scale} min={0.3} max={4} step={0.1} onChange={set("scale")} format={(v) => v.toFixed(1) + "×"} />
                <ToySlider label="Twist" value={s.turns} min={0.25} max={6} step={0.25} onChange={set("turns")} format={(v) => v.toFixed(2)} />
                <ToySlider label="Speed" value={s.speed} min={0.2} max={3} step={0.1} onChange={set("speed")} format={(v) => v.toFixed(1) + "×"} />
                <ToySlider label="Drift" value={s.drift} min={0} max={2} step={0.05} onChange={set("drift")} format={(v) => (v ? v.toFixed(2) : "frozen")} />
                <ToySlider label="Ink fade" value={s.fade} min={0.02} max={1} step={0.02} onChange={set("fade")} format={(v) => v.toFixed(2)} />
                <ToyButtons
                    items={[
                        { id: "dither", label: "Dither", active: s.look === "dither", onClick: () => set("look")("dither") },
                        { id: "smooth", label: "Smooth", active: s.look === "smooth", onClick: () => set("look")("smooth") },
                    ]}
                />
                <ToyButtons
                    items={[
                        { id: "play", label: playing ? "Pause" : "Play", onClick: () => (setPlaying(!playing), toy()?.play(!playing)) },
                        { id: "reseed", label: "New field", onClick: () => toy()?.reseed() },
                        { id: "clear", label: "Clear", onClick: () => toy()?.clear() },
                    ]}
                />
            </ToyPanel>
            <ToyTools tools={[{ id: "reseed", label: "New field", onClick: () => toy()?.reseed() }]} hint="Press to push the specks away · right-press to pull them in" />
        </>
    );
}
