import { useEffect, useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToyReadout } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";
import OxToy, { useAutoRun, useLatestRun, describe } from "../OxToy.jsx";
import { splitOutput, toNumber, checkSource } from "../oxidized.js";

// Cellular automata whose rule you write in Oxidized. Your `rule(cell,
// alive)` is run once for every possible input (each state against 0 to 8
// live neighbours) and the answers become a lookup table, so the grid then
// runs at full speed however slow the rule is.
const CELL = 5;

const HEAD = `// Runs for every cell, every generation.
//   cell   this cell's state: 0 empty, 1 alive
//          (2 and up are "dying" if you add states)
//   alive  how many of its 8 neighbours are alive
// Return the cell's next state.

`;

export const EXAMPLES = [
    {
        id: "life",
        label: "Conway's Life",
        code: `${HEAD}fn rule(cell, alive) -> Int {
    if cell == 1 {
        # stay alive with 2 or 3 neighbours
        if alive == 2 || alive == 3 { return 1 }
        return 0
    }
    # come alive with exactly 3
    if alive == 3 { return 1 }
    return 0
}
`,
    },
    {
        id: "highlife",
        label: "HighLife (replicators)",
        code: `${HEAD}fn rule(cell, alive) -> Int {
    if cell == 1 {
        if alive == 2 || alive == 3 { return 1 }
        return 0
    }
    # like Life, but 6 neighbours also give birth
    if alive == 3 || alive == 6 { return 1 }
    return 0
}
`,
    },
    {
        id: "daynight",
        label: "Day & Night",
        code: `${HEAD}fn rule(cell, alive) -> Int {
    # symmetric: live and dead regions behave the same
    if cell == 1 {
        if contains([3, 4, 6, 7, 8], alive) { return 1 }
        return 0
    }
    if contains([3, 6, 7, 8], alive) { return 1 }
    return 0
}
`,
    },
    {
        id: "seeds",
        label: "Seeds (explosive)",
        code: `${HEAD}fn rule(cell, alive) -> Int {
    # every live cell dies; empty cells with 2 neighbours are born
    if cell == 0 && alive == 2 { return 1 }
    return 0
}
`,
    },
    {
        id: "maze",
        label: "Mazes",
        code: `${HEAD}fn rule(cell, alive) -> Int {
    if cell == 1 {
        if alive >= 1 && alive <= 5 { return 1 }
        return 0
    }
    if alive == 3 { return 1 }
    return 0
}
`,
    },
    {
        id: "brain",
        label: "Brian's Brain (3 states)",
        code: `${HEAD}# three states: 0 off, 1 firing, 2 resting
fn states() -> Int {
    return 3
}

fn rule(cell, alive) -> Int {
    if cell == 1 { return 2 }      # firing cells rest
    if cell == 2 { return 0 }      # resting cells switch off
    if alive == 2 { return 1 }     # off cells fire with 2 firing neighbours
    return 0
}
`,
    },
    {
        id: "starwars",
        label: "Star Wars (4 states)",
        code: `${HEAD}fn states() -> Int {
    return 4
}

fn rule(cell, alive) -> Int {
    if cell == 1 {
        if contains([3, 4, 5], alive) { return 1 }
        return 2                   # start dying
    }
    if cell >= 2 {
        return (cell + 1) % 4      # 2 → 3 → 0
    }
    if alive == 2 { return 1 }
    return 0
}
`,
    },
    {
        id: "blank",
        label: "Start from scratch",
        code: `${HEAD}fn rule(cell, alive) -> Int {
    # try: born with 3, survive with 2, 3 or 4?
    return 0
}
`,
    },
];

