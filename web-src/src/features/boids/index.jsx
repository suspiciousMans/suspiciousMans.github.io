import { useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToyButtons } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// Boids, Craig Reynolds' flocking birds. Each one only follows three
// rules about its nearby flockmates: don't crowd them, fly the way they
// fly, and drift toward their middle. Nobody leads, yet the flock turns
// as one. Your pointer is a hawk they scatter from, or bait they chase.
const TAU = Math.PI * 2;

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let n = 0;
    let x, y, vx, vy;
    let cells = new Map();
    let playing = !reduced;
    let mode = "scare";
    const pointer = { x: -1e4, y: -1e4, down: false };
    const opts = { count: 350, sep: 1, align: 1, coh: 1, vision: 50, speed: 1, trails: false };

    function alloc(count) {
        const ox = x;
        const oy = y;
        const ovx = vx;
        const ovy = vy;
        const keep = Math.min(n, count);
        x = new Float32Array(count);
        y = new Float32Array(count);
        vx = new Float32Array(count);
        vy = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            if (i < keep) {
                x[i] = ox[i];
                y[i] = oy[i];
                vx[i] = ovx[i];
                vy[i] = ovy[i];
            } else {
                x[i] = Math.random() * w;
                y[i] = Math.random() * h;
                const a = Math.random() * TAU;
                vx[i] = Math.cos(a) * 2;
                vy[i] = Math.sin(a) * 2;
            }
        }
        n = count;
    }

    function bucket() {
        cells = new Map();
        const s = opts.vision;
        for (let i = 0; i < n; i++) {
            const k = Math.floor(x[i] / s) * 4096 + Math.floor(y[i] / s);
            let c = cells.get(k);
            if (!c) cells.set(k, (c = []));
            c.push(i);
        }
    }

    function step(dt) {
        const s = opts.vision;
        const s2 = s * s;
        const close2 = (s * 0.4) ** 2;
        const max = 3 * opts.speed;
        const min = 1.2 * opts.speed;
        const f = dt * 60;
        bucket();
        for (let i = 0; i < n; i++) {
            let ax = 0;
            let ay = 0;
            let cx = 0;
            let cy = 0;
            let sx = 0;
            let sy = 0;
            let count = 0;
            const gx = Math.floor(x[i] / s);
            const gy = Math.floor(y[i] / s);
            for (let ox = -1; ox <= 1; ox++) {
                for (let oy = -1; oy <= 1; oy++) {
                    const c = cells.get((gx + ox) * 4096 + gy + oy);
                    if (!c) continue;
                    for (const j of c) {
                        if (j === i) continue;
                        const dx = x[j] - x[i];
                        const dy = y[j] - y[i];
                        const d2 = dx * dx + dy * dy;
                        if (d2 > s2) continue;
                        count++;
                        ax += vx[j];
                        ay += vy[j];
                        cx += dx;
                        cy += dy;
                        if (d2 < close2) {
                            sx -= dx / (d2 + 1);
                            sy -= dy / (d2 + 1);
                        }
                    }
                }
            }
            let fx = 0;
            let fy = 0;
            if (count) {
                fx += (ax / count - vx[i]) * 0.05 * opts.align;
                fy += (ay / count - vy[i]) * 0.05 * opts.align;
                fx += (cx / count) * 0.0015 * opts.coh;
                fy += (cy / count) * 0.0015 * opts.coh;
                fx += sx * 1.5 * opts.sep;
                fy += sy * 1.5 * opts.sep;
            }
            // The pointer: flee it (or chase it) when it's near.
            const px = pointer.x - x[i];
            const py = pointer.y - y[i];
            const pd2 = px * px + py * py;
            const reach = mode === "lure" && pointer.down ? 1e9 : 120 * 120;
            if (pd2 < reach) {
                const pd = Math.sqrt(pd2) + 1;
                const k = mode === "scare" ? -(pointer.down ? 1.2 : 0.5) : pointer.down ? 0.12 : 0.04;
                fx += (px / pd) * k;
                fy += (py / pd) * k;
            }
            // Steer away from the edges rather than wrapping.
            const m = 40;
            if (x[i] < m) fx += 0.15;
            if (x[i] > w - m) fx -= 0.15;
            if (y[i] < m) fy += 0.15;
            if (y[i] > h - m) fy -= 0.15;
            vx[i] += fx * f;
            vy[i] += fy * f;
            const v = Math.hypot(vx[i], vy[i]) || 1;
            if (v > max) (vx[i] *= max / v), (vy[i] *= max / v);
            else if (v < min) (vx[i] *= min / v), (vy[i] *= min / v);
        }
        for (let i = 0; i < n; i++) {
            x[i] = Math.min(w, Math.max(0, x[i] + vx[i] * f));
            y[i] = Math.min(h, Math.max(0, y[i] + vy[i] * f));
        }
    }

    function draw() {
        const rgb = ink();
        if (opts.trails) {
            ctx.globalCompositeOperation = "destination-out";
            ctx.fillStyle = "rgba(0,0,0,0.12)";
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = "source-over";
        } else ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = `rgb(${rgb})`;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const v = Math.hypot(vx[i], vy[i]) || 1;
            const ux = vx[i] / v;
            const uy = vy[i] / v;
            const L = 7;
            const W = 2.6;
            ctx.moveTo(x[i] + ux * L * 0.6, y[i] + uy * L * 0.6);
            ctx.lineTo(x[i] - ux * L * 0.4 - uy * W, y[i] - uy * L * 0.4 + ux * W);
            ctx.lineTo(x[i] - ux * L * 0.4 + uy * W, y[i] - uy * L * 0.4 - ux * W);
            ctx.closePath();
        }
        ctx.fill();
        if (pointer.x > -1e3) {
            ctx.strokeStyle = `rgba(${rgb},0.35)`;
            ctx.setLineDash([3, 4]);
            ctx.beginPath();
            ctx.arc(pointer.x, pointer.y, mode === "scare" ? 120 : 20, 0, TAU);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    return {
        resize(nw, nh) {
            const first = !w;
            w = nw;
            h = nh;
            if (first) alloc(opts.count);
        },
        frame(t, dt) {
            if (playing) step(dt);
            draw();
        },
        down(p) {
            Object.assign(pointer, { x: p.x, y: p.y, down: true });
        },
        move(p) {
            Object.assign(pointer, { x: p.x, y: p.y, down: p.down });
        },
        up() {
            pointer.down = false;
        },
        running: () => playing,
        setMode(m) {
            mode = m;
        },
        set(key, v) {
            opts[key] = v;
            if (key === "count") alloc(v);
            wake();
        },
        scatter() {
            n = 0;
            alloc(opts.count);
            wake();
        },
        play(on) {
            playing = on;
            wake();
        },
    };
}

