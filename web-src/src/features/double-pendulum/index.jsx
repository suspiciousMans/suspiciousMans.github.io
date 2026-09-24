import { useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToyButtons } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// Double pendulums, a textbook case of chaos. Several start almost exactly
// together, a hair's breadth apart, and swing as one for a while before
// they fan out and go their own ways. Integrated with RK4; drag to lift
// them all to a new starting point and let go.
const TAU = Math.PI * 2;

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let list = [];
    let playing = !reduced;
    let hold = null;
    const opts = { count: 12, spread: 0.001, gravity: 9.8, trail: 160, speed: 1 };
    let start = [2.2, 2.6];

    function spawn() {
        list = Array.from({ length: opts.count }, (_, i) => ({
            s: [start[0] + i * opts.spread, start[1], 0, 0], // θ1, θ2, ω1, ω2
            trail: [],
        }));
    }

    function deriv([t1, t2, w1, w2]) {
        const g = opts.gravity;
        const d = t1 - t2;
        const den = 3 - Math.cos(2 * d);
        const a1 = (-3 * g * Math.sin(t1) - g * Math.sin(t1 - 2 * t2) - 2 * Math.sin(d) * (w2 * w2 + w1 * w1 * Math.cos(d))) / den;
        const a2 = (2 * Math.sin(d) * (2 * w1 * w1 + 2 * g * Math.cos(t1) + w2 * w2 * Math.cos(d))) / den;
        return [w1, w2, a1, a2];
    }

    function rk4(s, dt) {
        const add = (a, b, k) => a.map((v, i) => v + b[i] * k);
        const k1 = deriv(s);
        const k2 = deriv(add(s, k1, dt / 2));
        const k3 = deriv(add(s, k2, dt / 2));
        const k4 = deriv(add(s, k3, dt));
        return s.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    }

    const geo = () => {
        const L = Math.min(w, h) * 0.22;
        return { cx: w / 2, cy: h / 2 - L * 0.1, L };
    };

    function tips(s) {
        const { cx, cy, L } = geo();
        const x1 = cx + Math.sin(s[0]) * L;
        const y1 = cy + Math.cos(s[0]) * L;
        return [x1, y1, x1 + Math.sin(s[1]) * L, y1 + Math.cos(s[1]) * L];
    }

    function draw() {
        const rgb = ink();
        const { cx, cy } = geo();
        ctx.clearRect(0, 0, w, h);
        const n = list.length;
        ctx.lineWidth = 1;
        for (const p of list) {
            const t = p.trail;
            if (t.length < 4) continue;
            const seg = 8;
            for (let i = 2; i < t.length; i += seg) {
                ctx.strokeStyle = `rgba(${rgb},${(i / t.length) * (n > 1 ? 0.55 : 0.8)})`;
                ctx.beginPath();
                ctx.moveTo(t[i - 2], t[i - 1]);
                for (let j = i; j < Math.min(t.length, i + seg + 2); j += 2) ctx.lineTo(t[j], t[j + 1]);
                ctx.stroke();
            }
        }
        const armAlpha = n > 1 ? Math.max(0.25, 1 / Math.sqrt(n)) : 1;
        ctx.strokeStyle = `rgba(${rgb},${armAlpha})`;
        ctx.fillStyle = `rgba(${rgb},${Math.min(1, armAlpha + 0.3)})`;
        ctx.lineWidth = 2;
        for (const p of list) {
            const [x1, y1, x2, y2] = tips(p.s);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x1, y1, 4, 0, TAU);
            ctx.arc(x2, y2, 5, 0, TAU);
            ctx.fill();
        }
        ctx.fillStyle = `rgb(${rgb})`;
        ctx.fillRect(cx - 3, cy - 3, 6, 6);
    }

    // Point the arms at the pointer: the elbow bends so the tip lands on it.
    function aim(p) {
        const { cx, cy, L } = geo();
        const dx = p.x - cx;
        const dy = p.y - cy;
        const d = Math.min(2 * L - 0.01, Math.max(0.01, Math.hypot(dx, dy)));
        const base = Math.atan2(dx, dy);
        const bend = Math.acos(d / (2 * L));
        start = [base + bend, base - bend];
        spawn();
    }

    return {
        resize(nw, nh) {
            const first = !w;
            w = nw;
            h = nh;
            if (first) spawn();
            for (const p of list) p.trail = [];
        },
        frame(t, dt) {
            if (playing && !hold) {
                const sub = 8;
                const sdt = (dt * opts.speed) / sub;
                for (const p of list) {
                    for (let s = 0; s < sub; s++) p.s = rk4(p.s, sdt);
                    const [, , x2, y2] = tips(p.s);
                    p.trail.push(x2, y2);
                    if (p.trail.length > opts.trail * 2) p.trail.splice(0, p.trail.length - opts.trail * 2);
                }
            }
            draw();
        },
        down(p) {
            hold = p;
            aim(p);
        },
        move(p) {
            if (hold && p.down) aim(p);
        },
        up() {
            hold = null;
            wake();
        },
        running: () => playing,
        set(key, value) {
            opts[key] = value;
            if (key === "count" || key === "spread") spawn();
            wake();
        },
        restart() {
            spawn();
            wake();
        },
        play(on) {
            playing = on;
            wake();
        },
    };
}

export default function DoublePendulum() {
    const { canvasRef, toyRef } = useToy(create);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [s, setS] = useState({ count: 12, spread: 0.001, gravity: 9.8, trail: 160, speed: 1 });
    const [playing, setPlaying] = useState(!reduced);
    const set = (key) => (val) => {
        setS((o) => ({ ...o, [key]: val }));
        toyRef.current?.set(key, val);
    };

    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas" />
            <ToyPanel>
                <ToySlider label="Pendulums" value={s.count} min={1} max={40} onChange={set("count")} />
                <ToySlider
                    label="Head start gap"
                    value={Math.log10(s.spread)}
                    min={-6}
                    max={-1}
                    step={0.25}
                    onChange={(v) => set("spread")(10 ** v)}
                    format={(v) => (10 ** v).toExponential(0) + " rad"}
                />
                <ToySlider label="Gravity" value={s.gravity} min={1} max={30} step={0.1} onChange={set("gravity")} format={(v) => v.toFixed(1)} />
                <ToySlider label="Time speed" value={s.speed} min={0.1} max={3} step={0.1} onChange={set("speed")} format={(v) => v.toFixed(1) + "×"} />
                <ToySlider label="Trail" value={s.trail} min={0} max={600} step={10} onChange={set("trail")} />
                <ToyButtons
                    items={[
                        { id: "play", label: playing ? "Pause" : "Play", onClick: () => (setPlaying(!playing), toyRef.current?.play(!playing)) },
                        { id: "restart", label: "Restart", onClick: () => toyRef.current?.restart() },
                    ]}
                />
            </ToyPanel>
            <ToyTools tools={[]} hint="Drag to lift them · let go to drop" />
        </>
    );
}
