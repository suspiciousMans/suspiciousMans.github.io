import { useEffect, useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToySelect, ToyButtons, ToyReadout } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// Diffusion-limited aggregation. Particles wander at random until they
// bump into the crystal, then stick. Tips reach further out, so they catch
// more wanderers and grow faster still: that feedback is what makes the
// branching frost, coral and lightning shapes. Older parts are drawn darker.
const CELL = 3;
const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];

export const SEEDS = [
    { id: "point", label: "Frost (from a point)" },
    { id: "line", label: "Coral (from the floor)" },
    { id: "ring", label: "Inward (from a ring)" },
];

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let grid = new Int32Array(0); // 0 empty, else the order it stuck in
    let img = null;
    let count = 0;
    let reach = 0; // how far the crystal has grown (radius or height)
    let seed = "point";
    let playing = !reduced;
    let walkers = [];
    let draw = null;
    let wide = false; // extra seeds planted: wanderers roam the whole field
    const opts = { stick: 1, speed: 1, walkers: 400 };
    const cx = () => w >> 1;
    const cy = () => h >> 1;

    function put(x, y) {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const i = y * w + x;
        if (grid[i]) return;
        grid[i] = ++count;
        if (seed === "point") reach = Math.max(reach, Math.hypot(x - cx(), y - cy()));
        else if (seed === "line") reach = Math.max(reach, h - 1 - y);
        else reach = Math.max(reach, Math.min(w, h) * 0.46 - Math.hypot(x - cx(), y - cy()));
    }

    function reset() {
        grid.fill(0);
        count = 0;
        reach = 0;
        walkers = [];
        wide = false;
        if (seed === "point") put(cx(), cy());
        else if (seed === "line") for (let x = 0; x < w; x++) put(x, h - 1);
        else {
            const r = Math.min(w, h) * 0.46;
            for (let a = 0; a < Math.PI * 2; a += 0.5 / r) put(Math.round(cx() + Math.cos(a) * r), Math.round(cy() + Math.sin(a) * r));
            reach = 0;
        }
    }

    // Spawn a wanderer just beyond the crystal, so it doesn't waste steps.
    function spawn() {
        if (wide) {
            for (let t = 0; t < 20; t++) {
                const x = Math.floor(Math.random() * w);
                const y = Math.floor(Math.random() * h);
                if (!grid[y * w + x] && !touching(x, y)) return [x, y];
            }
        }
        if (seed === "point") {
            const r = Math.min(reach + 6, Math.hypot(w, h) / 2);
            const a = Math.random() * Math.PI * 2;
            return [cx() + Math.cos(a) * r, cy() + Math.sin(a) * r];
        }
        if (seed === "line") return [Math.random() * w, Math.max(0, h - 1 - reach - 6)];
        const r = Math.min(w, h) * 0.46 - reach - 6;
        if (r < 2) return [cx(), cy()];
        const R = Math.random() * r;
        const a = Math.random() * Math.PI * 2;
        return [cx() + Math.cos(a) * R, cy() + Math.sin(a) * R];
    }

    function tooFar(x, y) {
        if (wide) return false;
        if (seed === "point") return Math.hypot(x - cx(), y - cy()) > reach + 30;
        if (seed === "line") return y < h - 1 - reach - 30;
        return false;
    }

    function touching(x, y) {
        for (let k = 0; k < 4; k++) {
            const nx = x + DX[k];
            const ny = y + DY[k];
            if (nx >= 0 && ny >= 0 && nx < w && ny < h && grid[ny * w + nx]) return true;
        }
        return false;
    }

    function full() {
        if (wide) return count > w * h * 0.3;
        if (seed === "point") return reach > Math.min(w, h) / 2 - 4;
        if (seed === "line") return reach > h - 6;
        return reach > Math.min(w, h) * 0.46 - 3;
    }

    function step(budget) {
        while (walkers.length < opts.walkers) walkers.push(spawn().map(Math.round));
        for (let s = 0; s < budget; s++) {
            for (const p of walkers) {
                const k = (Math.random() * 4) | 0;
                // Coral walkers drift down a little, like falling sediment.
                const down = seed === "line" && Math.random() < 0.1;
                p[0] += down ? 0 : DX[k];
                p[1] += down ? 1 : DY[k];
                if (seed !== "line") {
                    if (p[0] < 0) p[0] = 0;
                    if (p[0] >= w) p[0] = w - 1;
                } else p[0] = (p[0] + w) % w;
                if (p[1] < 0) p[1] = 0;
                if (p[1] >= h) p[1] = h - 1;
                if (tooFar(p[0], p[1]) || grid[p[1] * w + p[0]]) {
                    const q = spawn();
                    p[0] = Math.round(q[0]);
                    p[1] = Math.round(q[1]);
                    continue;
                }
                if (touching(p[0], p[1]) && Math.random() < opts.stick) {
                    put(p[0], p[1]);
                    const q = spawn();
                    p[0] = Math.round(q[0]);
                    p[1] = Math.round(q[1]);
                }
            }
        }
    }

    function render() {
        const [r, g, b] = ink().split(",").map(Number);
        const d = img.data;
        const n = Math.max(1, count);
        for (let i = 0; i < grid.length; i++) {
            const o = i * 4;
            d[o] = r;
            d[o + 1] = g;
            d[o + 2] = b;
            d[o + 3] = grid[i] ? 255 - (grid[i] / n) * 150 : 0;
        }
        for (const p of walkers) {
            const o = (p[1] * w + p[0]) * 4;
            if (!d[o + 3]) d[o + 3] = 50;
        }
        ctx.putImageData(img, 0, 0);
    }

    return {
        resize(nw, nh) {
            w = nw;
            h = nh;
            grid = new Int32Array(w * h);
            img = ctx.createImageData(w, h);
            reset();
        },
        frame() {
            if (playing && !full()) step(Math.round(40 * opts.speed));
            render();
            draw?.({ count, full: full() });
        },
        down(p) {
            const x = Math.floor(p.x);
            const y = Math.floor(p.y);
            // Drop a new seed to grow from.
            for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) put(x + i, y + j);
            wide = true;
            wake();
        },
        running: () => playing && !full(),
        onStats(fn) {
            draw = fn;
        },
        set(key, v) {
            opts[key] = v;
            if (key === "walkers") walkers.length = Math.min(walkers.length, v);
            wake();
        },
        setSeed(id) {
            seed = id;
            reset();
            wake();
        },
        reset() {
            reset();
            wake();
        },
        play(on) {
            playing = on;
            wake();
        },
    };
}