export default function Boids() {
    const { canvasRef, toyRef } = useToy(create);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [mode, setMode] = useState("scare");
    const [s, setS] = useState({ count: 350, sep: 1, align: 1, coh: 1, vision: 50, speed: 1, trails: false });
    const [playing, setPlaying] = useState(!reduced);
    const toy = () => toyRef.current;
    const set = (key) => (v) => {
        setS((o) => ({ ...o, [key]: v }));
        toy()?.set(key, v);
    };
    const pick = (m) => (setMode(m), toy()?.setMode(m));
    const pct = (v) => Math.round(v * 100) + "%";

    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas" />
            <ToyPanel>
                <ToySlider label="Birds" value={s.count} min={20} max={1500} step={10} onChange={set("count")} />
                <ToySlider label="Keep apart" value={s.sep} min={0} max={3} step={0.05} onChange={set("sep")} format={pct} />
                <ToySlider label="Fly together" value={s.align} min={0} max={3} step={0.05} onChange={set("align")} format={pct} />
                <ToySlider label="Stay close" value={s.coh} min={0} max={3} step={0.05} onChange={set("coh")} format={pct} />
                <ToySlider label="Vision" value={s.vision} min={15} max={120} onChange={set("vision")} format={(v) => v + "px"} />
                <ToySlider label="Speed" value={s.speed} min={0.3} max={3} step={0.1} onChange={set("speed")} format={(v) => v.toFixed(1) + "×"} />
                <ToyButtons
                    items={[
                        { id: "play", label: playing ? "Pause" : "Play", onClick: () => (setPlaying(!playing), toy()?.play(!playing)) },
                        { id: "trails", label: "Trails", active: s.trails, onClick: () => set("trails")(!s.trails) },
                        { id: "scatter", label: "Scatter", onClick: () => toy()?.scatter() },
                    ]}
                />
            </ToyPanel>
            <ToyTools
                tools={[
                    { id: "scare", label: "Hawk", active: mode === "scare", onClick: () => pick("scare") },
                    { id: "lure", label: "Bait", active: mode === "lure", onClick: () => pick("lure") },
                ]}
                hint={mode === "scare" ? "Move near the flock to scatter it · press to scare harder" : "Hold down to call the whole flock"}
            />
        </>
    );
}
