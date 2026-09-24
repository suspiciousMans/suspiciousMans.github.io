import { useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToyButtons } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// Metaballs: every blob gives off a field that fades with distance, the
// fields add up, and wherever the total passes a threshold is "inside".
// Two blobs that drift close melt together like a lava lamp. Grab one to
// drag it, click empty space to add one, right-click to pop one.
const CELL = 3;
const TAU = Math.PI * 2;

const BAYER = Float32Array.from([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], (v) => (v + 0.5) / 16);

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let img = null;
    let field = new Float32Array(0);
    let balls = [];
    let playing = !reduced;
    let grab = null;
    const opts = { count: 7, threshold: 1, glow: 0.5, speed: 1, look: "solid", gravity: 0 };

    function ball(x, y) {
        const r = Math.min(w, h) * (0.06 + Math.random() * 0.07);
        const a = Math.random() * TAU;
        const v = 8 + Math.random() * 14;
        return { x, y, r, vx: Math.cos(a) * v, vy: Math.sin(a) * v };
    }

    function fill(n) {
        balls = [];
        for (let i = 0; i < n; i++) balls.push(ball(Math.random() * w, Math.random() * h));
    }

    function move(dt) {
        for (const b of balls) {
            if (b === grab?.b) continue;
            b.vy += opts.gravity * 30 * dt;
            b.x += b.vx * dt * opts.speed;
            b.y += b.vy * dt * opts.speed;
            if (b.x < b.r * 0.5 && b.vx < 0) b.vx *= -1;
            if (b.x > w - b.r * 0.5 && b.vx > 0) b.vx *= -1;
            if (b.y < b.r * 0.5 && b.vy < 0) b.vy *= -1;
            if (b.y > h - b.r * 0.5 && b.vy > 0) {
                b.vy *= opts.gravity ? -0.9 : -1;
                b.y = h - b.r * 0.5;
            }
        }
    }

    function compute() {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let s = 0;
                for (const b of balls) {
                    const dx = x - b.x;
                    const dy = y - b.y;
                    s += (b.r * b.r) / (dx * dx + dy * dy + 1);
                }
                field[y * w + x] = s;
            }
        }
    }

    function draw() {
        const [r, g, bl] = ink().split(",").map(Number);
        const d = img.data;
        const th = opts.threshold;
        const outline = opts.look === "outline";
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                const f = field[i];
                const o = i * 4;
                d[o] = r;
                d[o + 1] = g;
                d[o + 2] = bl;
                let a = 0;
                if (outline) {
                    // A cell is on the edge if the threshold falls between it and a neighbour.
                    const e = x + 1 < w ? field[i + 1] : f;
                    const s = y + 1 < h ? field[i + w] : f;
                    if ((f >= th) !== (e >= th) || (f >= th) !== (s >= th)) a = 255;
                } else if (f >= th) a = 255;
                if (!a && opts.glow > 0) {
                    const c = (f / th) ** 3 * opts.glow;
                    if (c > BAYER[(y & 3) * 4 + (x & 3)]) a = 110;
                }
                d[o + 3] = a;
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    function hit(p) {
        let best = null;
        let bd = Infinity;
        for (const b of balls) {
            const d = Math.hypot(b.x - p.x, b.y - p.y);
            if (d < b.r * 1.1 && d < bd) (best = b), (bd = d);
        }
        return best;
    }

    return {
        resize(nw, nh) {
            const first = !w;
            const sx = nw / (w || nw);
            const sy = nh / (h || nh);
            w = nw;
            h = nh;
            field = new Float32Array(w * h);
            img = ctx.createImageData(w, h);
            if (first) fill(opts.count);
            else for (const b of balls) (b.x *= sx), (b.y *= sy);
        },
        frame(t, dt) {
            if (playing) move(dt);
            compute();
            draw();
        },
        down(p) {
            const b = hit(p);
            if (p.button === 2) {
                if (b) balls = balls.filter((x) => x !== b);
                return;
            }
            if (b) grab = { b, dx: b.x - p.x, dy: b.y - p.y, lx: p.x, ly: p.y, t: performance.now() };
            else if (balls.length < 24) {
                const nb = ball(p.x, p.y);
                balls.push(nb);
                grab = { b: nb, dx: 0, dy: 0, lx: p.x, ly: p.y, t: performance.now() };
            }
        },
        move(p) {
            if (!grab || !p.down) return;
            const now = performance.now();
            const dt = Math.max(0.008, (now - grab.t) / 1000);
            // Remember the throw so the blob flies off when let go.
            grab.b.vx = ((p.x - grab.lx) / dt) * 0.5;
            grab.b.vy = ((p.y - grab.ly) / dt) * 0.5;
            grab.b.x = p.x + grab.dx;
            grab.b.y = p.y + grab.dy;
            grab.lx = p.x;
            grab.ly = p.y;
            grab.t = now;
        },
        up() {
            if (grab) {
                const b = grab.b;
                const v = Math.hypot(b.vx, b.vy);
                if (v > 120) (b.vx *= 120 / v), (b.vy *= 120 / v);
            }
            grab = null;
        },
        running: () => playing,
        set(key, v) {
            opts[key] = v;
            if (key === "count") {
                while (balls.length < v) balls.push(ball(Math.random() * w, Math.random() * h));
                if (balls.length > v) balls.length = v;
            }
            wake();
        },
        shuffle() {
            fill(balls.length || opts.count);
            wake();
        },
        play(on) {
            playing = on;
            wake();
        },
    };
}

export default function Metaballs() {
    const { canvasRef, toyRef } = useToy(create, { cell: CELL });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [s, setS] = useState({ count: 7, threshold: 1, glow: 0.5, speed: 1, look: "solid", gravity: 0 });
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
                <ToySlider label="Blobs" value={s.count} min={1} max={24} onChange={set("count")} />
                <ToySlider label="Threshold" value={s.threshold} min={0.3} max={3} step={0.05} onChange={set("threshold")} format={(v) => v.toFixed(2)} />
                <ToySlider label="Glow" value={s.glow} min={0} max={1.5} step={0.05} onChange={set("glow")} format={(v) => (v ? v.toFixed(2) : "off")} />
                <ToySlider label="Speed" value={s.speed} min={0} max={4} step={0.1} onChange={set("speed")} format={(v) => v.toFixed(1) + "×"} />
                <ToySlider label="Gravity" value={s.gravity} min={0} max={3} step={0.1} onChange={set("gravity")} format={(v) => (v ? v.toFixed(1) : "off")} />
                <ToyButtons
                    items={[
                        { id: "solid", label: "Solid", active: s.look === "solid", onClick: () => set("look")("solid") },
                        { id: "outline", label: "Outline", active: s.look === "outline", onClick: () => set("look")("outline") },
                    ]}
                />
                <ToyButtons
                    items={[
                        { id: "play", label: playing ? "Pause" : "Play", onClick: () => (setPlaying(!playing), toy()?.play(!playing)) },
                        { id: "shuffle", label: "Scatter", onClick: () => toy()?.shuffle() },
                    ]}
                />
            </ToyPanel>
            <ToyTools tools={[]} hint="Drag a blob · click to add one · right-click to pop" />
        </>
    );
}
