import { useEffect, useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToyButtons, ToyReadout } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// A spirograph: a toothed wheel rolls round inside a ring with a pen
// poked through one of its holes. The gear teeth decide the pattern: the
// curve closes after (wheel ÷ common factor) laps and has (ring ÷ common
// factor) petals. Change the gears between drawings to layer them up.
const TAU = Math.PI * 2;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

function create({ canvas, ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    const paper = document.createElement("canvas");
    const pctx = paper.getContext("2d");
    const opts = { ring: 96, wheel: 52, pen: 0.7, speed: 1 };
    // Every curve drawn so far, so the paper can be redrawn in a new theme
    // colour or at a new size. The last one is the curve in progress.
    let layers = [];
    let drawing = !reduced;
    let drag = null;
    let offset = { x: 0, y: 0 };
    let paperInk = "";
    let listener = () => {};

    const laps = (L) => L.wheel / gcd(L.ring, L.wheel);
    const cur = () => layers[layers.length - 1];

    function geo(L) {
        const s = (Math.min(w, h) * 0.44) / L.ring;
        return { cx: w / 2 + L.ox, cy: h / 2 + L.oy, R: L.ring * s, r: L.wheel * s };
    }

    function penAt(L, a) {
        const { cx, cy, R, r } = geo(L);
        const d = L.pen * r;
        const k = (R - r) / r;
        return [cx + (R - r) * Math.cos(a) + d * Math.cos(k * a), cy + (R - r) * Math.sin(a) - d * Math.sin(k * a)];
    }

    function stroke(L, from, to) {
        pctx.strokeStyle = `rgba(${paperInk},0.9)`;
        pctx.lineWidth = 1.2;
        pctx.lineCap = "round";
        pctx.lineJoin = "round";
        pctx.beginPath();
        let p = penAt(L, from);
        pctx.moveTo(p[0], p[1]);
        // Small steps so tight loops stay smooth.
        for (let a = from; a < to; ) {
            a = Math.min(to, a + 0.01);
            p = penAt(L, a);
            pctx.lineTo(p[0], p[1]);
        }
        pctx.stroke();
    }

    function repaint() {
        paperInk = ink();
        pctx.clearRect(0, 0, w, h);
        for (const L of layers) if (L.t > 0) stroke(L, 0, L.t);
    }

    function advance(amount) {
        const L = cur();
        const end = laps(L) * TAU;
        if (L.t >= end) return false;
        const to = Math.min(end, L.t + amount);
        stroke(L, L.t, to);
        L.t = to;
        return to < end;
    }

    function draw() {
        const rgb = ink();
        if (rgb !== paperInk) repaint();
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(paper, 0, 0, w, h);
        const L = cur();
        if (L.t >= laps(L) * TAU && !drag) return;
        // The gears, drawn faintly over the paper.
        const { cx, cy, R, r } = geo(L);
        ctx.strokeStyle = `rgba(${rgb},0.3)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, TAU);
        ctx.stroke();
        const wx = cx + (R - r) * Math.cos(L.t);
        const wy = cy + (R - r) * Math.sin(L.t);
        ctx.beginPath();
        ctx.arc(wx, wy, r, 0, TAU);
        ctx.stroke();
        const [px, py] = penAt(L, L.t);
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.fillStyle = `rgb(${rgb})`;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, TAU);
        ctx.fill();
    }

    // Start a new curve with the current gears, unless the one in progress
    // hasn't drawn anything yet, in which case just retune it.
    function newCurve() {
        const L = { ring: opts.ring, wheel: opts.wheel, pen: opts.pen, ox: offset.x, oy: offset.y, t: 0 };
        if (layers.length && cur().t === 0) layers[layers.length - 1] = L;
        else layers.push(L);
        if (layers.length > 40) layers.shift();
    }
    newCurve();

    return {
        resize(nw, nh) {
            w = nw;
            h = nh;
            paper.width = canvas.width;
            paper.height = canvas.height;
            const dpr = canvas.width / w;
            pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            repaint();
        },
        frame(time, dt) {
            if (drawing && !drag) {
                if (reduced) while (advance(50));
                else if (!advance(dt * 6 * opts.speed * Math.max(1, laps(cur()) / 6))) drawing = false;
                if (reduced) drawing = false;
            }
            draw();
            const L = cur();
            listener({ laps: laps(L), petals: L.ring / gcd(L.ring, L.wheel), progress: Math.min(1, L.t / (laps(L) * TAU)) });
        },
        down(p) {
            drag = { x: p.x, y: p.y, ox: offset.x, oy: offset.y };
        },
        move(p) {
            if (!drag || !p.down) return;
            offset = { x: drag.ox + p.x - drag.x, y: drag.oy + p.y - drag.y };
            newCurve();
        },
        up() {
            if (drag) {
                newCurve();
                drawing = true;
            }
            drag = null;
            wake();
        },
        running: () => drawing,
        onStats(fn) {
            listener = fn;
        },
        set(key, v) {
            opts[key] = v;
            if (key !== "speed") {
                const L = cur();
                // Changing gears mid-curve leaves the part drawn so far.
                if (L.t > 0 && L.t < laps(L) * TAU) drawing = false;
                newCurve();
            }
            wake();
        },
        draw() {
            const L = cur();
            if (L.t >= laps(L) * TAU) newCurve();
            drawing = true;
            wake();
        },
        pause() {
            drawing = false;
            wake();
        },
        clear() {
            layers = [];
            offset = { x: 0, y: 0 };
            newCurve();
            repaint();
            drawing = false;
            wake();
        },
    };
}

export default function Spirograph() {
    const { canvasRef, toyRef } = useToy(create);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [s, setS] = useState({ ring: 96, wheel: 52, pen: 0.7, speed: 1 });
    const [stats, setStats] = useState({ laps: 13, petals: 24, progress: 0 });
    const toy = () => toyRef.current;
    const set = (key) => (v) => {
        setS((o) => ({ ...o, [key]: v }));
        toy()?.set(key, v);
    };
    const random = () => {
        const ring = [72, 84, 96, 105, 120, 144][Math.floor(Math.random() * 6)];
        const wheel = 20 + Math.floor(Math.random() * (ring - 30));
        const pen = Math.round((0.3 + Math.random() * 0.65) * 100) / 100;
        setS((o) => ({ ...o, ring, wheel, pen }));
        toy()?.set("ring", ring);
        toy()?.set("wheel", wheel);
        toy()?.set("pen", pen);
        toy()?.draw();
    };

    useEffect(() => {
        let lastAt = 0;
        toyRef.current?.onStats((st) => {
            const now = performance.now();
            if (now - lastAt < 200) return;
            lastAt = now;
            setStats(st);
        });
    }, [toyRef]);

    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas" />
            <ToyPanel>
                <ToySlider
                    label="Ring teeth"
                    value={s.ring}
                    min={40}
                    max={150}
                    onChange={(v) => {
                        if (s.wheel >= v) set("wheel")(v - 1);
                        set("ring")(v);
                    }}
                />
                <ToySlider label="Wheel teeth" value={s.wheel} min={10} max={Math.min(140, s.ring - 1)} onChange={set("wheel")} />
                <ToySlider label="Pen hole" value={s.pen} min={0.05} max={1.2} step={0.01} onChange={set("pen")} format={(v) => Math.round(v * 100) + "%"} />
                <ToySlider label="Speed" value={s.speed} min={0.2} max={5} step={0.1} onChange={set("speed")} format={(v) => v.toFixed(1) + "×"} />
                <ToyButtons
                    items={[
                        { id: "draw", label: "Draw", onClick: () => toy()?.draw() },
                        { id: "pause", label: "Pause", onClick: () => toy()?.pause() },
                    ]}
                />
                <ToyReadout
                    items={[
                        ["Petals", stats.petals],
                        ["Laps to close", stats.laps],
                        ["Drawn", Math.round(stats.progress * 100) + "%"],
                    ]}
                />
            </ToyPanel>
            <ToyTools
                tools={[
                    { id: "draw", label: "Draw", onClick: () => toy()?.draw() },
                    { id: "random", label: "Surprise me", onClick: random },
                    { id: "clear", label: "Clear", onClick: () => toy()?.clear() },
                ]}
                hint="Drag to move the ring and start a new curve there"
            />
        </>
    );
}
