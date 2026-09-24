import { useEffect, useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToySelect, ToyButtons, ToyReadout } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// An n-body gravity sandbox. Every body pulls on every other (G = 1, in
// pixels), integrated with leapfrog steps so orbits stay stable. Drag to
// launch a new body: the dotted line is where it will go, the longer the
// drag the faster it flies. Bodies that collide can merge into one.
const SOFT = 16; // softening, px², so close passes don't fling to infinity

export const SCENES = [
    { id: "solar", label: "Star and planets" },
    { id: "binary", label: "Binary stars" },
    { id: "eight", label: "Figure eight" },
    { id: "cluster", label: "Cluster" },
    { id: "empty", label: "Empty space" },
];

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let bodies = [];
    let playing = !reduced;
    let time = 0;
    let scene = "solar";
    const opts = { mass: 20, speed: 1, trail: 120, merge: true };
    let aim = null; // { x0, y0, x1, y1 } while dragging a launch
    let listener = () => {};

    const radius = (m) => Math.max(2, Math.cbrt(m) * 1.6);

    function body(x, y, vx, vy, m) {
        return { x, y, vx, vy, m, ax: 0, ay: 0, trail: [] };
    }

    function orbit(cx, cy, cvx, cvy, M, r, a, m, dir = 1) {
        const v = Math.sqrt(M / r);
        return body(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cvx - Math.sin(a) * v * dir, cvy + Math.cos(a) * v * dir, m);
    }

    function load(id) {
        scene = id;
        time = 0;
        const cx = w / 2;
        const cy = h / 2;
        const s = Math.min(w, h);
        bodies = [];
        if (id === "solar") {
            const M = 4000;
            bodies.push(body(cx, cy, 0, 0, M));
            [0.12, 0.2, 0.3, 0.42].forEach((f, i) => bodies.push(orbit(cx, cy, 0, 0, M, s * f, i * 1.9, [4, 10, 25, 8][i])));
            // A moon around the third planet.
            const p = bodies[3];
            bodies.push(orbit(p.x, p.y, p.vx, p.vy, p.m, 14, 0, 0.3));
        } else if (id === "binary") {
            const M = 1500;
            const d = s * 0.08;
            const v = Math.sqrt(M / (4 * d));
            bodies.push(body(cx - d, cy, 0, -v, M), body(cx + d, cy, 0, v, M));
            [0.3, 0.42].forEach((f, i) => bodies.push(orbit(cx, cy, 0, 0, 2 * M, s * f, i * 2.4, 5)));
        } else if (id === "eight") {
            // Chenciner and Montgomery's three-body figure eight, scaled.
            const k = s * 0.22;
            const m = 800;
            const vs = Math.sqrt(m / k);
            const p = [
                [-0.97000436, 0.24308753],
                [0.97000436, -0.24308753],
                [0, 0],
            ];
            const vv = [
                [0.466203685, 0.43236573],
                [0.466203685, 0.43236573],
                [-0.93240737, -0.86473146],
            ];
            p.forEach(([x, y], i) => bodies.push(body(cx + x * k, cy + y * k, vv[i][0] * vs, vv[i][1] * vs, m)));
        } else if (id === "cluster") {
            for (let i = 0; i < 60; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = Math.sqrt(Math.random()) * s * 0.35;
                bodies.push(body(cx + Math.cos(a) * r, cy + Math.sin(a) * r, -Math.sin(a) * r * 0.012, Math.cos(a) * r * 0.012, 3 + Math.random() * 12));
            }
        }
    }

    function accel(list) {
        for (const b of list) b.ax = b.ay = 0;
        for (let i = 0; i < list.length; i++) {
            const a = list[i];
            for (let j = i + 1; j < list.length; j++) {
                const b = list[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d2 = dx * dx + dy * dy + SOFT;
                const inv = 1 / (d2 * Math.sqrt(d2));
                a.ax += dx * b.m * inv;
                a.ay += dy * b.m * inv;
                b.ax -= dx * a.m * inv;
                b.ay -= dy * a.m * inv;
            }
        }
    }

    function step(dt) {
        for (const b of bodies) {
            b.vx += b.ax * dt * 0.5;
            b.vy += b.ay * dt * 0.5;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
        }
        accel(bodies);
        for (const b of bodies) {
            b.vx += b.ax * dt * 0.5;
            b.vy += b.ay * dt * 0.5;
        }
        if (opts.merge) collide();
        // Let go of anything that has flown far off the stage.
        bodies = bodies.filter((b) => b.x > -w && b.x < 2 * w && b.y > -h && b.y < 2 * h);
        time += dt;
    }

    function collide() {
        for (let i = 0; i < bodies.length; i++) {
            const a = bodies[i];
            for (let j = i + 1; j < bodies.length; j++) {
                const b = bodies[j];
                const r = radius(a.m) + radius(b.m);
                if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 > r * r * 0.6) continue;
                // Momentum is kept; the heavier body keeps its trail.
                const m = a.m + b.m;
                const big = a.m >= b.m ? a : b;
                big.x = (a.x * a.m + b.x * b.m) / m;
                big.y = (a.y * a.m + b.y * b.m) / m;
                big.vx = (a.vx * a.m + b.vx * b.m) / m;
                big.vy = (a.vy * a.m + b.vy * b.m) / m;
                big.m = m;
                bodies.splice(big === a ? j : i, 1);
                if (big !== a) i--;
                break;
            }
        }
    }

    // Where would a body launched now go? Everything else is held still.
    function predict(x, y, vx, vy) {
        const pts = [];
        let px = x;
        let py = y;
        for (let s = 0; s < 400; s++) {
            let ax = 0;
            let ay = 0;
            for (const b of bodies) {
                const dx = b.x - px;
                const dy = b.y - py;
                const d2 = dx * dx + dy * dy + SOFT;
                const inv = b.m / (d2 * Math.sqrt(d2));
                ax += dx * inv;
                ay += dy * inv;
                if (d2 < radius(b.m) ** 2) return pts;
            }
            vx += ax * 0.5;
            vy += ay * 0.5;
            px += vx * 0.5;
            py += vy * 0.5;
            if (s % 4 === 0) pts.push(px, py);
        }
        return pts;
    }

    function launchVelocity() {
        return [(aim.x0 - aim.x1) * 0.04, (aim.y0 - aim.y1) * 0.04];
    }

    function draw() {
        const rgb = ink();
        ctx.clearRect(0, 0, w, h);
        ctx.lineWidth = 1;
        for (const b of bodies) {
            const t = b.trail;
            for (let i = 2; i < t.length; i += 2) {
                ctx.strokeStyle = `rgba(${rgb},${(i / t.length) * 0.5})`;
                ctx.beginPath();
                ctx.moveTo(t[i - 2], t[i - 1]);
                ctx.lineTo(t[i], t[i + 1]);
                ctx.stroke();
            }
        }
        ctx.fillStyle = `rgb(${rgb})`;
        for (const b of bodies) {
            const r = radius(b.m);
            ctx.beginPath();
            ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        if (aim) {
            const [vx, vy] = launchVelocity();
            const pts = predict(aim.x0, aim.y0, vx, vy);
            ctx.fillStyle = `rgba(${rgb},0.7)`;
            for (let i = 0; i < pts.length; i += 2) ctx.fillRect(pts[i] - 1, pts[i + 1] - 1, 2, 2);
            ctx.strokeStyle = `rgba(${rgb},0.4)`;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(aim.x0, aim.y0);
            ctx.lineTo(aim.x1, aim.y1);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = `rgb(${rgb})`;
            ctx.beginPath();
            ctx.arc(aim.x0, aim.y0, radius(opts.mass), 0, Math.PI * 2);
            ctx.fill();
        }
    }

    return {
        resize(nw, nh) {
            const first = !w;
            const dx = (nw - w) / 2;
            const dy = (nh - h) / 2;
            w = nw;
            h = nh;
            if (first) load(scene);
            else for (const b of bodies) (b.x += dx), (b.y += dy), (b.trail = []);
        },
        frame(t, dt) {
            if (playing) {
                const sub = 4;
                const sdt = (dt * 60 * opts.speed) / sub;
                accel(bodies);
                for (let s = 0; s < sub; s++) step(sdt);
                for (const b of bodies) {
                    b.trail.push(b.x, b.y);
                    if (b.trail.length > opts.trail * 2) b.trail.splice(0, b.trail.length - opts.trail * 2);
                }
            }
            draw();
            listener({ n: bodies.length, time });
        },
        down(p) {
            aim = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
        },
        move(p) {
            if (aim && p.down) {
                aim.x1 = p.x;
                aim.y1 = p.y;
            }
        },
        up() {
            if (!aim) return;
            const [vx, vy] = launchVelocity();
            bodies.push(body(aim.x0, aim.y0, vx, vy, opts.mass));
            aim = null;
            wake();
        },
        running: () => playing,
        onStats(fn) {
            listener = fn;
        },
        set(key, value) {
            opts[key] = value;
            wake();
        },
        load(id) {
            load(id);
            wake();
        },
        reset() {
            load(scene);
            wake();
        },
        play(on) {
            playing = on;
            wake();
        },
    };
}

