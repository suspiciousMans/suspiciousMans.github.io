import { useEffect, useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToySelect, ToyButtons, ToyReadout } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// L-systems: start from a short string, rewrite every letter by its rule
// again and again, then read the result as turtle directions. F moves
// forward and draws, + and - turn, [ and ] save and restore where the
// turtle was. A few lines of rules grow ferns, trees and space-filling curves.
const RAD = Math.PI / 180;
const MAX_LEN = 400000;

export const PRESETS = [
    { id: "plant", label: "Fern", axiom: "X", rules: { X: "F+[[X]-X]-F[-FX]+X", F: "FF" }, angle: 25, iters: 5, start: -80, sway: true },
    { id: "tree", label: "Tree", axiom: "F", rules: { F: "FF+[+F-F-F]-[-F+F+F]" }, angle: 22.5, iters: 4, start: -90, sway: true },
    { id: "bush", label: "Bush", axiom: "Y", rules: { X: "X[-FFF][+FFF]FX", Y: "YFX[+Y][-Y]" }, angle: 25.7, iters: 6, start: -90, sway: true },
    { id: "weed", label: "Weed", axiom: "F", rules: { F: "F[+F]F[-F]F" }, angle: 25.7, iters: 5, start: -90, sway: true },
    { id: "koch", label: "Koch snowflake", axiom: "F--F--F", rules: { F: "F+F--F+F" }, angle: 60, iters: 4, start: 0 },
    { id: "dragon", label: "Dragon curve", axiom: "FX", rules: { X: "X+YF+", Y: "-FX-Y" }, angle: 90, iters: 12, start: 0 },
    { id: "sierpinski", label: "Sierpiński triangle", axiom: "F-G-G", rules: { F: "F-G+F+G-F", G: "GG" }, angle: 120, iters: 6, start: 0 },
    { id: "hilbert", label: "Hilbert curve", axiom: "A", rules: { A: "+BF-AFA-FB+", B: "-AF+BFB+FA-" }, angle: 90, iters: 6, start: 0 },
    { id: "gosper", label: "Gosper island", axiom: "A", rules: { A: "A-B--B+A++AA+B-", B: "+A-BB--A-B++B" }, angle: 60, iters: 4, start: 0, draws: "AB" },
    { id: "levy", label: "Lévy C curve", axiom: "F", rules: { F: "+F--F+" }, angle: 45, iters: 12, start: 0 },
];

function expand(p, iters) {
    let s = p.axiom;
    for (let i = 0; i < iters; i++) {
        let out = "";
        for (const c of s) out += p.rules[c] ?? c;
        if (out.length > MAX_LEN) break;
        s = out;
    }
    return s;
}

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let preset = PRESETS[0];
    let iters = preset.iters;
    let angle = preset.angle;
    let str = "";
    let segs = new Float32Array(0); // x1, y1, x2, y2, depth per segment
    let count = 0;
    let bounds = null;
    let grow = 0; // 0..1, how much is drawn
    let sway = !reduced;
    let wind = 1;
    let drag = null;
    let listener = () => {};

    // Walk the string. `bend(depth)` is extra turn per level of branching,
    // which is how the plants sway without re-growing.
    function walk(bend) {
        const draws = preset.draws || "FG";
        let x = 0;
        let y = 0;
        let a = preset.start * RAD;
        let d = 0;
        const stack = [];
        const turn = angle * RAD;
        let n = 0;
        const out = segs.length >= str.length * 5 ? segs : new Float32Array(str.length * 5);
        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            if (draws.includes(c)) {
                const nx = x + Math.cos(a);
                const ny = y + Math.sin(a);
                const o = n * 5;
                out[o] = x;
                out[o + 1] = y;
                out[o + 2] = nx;
                out[o + 3] = ny;
                out[o + 4] = d;
                n++;
                x = nx;
                y = ny;
            } else if (c === "+") a += turn;
            else if (c === "-") a -= turn;
            else if (c === "[") {
                stack.push(x, y, a, d);
                d++;
                if (bend) a += bend(d);
            } else if (c === "]") {
                d = stack.pop();
                a = stack.pop();
                y = stack.pop();
                x = stack.pop();
            }
        }
        segs = out;
        count = n;
    }

    function measure() {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (let i = 0; i < count; i++) {
            const o = i * 5;
            x0 = Math.min(x0, segs[o], segs[o + 2]);
            x1 = Math.max(x1, segs[o], segs[o + 2]);
            y0 = Math.min(y0, segs[o + 1], segs[o + 3]);
            y1 = Math.max(y1, segs[o + 1], segs[o + 3]);
        }
        bounds = { x0, y0, x1, y1 };
    }

    function rebuild(regrow) {
        str = expand(preset, iters);
        walk(null);
        measure();
        if (regrow) grow = reduced ? 1 : 0;
    }

    function draw(t) {
        const rgb = ink();
        ctx.clearRect(0, 0, w, h);
        const b = bounds;
        const pad = 24;
        const s = Math.min((w - pad * 2) / Math.max(1e-6, b.x1 - b.x0), (h - pad * 2) / Math.max(1e-6, b.y1 - b.y0));
        const ox = (w - (b.x1 - b.x0) * s) / 2 - b.x0 * s;
        const oy = (h - (b.y1 - b.y0) * s) / 2 - b.y0 * s;
        const n = Math.floor(count * grow);
        const plant = !!preset.sway;
        // Thicker near the root for plants: one path per branching depth.
        const depths = plant ? 8 : 1;
        for (let dd = 0; dd < depths; dd++) {
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const o = i * 5;
                if (plant && Math.min(7, segs[o + 4]) !== dd) continue;
                ctx.moveTo(ox + segs[o] * s, oy + segs[o + 1] * s);
                ctx.lineTo(ox + segs[o + 2] * s, oy + segs[o + 3] * s);
            }
            ctx.strokeStyle = `rgba(${rgb},${plant ? 1 - dd * 0.07 : 0.95})`;
            ctx.lineWidth = plant ? Math.max(0.6, 2.6 - dd * 0.35) : 1.2;
            ctx.lineCap = "round";
            ctx.stroke();
        }
        if (grow < 1 && n > 0) {
            const o = (n - 1) * 5;
            ctx.fillStyle = `rgb(${rgb})`;
            ctx.fillRect(ox + segs[o + 2] * s - 2, oy + segs[o + 3] * s - 2, 4, 4);
        }
        if (plant && sway && t && str.length < 150000) {
            // Recompute the swaying shape for the next frame (bounds stay put).
            const phase = t * 1.3;
            walk((d) => Math.sin(phase - d * 0.5) * 0.012 * wind * d);
        }
    }

    return {
        resize(nw, nh) {
            const first = !w;
            w = nw;
            h = nh;
            if (first) rebuild(true);
        },
        frame(t, dt) {
            if (grow < 1) grow = Math.min(1, grow + dt / Math.max(1.5, Math.min(5, count / 4000)));
            draw(t);
            listener({ symbols: str.length, lines: count });
        },
        down(p) {
            drag = { x: p.x, a: angle };
        },
        move(p) {
            if (!drag || !p.down) return;
            angle = Math.round((drag.a + (p.x - drag.x) * 0.1) * 10) / 10;
            walk(null);
            measure();
            listener({ angle });
        },
        up() {
            drag = null;
            wake();
        },
        running: () => grow < 1 || (sway && !!preset.sway && str.length < 150000),
        onStats(fn) {
            listener = fn;
        },
        pick(id) {
            preset = PRESETS.find((p) => p.id === id) || PRESETS[0];
            iters = preset.iters;
            angle = preset.angle;
            rebuild(true);
            wake();
            return preset;
        },
        setIters(v) {
            iters = v;
            rebuild(true);
            wake();
        },
        setAngle(v) {
            angle = v;
            walk(null);
            measure();
            wake();
        },
        setSway(on) {
            sway = on;
            if (!on) walk(null);
            wake();
        },
        setWind(v) {
            wind = v;
        },
        regrow() {
            grow = reduced ? 1 : 0;
            wake();
        },
    };
}

