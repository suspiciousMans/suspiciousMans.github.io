import { useEffect, useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToySelect, ToyButtons, ToyReadout } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// A workbench for "life-like" cellular automata. Every cell looks at its
// eight neighbours; a rule says how many neighbours bring a dead cell to
// life (B) and how many keep a live one alive (S). Conway's Life is B3/S23.
// Brian's Brain adds a third "dying" state. Cells leave a fading trail.
const CELL = 5;

export const RULES = [
    { id: "life", label: "Life  B3/S23", b: [3], s: [2, 3] },
    { id: "highlife", label: "HighLife  B36/S23", b: [3, 6], s: [2, 3] },
    { id: "daynight", label: "Day & Night  B3678/S34678", b: [3, 6, 7, 8], s: [3, 4, 6, 7, 8] },
    { id: "seeds", label: "Seeds  B2/S", b: [2], s: [] },
    { id: "maze", label: "Maze  B3/S12345", b: [3], s: [1, 2, 3, 4, 5] },
    { id: "coral", label: "Coral  B3/S45678", b: [3], s: [4, 5, 6, 7, 8] },
    { id: "replicator", label: "Replicator  B1357/S1357", b: [1, 3, 5, 7], s: [1, 3, 5, 7] },
    { id: "brain", label: "Brian's Brain (3 states)", b: [2], s: [], brain: true },
];

// Patterns as rows of "#" (alive) and "." (dead), stamped where you click.
export const PATTERNS = {
    cell: ["#"],
    glider: [".#.", "..#", "###"],
    lwss: [".#..#", "#....", "#...#", "####."],
    pulsar: [
        "..###...###..",
        ".............",
        "#....#.#....#",
        "#....#.#....#",
        "#....#.#....#",
        "..###...###..",
        ".............",
        "..###...###..",
        "#....#.#....#",
        "#....#.#....#",
        "#....#.#....#",
        ".............",
        "..###...###..",
    ],
    rpent: [".##", "##.", ".#."],
    acorn: [".#.....", "...#...", "##..###"],
    gun: [
        "........................#...........",
        "......................#.#...........",
        "............##......##............##",
        "...........#...#....##............##",
        "##........#.....#...##..............",
        "##........#...#.##....#.#...........",
        "..........#.....#.......#...........",
        "...........#...#....................",
        "............##......................",
    ],
};

const PATTERN_OPTIONS = [
    { value: "cell", label: "Pencil" },
    { value: "glider", label: "Glider" },
    { value: "lwss", label: "Spaceship" },
    { value: "pulsar", label: "Pulsar" },
    { value: "rpent", label: "R-pentomino" },
    { value: "acorn", label: "Acorn" },
    { value: "gun", label: "Glider gun" },
];

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let grid = new Uint8Array(0); // 0 dead, 1 alive, 2 dying (Brian's Brain)
    let next = new Uint8Array(0);
    let trail = new Float32Array(0);
    let img = null;
    let rule = RULES[0];
    let born = new Uint8Array(9);
    let stay = new Uint8Array(9);
    let pattern = "cell";
    let playing = !reduced;
    let rate = 15; // generations per second
    let acc = 0;
    let gen = 0;
    let pop = 0;
    let drawing = null;
    let lastCell = -1;
    let listener = () => {};

    function setRule(r) {
        rule = r;
        born = new Uint8Array(9);
        stay = new Uint8Array(9);
        r.b.forEach((n) => (born[n] = 1));
        r.s.forEach((n) => (stay[n] = 1));
    }
    setRule(rule);

    function step() {
        let count = 0;
        for (let y = 0; y < h; y++) {
            const yu = ((y - 1 + h) % h) * w;
            const yd = ((y + 1) % h) * w;
            const yc = y * w;
            for (let x = 0; x < w; x++) {
                const xl = (x - 1 + w) % w;
                const xr = (x + 1) % w;
                const n =
                    (grid[yu + xl] === 1) + (grid[yu + x] === 1) + (grid[yu + xr] === 1) +
                    (grid[yc + xl] === 1) + (grid[yc + xr] === 1) +
                    (grid[yd + xl] === 1) + (grid[yd + x] === 1) + (grid[yd + xr] === 1);
                const i = yc + x;
                const c = grid[i];
                let out;
                if (rule.brain) out = c === 1 ? 2 : c === 2 ? 0 : n === 2 ? 1 : 0;
                else out = c === 1 ? (stay[n] ? 1 : 0) : born[n] ? 1 : 0;
                next[i] = out;
                if (out === 1) count++;
            }
        }
        [grid, next] = [next, grid];
        gen++;
        pop = count;
    }

    function stamp(cx, cy, erase) {
        const rows = PATTERNS[pattern];
        const oy = Math.round(cy) - Math.floor(rows.length / 2);
        const ox = Math.round(cx) - Math.floor(rows[0].length / 2);
        rows.forEach((row, y) => {
            for (let x = 0; x < row.length; x++) {
                if (row[x] !== "#") continue;
                const gx = (ox + x + w) % w;
                const gy = (oy + y + h) % h;
                grid[gy * w + gx] = erase ? 0 : 1;
            }
        });
    }

    function randomize(density) {
        for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < density ? 1 : 0;
        gen = 0;
    }

    function draw() {
        const [r, g, b] = ink().split(",").map(Number);
        const d = img.data;
        let count = 0;
        for (let i = 0; i < grid.length; i++) {
            const c = grid[i];
            if (c === 1) {
                trail[i] = 1;
                count++;
            } else trail[i] *= 0.9;
            const o = i * 4;
            d[o] = r;
            d[o + 1] = g;
            d[o + 2] = b;
            d[o + 3] = c === 1 ? 255 : c === 2 ? 150 : trail[i] > 0.04 ? trail[i] * 70 : 0;
        }
        pop = count;
        ctx.putImageData(img, 0, 0);
    }

    function report() {
        listener({ gen, pop });
    }

    return {
        resize(nw, nh) {
            const old = grid;
            const ow = w;
            w = nw;
            h = nh;
            grid = new Uint8Array(w * h);
            next = new Uint8Array(w * h);
            trail = new Float32Array(w * h);
            img = ctx.createImageData(w, h);
            if (!ow) {
                randomize(0.18);
                return;
            }
            // Keep the pattern when the stage changes size (e.g. fullscreen).
            for (let i = 0; i < old.length; i++) {
                const x = i % ow;
                const y = Math.floor(i / ow);
                if (old[i] && x < w && y < h) grid[y * w + x] = old[i];
            }
        },
        frame(t, dt) {
            if (playing) {
                acc += dt * rate;
                let n = Math.min(8, Math.floor(acc));
                acc -= Math.floor(acc);
                while (n-- > 0) step();
            }
            draw();
            report();
        },
        down(p) {
            drawing = p;
            lastCell = -1;
            stamp(p.x, p.y, p.button === 2);
        },
        move(p) {
            if (!drawing || pattern !== "cell") return;
            const i = Math.floor(p.y) * w + Math.floor(p.x);
            if (i !== lastCell) stamp(p.x, p.y, p.button === 2);
            lastCell = i;
        },
        up() {
            drawing = null;
        },
        running: () => playing,
        onStats(fn) {
            listener = fn;
        },
        setRule(id) {
            setRule(RULES.find((r) => r.id === id) || RULES[0]);
            wake();
        },
        setPattern(p) {
            pattern = p;
        },
        setRate(r) {
            rate = r;
        },
        play(on) {
            playing = on;
            wake();
        },
        stepOnce() {
            step();
            wake();
        },
        randomize(d) {
            randomize(d);
            wake();
        },
        clear() {
            grid.fill(0);
            trail.fill(0);
            gen = 0;
            wake();
        },
    };
}

