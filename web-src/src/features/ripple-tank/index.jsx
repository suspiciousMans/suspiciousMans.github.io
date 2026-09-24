import { useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToySelect, ToyButtons } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// A ripple tank: the 2D wave equation on a grid. Each cell is pulled toward
// the average of its neighbours, so a poke spreads out as a ring. Walls
// reflect, slits diffract, and two sources interfere. A soft sponge round
// the edge soaks up waves so they don't bounce back off the frame.
const CELL = 3;
const SPONGE = 18;

const BAYER = Float32Array.from([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], (v) => (v + 0.5) / 16);

export const SCENES = [
    { id: "slits", label: "Double slit" },
    { id: "slit", label: "Single slit" },
    { id: "pair", label: "Two sources" },
    { id: "mirror", label: "Curved mirror" },
    { id: "empty", label: "Empty tank" },
];

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let cur, prev, wall, sponge;
    let img = null;
    let sources = []; // cell indices that oscillate
    let phase = 0;
    let playing = !reduced;
    let tool = "poke";
    let scene = "slits";
    let drag = null;
    let last = null;
    const opts = { freq: 3, speed: 0.45, damp: 0.001, look: "crests" };

    function alloc() {
        const n = w * h;
        cur = new Float32Array(n);
        prev = new Float32Array(n);
        wall = new Uint8Array(n);
        sponge = new Float32Array(n);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const d = Math.min(x, y, w - 1 - x, h - 1 - y);
                sponge[y * w + x] = d < SPONGE ? ((SPONGE - d) / SPONGE) ** 2 * 0.2 : 0;
            }
        }
    }

    function load(id) {
        scene = id;
        cur.fill(0);
        prev.fill(0);
        wall.fill(0);
        sources = [];
        const wx = Math.round(w * 0.38);
        const line = () => {
            for (let y = SPONGE; y < h - SPONGE; y++) sources.push(y * w + SPONGE + 2);
        };
        const barrier = (gaps) => {
            for (let y = 0; y < h; y++) {
                if (gaps.some(([a, b]) => y >= a && y <= b)) continue;
                for (let t = 0; t < 3; t++) wall[y * w + wx + t] = 1;
            }
        };
        const gap = Math.max(3, Math.round(h * 0.025));
        if (id === "slits") {
            const c = h / 2;
            const s = Math.round(h * 0.09);
            barrier([
                [c - s - gap, c - s + gap],
                [c + s - gap, c + s + gap],
            ]);
            line();
        } else if (id === "slit") {
            barrier([[h / 2 - gap * 2, h / 2 + gap * 2]]);
            line();
        } else if (id === "pair") {
            const s = Math.round(h * 0.1);
            for (const y of [h / 2 - s, h / 2 + s]) sources.push(Math.round(y) * w + Math.round(w * 0.3));
        } else if (id === "mirror") {
            // A parabola opening left, with a source near its focus.
            const vx = Math.round(w * 0.78);
            const a = 0.012 * (240 / h);
            for (let y = 0; y < h; y++) {
                const dy = y - h / 2;
                const x = Math.round(vx - a * dy * dy);
                if (x < SPONGE) continue;
                for (let t = 0; t < 3; t++) if (x + t < w) wall[y * w + x + t] = 1;
            }
            const f = 1 / (4 * a);
            sources.push(Math.round(h / 2) * w + Math.round(vx - f));
        }
    }

    function step() {
        const c2 = opts.speed;
        const damp = opts.damp;
        // Write the next state over `prev`, which each cell only reads for itself.
        for (let y = 1; y < h - 1; y++) {
            let i = y * w + 1;
            for (let x = 1; x < w - 1; x++, i++) {
                if (wall[i]) {
                    prev[i] = 0;
                    continue;
                }
                const lap = cur[i - 1] + cur[i + 1] + cur[i - w] + cur[i + w] - 4 * cur[i];
                prev[i] = (2 * cur[i] - prev[i] + c2 * lap) * (1 - damp - sponge[i]);
            }
        }
        phase += (opts.freq * Math.PI * 2) / 60;
        const s = Math.sin(phase);
        for (const i of sources) prev[i] = s;
        [cur, prev] = [prev, cur];
    }

    function poke(x, y, amount) {
        const r = 3;
        const cx = Math.round(x);
        const cy = Math.round(y);
        for (let j = -r; j <= r; j++) {
            for (let i = -r; i <= r; i++) {
                const gx = cx + i;
                const gy = cy + j;
                if (gx < 1 || gy < 1 || gx >= w - 1 || gy >= h - 1) continue;
                const k = Math.exp(-(i * i + j * j) / 4);
                cur[gy * w + gx] += amount * k;
            }
        }
    }

    function paintWall(x, y, on) {
        const r = on ? 1 : 3;
        for (let j = -r; j <= r; j++) {
            for (let i = -r; i <= r; i++) {
                const gx = Math.round(x) + i;
                const gy = Math.round(y) + j;
                if (gx < 0 || gy < 0 || gx >= w || gy >= h) continue;
                const id = gy * w + gx;
                wall[id] = on ? 1 : 0;
                if (!on) sources = sources.filter((s) => s !== id);
            }
        }
    }

    function apply(p, from) {
        const n = Math.max(1, Math.ceil(Math.hypot(p.x - from.x, p.y - from.y)));
        for (let s = 1; s <= n; s++) {
            const x = from.x + ((p.x - from.x) * s) / n;
            const y = from.y + ((p.y - from.y) * s) / n;
            if (tool === "wall") paintWall(x, y, p.button !== 2);
            else if (tool === "erase") paintWall(x, y, false);
        }
    }

    function draw() {
        const [r, g, b] = ink().split(",").map(Number);
        const d = img.data;
        const signed = opts.look === "height";
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                const o = i * 4;
                d[o] = r;
                d[o + 1] = g;
                d[o + 2] = b;
                if (wall[i]) {
                    d[o + 3] = 255;
                    continue;
                }
                const v = cur[i];
                const c = signed ? 0.5 + v * 0.45 : v * 0.9;
                d[o + 3] = c > BAYER[(y & 3) * 4 + (x & 3)] ? (signed ? 200 : 235) : 0;
            }
        }
        for (const i of sources) {
            d[i * 4 + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
    }

    return {
        resize(nw, nh) {
            w = nw;
            h = nh;
            alloc();
            img = ctx.createImageData(w, h);
            load(scene);
        },
        frame() {
            if (drag && tool === "poke") {
                const from = last || drag;
                const n = Math.max(1, Math.ceil(Math.hypot(drag.x - from.x, drag.y - from.y) / 2));
                for (let s = 1; s <= n; s++) poke(from.x + ((drag.x - from.x) * s) / n, from.y + ((drag.y - from.y) * s) / n, (drag.button === 2 ? -1.2 : 1.2) / n);
                last = { x: drag.x, y: drag.y };
            }
            if (playing || drag) for (let s = 0; s < 2; s++) step();
            draw();
        },
        down(p) {
            drag = p;
            last = null;
            if (tool === "source") {
                const id = Math.round(p.y) * w + Math.round(p.x);
                if (p.button === 2) sources = sources.filter((s) => Math.abs((s % w) - p.x) > 4 || Math.abs(Math.floor(s / w) - p.y) > 4);
                else sources.push(id);
            } else if (tool !== "poke") {
                apply(p, p);
                last = { x: p.x, y: p.y };
            }
        },
        move(p) {
            if (!drag || tool === "poke" || tool === "source") return;
            apply(p, last || p);
            last = { x: p.x, y: p.y };
        },
        up() {
            drag = null;
            last = null;
        },
        running: () => playing,
        setTool(t) {
            tool = t;
        },
        set(key, value) {
            opts[key] = value;
            wake();
        },
        load(id) {
            load(id);
            wake();
        },
        calm() {
            cur.fill(0);
            prev.fill(0);
            wake();
        },
        play(on) {
            playing = on;
            wake();
        },
    };
}