function harness(code) {
    const k = /\bfn\s+states\s*\(/.test(code) ? "states()" : "2";
    return `${code}

fn main() {
    let k = ${k}
    print("@k", k)
    if k >= 2 && k <= 8 {
        for c in range(0, k) {
            for n in range(0, 9) {
                print("@", rule(c, n))
            }
        }
    }
}
`;
}

// Turn the run's output into { k, table } or { error }.
function readTable(data) {
    const k = toNumber((data[0] || "").split(" ")[1]);
    if (!Number.isInteger(k) || k < 2 || k > 8) return { error: `states() returned ${data[0]?.split(" ")[1]}; it needs to be from 2 to 8.` };
    const table = new Uint8Array(k * 9);
    for (let c = 0; c < k; c++) {
        for (let n = 0; n <= 8; n++) {
            const raw = (data[1 + c * 9 + n] || "").slice(2);
            const v = toNumber(raw);
            if (!Number.isInteger(v) || v < 0 || v >= k) {
                return { error: `rule(${c}, ${n}) returned ${raw || "nothing"}, but the next state has to be a whole number from 0 to ${k - 1}.` };
            }
            table[c * 9 + n] = v;
        }
    }
    return { k, table };
}

// For two-state rules, the B/S notation people use for Life-like rules.
function notation(k, table) {
    if (k !== 2) return `${k} states`;
    const b = [];
    const s = [];
    for (let n = 0; n <= 8; n++) {
        if (table[n] === 1) b.push(n);
        if (table[9 + n] === 1) s.push(n);
    }
    return `B${b.join("")}/S${s.join("")}`;
}

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let grid = new Uint8Array(0);
    let next = new Uint8Array(0);
    let img = null;
    let k = 2;
    let table = null;
    let playing = !reduced;
    let rate = 12;
    let acc = 0;
    let gen = 0;
    let drawing = null;
    let listener = () => {};

    function randomize(density) {
        for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < density ? 1 : 0;
        gen = 0;
    }

    function step() {
        if (!table) return;
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
                next[yc + x] = table[grid[yc + x] * 9 + n];
            }
        }
        [grid, next] = [next, grid];
        gen++;
    }

    function paint(p) {
        const x = Math.floor(p.x);
        const y = Math.floor(p.y);
        for (let j = 0; j <= 1; j++) {
            for (let i = 0; i <= 1; i++) {
                const gx = (x + i + w) % w;
                const gy = (y + j + h) % h;
                grid[gy * w + gx] = p.button === 2 ? 0 : 1;
            }
        }
    }

    function draw() {
        const [r, g, b] = ink().split(",").map(Number);
        const d = img.data;
        let pop = 0;
        for (let i = 0; i < grid.length; i++) {
            const s = grid[i];
            const o = i * 4;
            d[o] = r;
            d[o + 1] = g;
            d[o + 2] = b;
            if (s === 1) pop++;
            // Extra states fade as they count up toward the last one.
            d[o + 3] = s === 0 ? 0 : s === 1 ? 255 : 40 + (150 * (k - s)) / Math.max(1, k - 2);
        }
        ctx.putImageData(img, 0, 0);
        return pop;
    }

    return {
        resize(nw, nh) {
            const first = !w;
            const old = grid;
            const ow = w;
            w = nw;
            h = nh;
            grid = new Uint8Array(w * h);
            next = new Uint8Array(w * h);
            img = ctx.createImageData(w, h);
            if (first) return randomize(0.2);
            for (let i = 0; i < old.length; i++) {
                const x = i % ow;
                const y = Math.floor(i / ow);
                if (old[i] && x < w && y < h) grid[y * w + x] = old[i];
            }
        },
        frame(t, dt) {
            if (drawing) paint(drawing);
            if (playing && table) {
                acc += dt * rate;
                let n = Math.min(6, Math.floor(acc));
                acc -= Math.floor(acc);
                while (n-- > 0) step();
            }
            const pop = draw();
            listener({ gen, pop });
        },
        down(p) {
            drawing = p;
        },
        up() {
            drawing = null;
        },
        running: () => playing && !!table,
        onStats(fn) {
            listener = fn;
        },
        setRule(nk, nt) {
            // Cells in states the new rule doesn't have become empty.
            if (nk < k) for (let i = 0; i < grid.length; i++) if (grid[i] >= nk) grid[i] = 0;
            k = nk;
            table = nt;
            wake();
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
            gen = 0;
            wake();
        },
    };
}

export default function OxLife() {
    const { canvasRef, toyRef } = useToy(create, { cell: CELL });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [example, setExample] = useState("life");
    const [code, setCode] = useState(EXAMPLES[0].code);
    const [status, setStatus] = useState({ kind: "running", text: "Loading Oxidized…" });
    const [printed, setPrinted] = useState([]);
    const [rule, setRule] = useState("");
    const [playing, setPlaying] = useState(!reduced);
    const [rate, setRate] = useState(12);
    const [density, setDensity] = useState(0.2);
    const [stats, setStats] = useState({ gen: 0, pop: 0 });
    const run = useLatestRun();
    const toy = () => toyRef.current;

    async function compile(src) {
        const bad = checkSource(src, ["rule"]);
        if (bad) return setStatus({ kind: "error", text: bad });
        setStatus((s) => (s.kind === "ok" ? s : { kind: "running", text: "Running your rule…" }));
        const result = await run(harness(src));
        if (!result) return;
        const { data, printed } = splitOutput(result.out || []);
        setPrinted(printed);
        if (!result.ok) return setStatus(describe(result));
        const t = readTable(data);
        if (t.error) return setStatus({ kind: "error", text: t.error });
        toy()?.setRule(t.k, t.table);
        const name = notation(t.k, t.table);
        setRule(name);
        setStatus({ kind: "ok", text: `Running your rule · ${name}` });
    }

    const runNow = useAutoRun(code, compile);

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
        <OxToy
            code={code}
            onCode={(c) => (setCode(c), setExample("edited"))}
            examples={EXAMPLES}
            example={example}
            onExample={(id) => {
                const ex = EXAMPLES.find((x) => x.id === id);
                if (!ex) return;
                setExample(id);
                setCode(ex.code);
            }}
            onRun={runNow}
            status={status}
            printed={printed}
        >
            <canvas ref={canvasRef} className="fill-canvas pixel-canvas" />
            <ToyPanel>
                <ToySlider label="Speed" value={rate} min={1} max={40} onChange={(v) => (setRate(v), toy()?.setRate(v))} format={(v) => v + " gen/s"} />
                <ToySlider label="Random fill" value={density} min={0.05} max={0.6} step={0.01} onChange={setDensity} format={(v) => Math.round(v * 100) + "%"} />
                <ToyReadout
                    items={[
                        ["Rule", rule || "–"],
                        ["Generation", stats.gen.toLocaleString()],
                        ["Alive", stats.pop.toLocaleString()],
                    ]}
                />
            </ToyPanel>
            <ToyTools
                tools={[
                    { id: "play", label: playing ? "Pause" : "Play", onClick: () => (setPlaying(!playing), toy()?.play(!playing)) },
                    { id: "step", label: "Step", onClick: () => toy()?.stepOnce() },
                    { id: "random", label: "Random", onClick: () => toy()?.randomize(density) },
                    { id: "clear", label: "Clear", onClick: () => toy()?.clear() },
                ]}
                hint="Drag to draw · right-drag to erase"
            />
        </OxToy>
    );
}