export default function Gravity() {
    const { canvasRef, toyRef } = useToy(create);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [scene, setScene] = useState("solar");
    const [s, setS] = useState({ mass: 20, speed: 1, trail: 120, merge: true });
    const [playing, setPlaying] = useState(!reduced);
    const [stats, setStats] = useState({ n: 0, time: 0 });
    const set = (key) => (val) => {
        setS((o) => ({ ...o, [key]: val }));
        toyRef.current?.set(key, val);
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
            <canvas ref={canvasRef} className="fill-canvas" />
            <ToyPanel>
                <ToySelect label="Scene" value={scene} options={SCENES.map((x) => ({ value: x.id, label: x.label }))} onChange={(id) => (setScene(id), toyRef.current?.load(id))} />
                <ToySlider label="New body mass" value={s.mass} min={1} max={2000} onChange={set("mass")} />
                <ToySlider label="Time speed" value={s.speed} min={0.1} max={3} step={0.1} onChange={set("speed")} format={(x) => x.toFixed(1) + "×"} />
                <ToySlider label="Trail length" value={s.trail} min={0} max={400} step={10} onChange={set("trail")} />
                <ToyButtons
                    items={[
                        { id: "play", label: playing ? "Pause" : "Play", onClick: () => (setPlaying(!playing), toyRef.current?.play(!playing)) },
                        { id: "merge", label: "Merge", active: s.merge, onClick: () => set("merge")(!s.merge) },
                        { id: "reset", label: "Reset", onClick: () => toyRef.current?.reset() },
                    ]}
                />
                <ToyReadout
                    items={[
                        ["Bodies", stats.n],
                        ["Time", Math.round(stats.time)],
                    ]}
                />
            </ToyPanel>
            <ToyTools tools={[]} hint="Drag to launch a body · the dots show its path" />
        </>
    );
}