export default function RippleTank() {
    const { canvasRef, toyRef } = useToy(create, { cell: CELL });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [tool, setTool] = useState("poke");
    const [scene, setScene] = useState("slits");
    const [s, setS] = useState({ freq: 3, speed: 0.45, damp: 0.001, look: "crests" });
    const [playing, setPlaying] = useState(!reduced);
    const toy = () => toyRef.current;
    const set = (key) => (val) => {
        setS((o) => ({ ...o, [key]: val }));
        toy()?.set(key, val);
    };
    const pickTool = (t) => {
        setTool(t);
        toy()?.setTool(t);
    };
    const hints = {
        poke: "Drag to make waves · right-drag for troughs",
        source: "Click to add a source · right-click to remove",
        wall: "Drag to draw walls · right-drag to erase",
        erase: "Drag to erase walls and sources",
    };

    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas pixel-canvas" />
            <ToyPanel>
                <ToySelect label="Setup" value={scene} options={SCENES.map((x) => ({ value: x.id, label: x.label }))} onChange={(id) => (setScene(id), toy()?.load(id))} />
                <ToySlider label="Frequency" value={s.freq} min={1} max={8} step={0.1} onChange={set("freq")} format={(x) => x.toFixed(1)} />
                <ToySlider label="Wave speed" value={s.speed} min={0.1} max={0.5} step={0.01} onChange={set("speed")} format={(x) => x.toFixed(2)} />
                <ToySlider label="Damping" value={s.damp} min={0} max={0.02} step={0.0005} onChange={set("damp")} format={(x) => (x ? x.toFixed(4) : "none")} />
                <ToyButtons
                    items={[
                        { id: "crests", label: "Crests", active: s.look === "crests", onClick: () => set("look")("crests") },
                        { id: "height", label: "Height", active: s.look === "height", onClick: () => set("look")("height") },
                    ]}
                />
                <ToyButtons
                    items={[
                        { id: "play", label: playing ? "Pause" : "Play", onClick: () => (setPlaying(!playing), toy()?.play(!playing)) },
                        { id: "calm", label: "Calm", onClick: () => toy()?.calm() },
                    ]}
                />
            </ToyPanel>
            <ToyTools
                tools={[
                    { id: "poke", label: "Poke", active: tool === "poke", onClick: () => pickTool("poke") },
                    { id: "source", label: "Source", active: tool === "source", onClick: () => pickTool("source") },
                    { id: "wall", label: "Wall", active: tool === "wall", onClick: () => pickTool("wall") },
                    { id: "erase", label: "Erase", active: tool === "erase", onClick: () => pickTool("erase") },
                ]}
                hint={hints[tool]}
            />
        </>
    );
}
