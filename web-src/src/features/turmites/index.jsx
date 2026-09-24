import { useEffect, useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToySelect, ToyButtons, ToyReadout } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// Langton's ant and its relatives. An ant stands on a grid of coloured
// cells; it turns left or right depending on the colour under it, bumps
// that cell to the next colour and steps forward. "RL" is the classic ant:
// ten thousand steps of mess, then it suddenly builds a highway.
const CELL = 4;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export const RULES = [
    { id: "RL", label: "RL · Langton's ant" },
    { id: "RLR", label: "RLR · growing chaos" },
    { id: "LLRR", label: "LLRR · symmetric blob" },
    { id: "LRRRRRLLR", label: "LRRRRRLLR · square" },
    { id: "RRLLLRLLLRRR", label: "RRLLLRLLLRRR · triangle" },
    { id: "LLRRRLRLRLLR", label: "LLRRRLRLRLLR · convoluted" },
    { id: "RRLL", label: "RRLL · brain" },
];

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let grid = new Uint8Array(0);
    let img = null;
    let ants = [];
    let rule = "RL";
    let turns = [1, -1];
    let playing = !reduced;
    let speed = 60; // steps per frame
    let steps = 0;
    let listener = () => {};

    function setRule(r) {
        rule = r;
        turns = [...r].map((c) => (c === "R" ? 1 : -1));
    }

    function reset() {
        grid.fill(0);
        ants = [{ x: w >> 1, y: h >> 1, d: 0 }];
        steps = 0;
    }

    function step() {
        const k = turns.length;
        for (const a of ants) {
            const i = a.y * w + a.x;
            const c = grid[i];
            a.d = (a.d + turns[c] + 4) & 3;
            grid[i] = (c + 1) % k;
            a.x = (a.x + DX[a.d] + w) % w;
            a.y = (a.y + DY[a.d] + h) % h;
        }
        steps++;
    }

    function draw() {
        const [r, g, b] = ink().split(",").map(Number);
        const d = img.data;
        const k = turns.length - 1;
        for (let i = 0; i < grid.length; i++) {
            const o = i * 4;
            d[o] = r;
            d[o + 1] = g;
            d[o + 2] = b;
            const c = grid[i];
            d[o + 3] = c ? 60 + (195 * c) / k : 0;
        }
        for (const a of ants) {
            const o = (a.y * w + a.x) * 4;
            d[o + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
    }

    return {
        resize(nw, nh) {
            w = nw;
            h = nh;
            grid = new Uint8Array(w * h);
            img = ctx.createImageData(w, h);
            reset();
        },
        frame() {
            if (playing) for (let s = 0; s < speed; s++) step();
            draw();
            listener({ steps, ants: ants.length });
        },
        down(p) {
            const x = Math.floor(p.x);
            const y = Math.floor(p.y);
            if (p.button === 2) ants = ants.filter((a) => Math.abs(a.x - x) > 3 || Math.abs(a.y - y) > 3);
            else if (ants.length < 64) ants.push({ x, y, d: Math.floor(Math.random() * 4) });
            wake();
        },
        running: () => playing,
        onStats(fn) {
            listener = fn;
        },
        setRule(r) {
            setRule(r);
            reset();
            wake();
        },
        setSpeed(v) {
            speed = v;
        },
        play(on) {
            playing = on;
            wake();
        },
        stepOnce() {
            step();
            wake();
        },
        reset() {
            reset();
            wake();
        },
    };
}

export default function Turmites() {
    const { canvasRef, toyRef } = useToy(create, { cell: CELL });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [rule, setRule] = useState("RL");
    const [speed, setSpeed] = useState(Math.log10(60));
    const [playing, setPlaying] = useState(!reduced);
    const [stats, setStats] = useState({ steps: 0, ants: 1 });
    const toy = () => toyRef.current;

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
            <canvas ref={canvasRef} className="fill-canvas pixel-canvas" />
            <ToyPanel>
                <ToySelect label="Rule" value={rule} options={RULES.map((r) => ({ value: r.id, label: r.label }))} onChange={(r) => (setRule(r), toy()?.setRule(r))} />
                <ToySlider
                    label="Speed"
                    value={speed}
                    min={0}
                    max={3.7}
                    step={0.05}
                    onChange={(v) => (setSpeed(v), toy()?.setSpeed(Math.round(10 ** v)))}
                    format={(v) => Math.round(10 ** v).toLocaleString() + " steps/frame"}
                />
                <ToyButtons
                    items={[
                        { id: "play", label: playing ? "Pause" : "Play", onClick: () => (setPlaying(!playing), toy()?.play(!playing)) },
                        { id: "step", label: "Step", onClick: () => toy()?.stepOnce() },
                        { id: "reset", label: "Reset", onClick: () => toy()?.reset() },
                    ]}
                />
                <ToyReadout
                    items={[
                        ["Steps", stats.steps.toLocaleString()],
                        ["Ants", stats.ants],
                    ]}
                />
            </ToyPanel>
            <ToyTools tools={[]} hint="Click to drop another ant · right-click to remove one" />
        </>
    );
}