export default function Crystal() {
    const { canvasRef, toyRef } = useToy(create, { cell: CELL });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [seed, setSeed] = useState("point");
    const [s, setS] = useState({ stick: 1, speed: 1, walkers: 400 });
    const [playing, setPlaying] = useState(!reduced);
    const [stats, setStats] = useState({ count: 0, full: false });
    const toy = () => toyRef.current;
    const set = (key) => (v) => {
        setS((o) => ({ ...o, [key]: v }));
        toy()?.set(key, v);
    };

    useEffect(() => {
        let lastAt = 0;
        toyRef.current?.onStats((st) => {
            const now = performance.now();
            if (now - lastAt < 250) return;
            lastAt = now;
            setStats(st);
        });
    }, [toyRef]);

    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas pixel-canvas" />
            <ToyPanel>
                <ToySelect label="Grow" value={seed} options={SEEDS.map((x) => ({ value: x.id, label: x.label }))} onChange={(id) => (setSeed(id), toy()?.setSeed(id))} />
                <ToySlider label="Stickiness" value={s.stick} min={0.05} max={1} step={0.05} onChange={set("stick")} format={(v) => Math.round(v * 100) + "%"} />
                <ToySlider label="Wanderers" value={s.walkers} min={20} max={2000} step={20} onChange={set("walkers")} />
                <ToySlider label="Speed" value={s.speed} min={0.2} max={5} step={0.1} onChange={set("speed")} format={(v) => v.toFixed(1) + "×"} />
                <ToyButtons
                    items={[
                        { id: "play", label: playing ? "Pause" : "Play", onClick: () => (setPlaying(!playing), toy()?.play(!playing)) },
                        { id: "reset", label: "Start over", onClick: () => toy()?.reset() },
                    ]}
                />
                <ToyReadout
                    items={[
                        ["Stuck", stats.count.toLocaleString()],
                        ["State", stats.full ? "grown" : "growing"],
                    ]}
                />
            </ToyPanel>
            <ToyTools tools={[]} hint="Click to plant another seed" />
        </>
    );
}