export default function LSystem() {
    const { canvasRef, toyRef } = useToy(create);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [preset, setPreset] = useState(PRESETS[0].id);
    const [iters, setIters] = useState(PRESETS[0].iters);
    const [angle, setAngle] = useState(PRESETS[0].angle);
    const [sway, setSway] = useState(!reduced);
    const [wind, setWind] = useState(1);
    const [stats, setStats] = useState({ symbols: 0, lines: 0 });
    const toy = () => toyRef.current;
    const p = PRESETS.find((x) => x.id === preset);

    useEffect(() => {
        let lastAt = 0;
        toyRef.current?.onStats((st) => {
            if (st.angle !== undefined) return setAngle(st.angle);
            const now = performance.now();
            if (now - lastAt < 300) return;
            lastAt = now;
            setStats(st);
        });
    }, [toyRef]);

    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas" />
            <ToyPanel>
                <ToySelect
                    label="Grow"
                    value={preset}
                    options={PRESETS.map((x) => ({ value: x.id, label: x.label }))}
                    onChange={(id) => {
                        setPreset(id);
                        const np = toy()?.pick(id);
                        if (np) (setIters(np.iters), setAngle(np.angle));
                    }}
                />
                <ToySlider label="Generations" value={iters} min={1} max={p.iters + 2} onChange={(v) => (setIters(v), toy()?.setIters(v))} />
                <ToySlider label="Turn angle" value={angle} min={1} max={180} step={0.1} onChange={(v) => (setAngle(v), toy()?.setAngle(v))} format={(v) => v.toFixed(1) + "°"} />
                {p.sway && <ToySlider label="Wind" value={wind} min={0} max={4} step={0.1} onChange={(v) => (setWind(v), toy()?.setWind(v))} format={(v) => v.toFixed(1)} />}
                <ToyButtons
                    items={[
                        { id: "regrow", label: "Regrow", onClick: () => toy()?.regrow() },
                        ...(p.sway ? [{ id: "sway", label: "Sway", active: sway, onClick: () => (setSway(!sway), toy()?.setSway(!sway)) }] : []),
                    ]}
                />
                <ToyReadout
                    items={[
                        ["Symbols", stats.symbols.toLocaleString()],
                        ["Lines", stats.lines.toLocaleString()],
                    ]}
                />
            </ToyPanel>
            <ToyTools tools={[]} hint="Drag sideways to bend the turn angle" />
        </>
    );
}
