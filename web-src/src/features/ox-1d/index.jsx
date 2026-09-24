import { useEffect, useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToyReadout } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";
import OxToy, { useAutoRun, useLatestRun, describe } from "../OxToy.jsx";
import { splitOutput, toNumber, checkSource } from "../oxidized.js";

// One-dimensional cellular automata, the kind Stephen Wolfram catalogued:
// a single row of cells, where each cell's next value depends on itself
// and its two neighbours. Each new row is drawn under the last, so time
// runs down the screen. You write `rule(left, me, right)` in Oxidized; it's
// run for every combination once and the answers become a lookup table.
const CELL = 3;

const HEAD = `// Runs for every cell in the row, every step.
//   left, me, right   the states of the cell and its two
//                     neighbours (0 or 1, unless you add states)
// Return the cell's state in the next row.

`;

export const EXAMPLES = [
    {
        id: "rule30",
        label: "Rule 30 (chaos)",
        code: `${HEAD}fn rule(left, me, right) -> Int {
    # left XOR (me OR right)
    let either = 0
    if me == 1 || right == 1 { either = 1 }
    if left != either { return 1 }
    return 0
}
`,
    },
    {
        id: "rule90",
        label: "Rule 90 (Sierpiński)",
        code: `${HEAD}fn rule(left, me, right) -> Int {
    # on if exactly one neighbour is on
    return (left + right) % 2
}
`,
    },
    {
        id: "number",
        label: "Any Wolfram rule by number",
        code: `${HEAD}fn rule(left, me, right) -> Int {
    # try 110, 30, 73, 105, 150, 184...
    let number = 110

    # the 8 neighbourhoods, 111 down to 000, are the 8
    # binary digits of the number: look up ours
    let index = left * 4 + me * 2 + right
    let bits = number
    for i in range(0, index) {
        bits = bits / 2
    }
    return bits % 2
}
`,
    },
    {
        id: "three",
        label: "Three colours",
        code: `${HEAD}fn states() -> Int {
    return 3
}

fn rule(left, me, right) -> Int {
    return (left + me + right) % 3
}
`,
    },
    {
        id: "four",
        label: "Four colours, lopsided",
        code: `${HEAD}fn states() -> Int {
    return 4
}

fn rule(left, me, right) -> Int {
    return (left + 2 * me + 3 * right + 1) % 4
}
`,
    },
    {
        id: "blank",
        label: "Start from scratch",
        code: `${HEAD}fn rule(left, me, right) -> Int {
    return me
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
    if k >= 2 && k <= 5 {
        for l in range(0, k) {
            for m in range(0, k) {
                for r in range(0, k) {
                    print("@", rule(l, m, r))
                }
            }
        }
    }
}
`;
}

function readTable(data) {
    const k = toNumber((data[0] || "").split(" ")[1]);
    if (!Number.isInteger(k) || k < 2 || k > 5) return { error: `states() returned ${data[0]?.split(" ")[1]}; it needs to be from 2 to 5.` };
    const table = new Uint8Array(k * k * k);
    for (let i = 0; i < table.length; i++) {
        const raw = (data[1 + i] || "").slice(2);
        const v = toNumber(raw);
        if (!Number.isInteger(v) || v < 0 || v >= k) {
            const l = Math.floor(i / (k * k));
            const m = Math.floor(i / k) % k;
            return { error: `rule(${l}, ${m}, ${i % k}) returned ${raw || "nothing"}, but the next state has to be a whole number from 0 to ${k - 1}.` };
        }
        table[i] = v;
    }
    return { k, table };
}

// For two-state rules, the Wolfram number the table works out to.
function wolfram(k, table) {
    if (k !== 2) return `${k} states`;
    let n = 0;
    for (let i = 0; i < 8; i++) n += table[i] << i;
    return `Rule ${n}`;
}

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let rows = new Uint8Array(0); // h rows of w cells, a ring buffer
    let head = 0; // next row to write
    let filled = 0;
    let img = null;
    let k = 2;
    let table = null;
    let playing = !reduced;
    let rate = 40;
    let acc = 0;
    let steps = 0;
    let start = "single";
    let listener = () => {};

    function seed() {
        rows.fill(0);
        head = 1;
        filled = 1;
        steps = 0;
        if (start === "single") rows[w >> 1] = 1;
        else for (let x = 0; x < w; x++) rows[x] = Math.floor(Math.random() * k);
    }

    function step() {
        if (!table) return;
        const prev = ((head - 1 + h) % h) * w;
        const cur = head * w;
        for (let x = 0; x < w; x++) {
            const l = rows[prev + ((x - 1 + w) % w)];
            const m = rows[prev + x];
            const r = rows[prev + ((x + 1) % w)];
            rows[cur + x] = table[(l * k + m) * k + r];
        }
        head = (head + 1) % h;
        filled = Math.min(h, filled + 1);
        steps++;
    }

    function draw() {
        const [r, g, b] = ink().split(",").map(Number);
        const d = img.data;
        // Oldest row at the top; once the screen is full it scrolls.
        const top = filled < h ? 0 : head;
        for (let y = 0; y < h; y++) {
            const src = ((top + y) % h) * w;
            const live = y < filled;
            for (let x = 0; x < w; x++) {
                const s = live ? rows[src + x] : 0;
                const o = (y * w + x) * 4;
                d[o] = r;
                d[o + 1] = g;
                d[o + 2] = b;
                d[o + 3] = s === 0 ? 0 : k === 2 ? 255 : 70 + (185 * s) / (k - 1);
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    return {
        resize(nw, nh) {
            w = nw;
            h = nh;
            rows = new Uint8Array(w * h);
            img = ctx.createImageData(w, h);
            seed();
        },
        frame(t, dt) {
            if (playing && table) {
                acc += dt * rate;
                let n = Math.min(h, Math.floor(acc));
                acc -= Math.floor(acc);
                while (n-- > 0) step();
            }
            draw();
            listener({ steps });
        },
        down(p) {
            // Flip the cell under the pointer in the newest row.
            const x = Math.floor(p.x);
            const row = ((head - 1 + h) % h) * w;
            rows[row + x] = (rows[row + x] + 1) % k;
            wake();
        },
        running: () => playing && !!table,
        onStats(fn) {
            listener = fn;
        },
        setRule(nk, nt) {
            // Every rule change starts over from the seed row.
            k = nk;
            table = nt;
            seed();
            wake();
        },
        setRate(r) {
            rate = r;
        },
        setStart(s) {
            start = s;
            seed();
            wake();
        },
        restart() {
            seed();
            wake();
        },
        play(on) {
            playing = on;
            wake();
        },
    };
}

export default function Ox1D() {
    const { canvasRef, toyRef } = useToy(create, { cell: CELL });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [example, setExample] = useState("rule30");
    const [code, setCode] = useState(EXAMPLES[0].code);
    const [status, setStatus] = useState({ kind: "running", text: "Loading Oxidized…" });
    const [printed, setPrinted] = useState([]);
    const [rule, setRule] = useState("");
    const [playing, setPlaying] = useState(!reduced);
    const [rate, setRate] = useState(40);
    const [start, setStart] = useState("single");
    const [stats, setStats] = useState({ steps: 0 });
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
        const name = wolfram(t.k, t.table);
        setRule(name);
        setStatus({ kind: "ok", text: `Running your rule · ${name}` });
    }

    const runNow = useAutoRun(code, compile);

    useEffect(() => {
        let lastAt = 0;
        toyRef.current?.onStats((st) => {
            const now = performance.now();
            if (now - lastAt < 250) return;
            lastAt = now;
            setStats(st);
        });
    }, [toyRef]);

    const pickStart = (s) => (setStart(s), toy()?.setStart(s));

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
                <ToySlider label="Speed" value={rate} min={2} max={200} onChange={(v) => (setRate(v), toy()?.setRate(v))} format={(v) => v + " rows/s"} />
                <ToyReadout
                    items={[
                        ["Rule", rule || "–"],
                        ["Rows", stats.steps.toLocaleString()],
                    ]}
                />
            </ToyPanel>
            <ToyTools
                tools={[
                    { id: "play", label: playing ? "Pause" : "Play", onClick: () => (setPlaying(!playing), toy()?.play(!playing)) },
                    { id: "single", label: "One cell", active: start === "single", onClick: () => pickStart("single") },
                    { id: "random", label: "Random", active: start === "random", onClick: () => pickStart("random") },
                ]}
                hint="Click to flip a cell in the newest row"
            />
        </OxToy>
    );
}
