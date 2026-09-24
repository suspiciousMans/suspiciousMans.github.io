import { useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToyButtons } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// A pendulum wave. Each pendulum is a little shorter than the one before,
// tuned so that in one full cycle the first swings N times, the next N+1,
// and so on. They start in a line, slide into snakes, split into two and
// three groups, scramble, and all line up again at the end of the cycle.
const TAU = Math.PI * 2;

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let t = 0;
    let playing = !reduced;
    let scrub = null;
    const opts = { count: 18, cycle: 60, base: 20, swing: 0.45, view: "top" };
    let listener = () => {};

    function draw() {
        const rgb = ink();
        ctx.clearRect(0, 0, w, h);
        const n = opts.count;
        const top = 46;
        if (opts.view === "side") {
            // Seen from the front: every bob on its own string from one bar.
            const maxL = h - top - 40;
            const span = w * 0.8;
            const x0 = (w - span) / 2;
            ctx.strokeStyle = `rgba(${rgb},0.5)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x0 - 10, top);
            ctx.lineTo(x0 + span + 10, top);
            ctx.stroke();
            ctx.lineWidth = 1;
            for (let i = 0; i < n; i++) {
                const f = (opts.base + i) / opts.cycle;
                // Length follows the frequency (L ∝ 1/f²), scaled to fit.
                const L = maxL * ((opts.base / (opts.base + i)) ** 2 * 0.55 + 0.45);
                const a = opts.swing * Math.cos(TAU * f * t);
                const px = x0 + (span * i) / Math.max(1, n - 1);
                const bx = px + Math.sin(a) * L * 0.6;
                const by = top + Math.cos(a) * L;
                ctx.strokeStyle = `rgba(${rgb},0.35)`;
                ctx.beginPath();
                ctx.moveTo(px, top);
                ctx.lineTo(bx, by);
                ctx.stroke();
                ctx.fillStyle = `rgb(${rgb})`;
                ctx.beginPath();
                ctx.arc(bx, by, Math.max(3, Math.min(9, span / n / 3)), 0, TAU);
                ctx.fill();
            }
        } else {
            // From above: the classic snake of bobs.
            const rows = n;
            const gap = (h - top - 40) / rows;
            const amp = w * 0.36;
            ctx.fillStyle = `rgb(${rgb})`;
            ctx.strokeStyle = `rgba(${rgb},0.15)`;
            for (let i = 0; i < rows; i++) {
                const f = (opts.base + i) / opts.cycle;
                const y = top + 20 + i * gap;
                ctx.beginPath();
                ctx.moveTo(w / 2 - amp, y);
                ctx.lineTo(w / 2 + amp, y);
                ctx.stroke();
                const x = w / 2 + amp * Math.cos(TAU * f * t);
                ctx.beginPath();
                ctx.arc(x, y, Math.max(3, Math.min(9, gap / 3)), 0, TAU);
                ctx.fill();
            }
        }
        // A progress bar through the cycle along the bottom.
        const k = (t % opts.cycle) / opts.cycle;
        ctx.fillStyle = `rgba(${rgb},0.15)`;
        ctx.fillRect(12, h - 18, w - 24, 3);
        ctx.fillStyle = `rgb(${rgb})`;
        ctx.fillRect(12, h - 18, (w - 24) * k, 3);
    }

    return {
        resize(nw, nh) {
            w = nw;
            h = nh;
        },
        frame(time, dt) {
            if (playing && !scrub) t += dt;
            draw();
            listener({ t: t % opts.cycle });
        },
        // Drag sideways to scrub through the cycle.
        down(p) {
            scrub = { x: p.x, t };
        },
        move(p) {
            if (!scrub || !p.down) return;
            t = Math.max(0, scrub.t + ((p.x - scrub.x) / w) * opts.cycle);
        },
        up() {
            scrub = null;
            wake();
        },
        running: () => playing,
        onStats(fn) {
            listener = fn;
        },
        set(key, v) {
            opts[key] = v;
            wake();
        },
        restart() {
            t = 0;
            wake();
        },
        play(on) {
            playing = on;
            wake();
        },
    };
}

export default function PendulumWave() {
    const { canvasRef, toyRef } = useToy(create);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [s, setS] = useState({ count: 18, cycle: 60, base: 20, swing: 0.45, view: "top" });
    const [playing, setPlaying] = useState(!reduced);
    const toy = () => toyRef.current;
    const set = (key) => (v) => {
        setS((o) => ({ ...o, [key]: v }));
        toy()?.set(key, v);
    };

    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas" />
            <ToyPanel>
                <ToySlider label="Pendulums" value={s.count} min={4} max={40} onChange={set("count")} />
                <ToySlider label="Cycle length" value={s.cycle} min={10} max={120} step={5} onChange={set("cycle")} format={(v) => v + " s"} />
                <ToySlider label="Swings of the first" value={s.base} min={4} max={40} onChange={set("base")} format={(v) => v + " per cycle"} />
                <ToyButtons
                    items={[
                        { id: "side", label: "Front", active: s.view === "side", onClick: () => set("view")("side") },
                        { id: "top", label: "Above", active: s.view === "top", onClick: () => set("view")("top") },
                    ]}
                />
                <ToyButtons
                    items={[
                        { id: "play", label: playing ? "Pause" : "Play", onClick: () => (setPlaying(!playing), toy()?.play(!playing)) },
                        { id: "restart", label: "Restart", onClick: () => toy()?.restart() },
                    ]}
                />
            </ToyPanel>
            <ToyTools tools={[]} hint="Drag sideways to scrub through time" />
        </>
    );
}