export default function LifeLab() {
    const { canvasRef, toyRef } = useToy(create, { cell: CELL });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [rule, setRule] = useState(RULES[0].id);
    const [pattern, setPattern] = useState("cell");
    const [rate, setRate] = useState(15);
    const [density, setDensity] = useState(0.18);
    const [playing, setPlaying] = useState(!reduced);
    const [stats, setStats] = useState({ gen: 0, pop: 0 });
    const toy = () => toyRef.current;

    // The toy exists once useToy's effect has run (it's declared first), so
    // this one can hook up the read-out, throttled to a few updates a second.
    useEffect(() => {
        let lastAt = 0;
        toyRef.current?.onStats((s) => {
            const now = performance.now();
            if (now - lastAt < 200) return;
            lastAt = now;
            setStats(s);
        });
    }, [toyRef]);

    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas pixel-canvas" />
            <ToyPanel>
                <ToySelect
                    label="Rule"
                    value={rule}
                    options={RULES.map((r) => ({ value: r.id, label: r.label }))}
                    onChange={(id) => (setRule(id), toy()?.setRule(id))}
                />
                <ToySelect label="Draw with" value={pattern} options={PATTERN_OPTIONS} onChange={(p) => (setPattern(p), toy()?.setPattern(p))} />
                <ToySlider label="Speed" value={rate} min={1} max={60} onChange={(r) => (setRate(r), toy()?.setRate(r))} format={(r) => r + " gen/s"} />
                <ToySlider label="Random fill" value={density} min={0.05} max={0.6} step={0.01} onChange={setDensity} format={(d) => Math.round(d * 100) + "%"} />
                <ToyButtons
                    items={[
                        { id: "play", label: playing ? "Pause" : "Play", onClick: () => (setPlaying(!playing), toy()?.play(!playing)) },
                        { id: "step", label: "Step", onClick: () => toy()?.stepOnce() },
                        { id: "random", label: "Random", onClick: () => toy()?.randomize(density) },
                        { id: "clear", label: "Clear", onClick: () => toy()?.clear() },
                    ]}
                />
                <ToyReadout
                    items={[
                        ["Generation", stats.gen.toLocaleString()],
                        ["Alive", stats.pop.toLocaleString()],
                    ]}
                />
            </ToyPanel>
            <ToyTools tools={[]} hint="Click or drag to draw · right-click to erase" />
        </>
    );
}
