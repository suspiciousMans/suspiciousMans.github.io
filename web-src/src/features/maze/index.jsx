import { useEffect, useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToySelect, ToyButtons, ToyReadout } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// Watch a maze get carved, then watch it get solved. Each generator is a
// different algorithm with its own texture: the backtracker makes long
// winding corridors, Prim's makes short bushy dead ends, Kruskal's joins
// scattered pieces, Wilson's is perfectly unbiased. The solver floods out
// from the start (breadth-first) or dives down one path at a time.
export const MAKERS = [
    { id: "backtrack", label: "Backtracker" },
    { id: "prim", label: "Prim's" },
    { id: "kruskal", label: "Kruskal's" },
    { id: "wilson", label: "Wilson's" },
    { id: "binary", label: "Binary tree" },
];

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let size = 16; // px per maze cell
    let C = 0;
    let R = 0;
    let ox = 0;
    let oy = 0;
    let openE, openS, carved; // passages east and south of each cell
    let dist = null; // solver's step count per cell, -1 unseen
    let path = [];
    let head = -1;
    let job = null; // the running generator
    let mode = "idle"; // make | solve | idle
    let maker = "backtrack";
    let solver = "bfs";
    let speed = 8;
    let start = 0;
    let goal = 0;
    let listener = () => {};

    const nbrs = (i) => {
        const x = i % C;
        const y = (i / C) | 0;
        const out = [];
        if (y > 0) out.push(i - C);
        if (x < C - 1) out.push(i + 1);
        if (y < R - 1) out.push(i + C);
        if (x > 0) out.push(i - 1);
        return out;
    };
    function link(a, b) {
        if (b < a) [a, b] = [b, a];
        if (b === a + 1) openE[a] = 1;
        else openS[a] = 1;
    }
    function linked(a, b) {
        if (b < a) [a, b] = [b, a];
        return b === a + 1 ? openE[a] : openS[a];
    }

    function* backtrack() {
        const stack = [Math.floor(Math.random() * C * R)];
        carved[stack[0]] = 1;
        while (stack.length) {
            const c = stack[stack.length - 1];
            head = c;
            const opts = nbrs(c).filter((n) => !carved[n]);
            if (!opts.length) {
                stack.pop();
                continue;
            }
            const n = opts[Math.floor(Math.random() * opts.length)];
            link(c, n);
            carved[n] = 1;
            stack.push(n);
            yield;
        }
    }

    function* prim() {
        const s = Math.floor(Math.random() * C * R);
        carved[s] = 1;
        const front = new Set(nbrs(s));
        while (front.size) {
            const arr = [...front];
            const c = arr[Math.floor(Math.random() * arr.length)];
            front.delete(c);
            const ins = nbrs(c).filter((n) => carved[n]);
            link(c, ins[Math.floor(Math.random() * ins.length)]);
            carved[c] = 1;
            head = c;
            for (const n of nbrs(c)) if (!carved[n]) front.add(n);
            yield;
        }
    }

    function* kruskal() {
        const parent = Int32Array.from({ length: C * R }, (_, i) => i);
        const find = (i) => {
            while (parent[i] !== i) i = parent[i] = parent[parent[i]];
            return i;
        };
        const edges = [];
        for (let i = 0; i < C * R; i++) {
            if (i % C < C - 1) edges.push([i, i + 1]);
            if (i + C < C * R) edges.push([i, i + C]);
        }
        for (const [a, b] of shuffle(edges)) {
            const ra = find(a);
            const rb = find(b);
            if (ra === rb) continue;
            parent[ra] = rb;
            link(a, b);
            carved[a] = carved[b] = 1;
            head = b;
            yield;
        }
    }

    function* wilson() {
        const n = C * R;
        carved[Math.floor(Math.random() * n)] = 1;
        let left = n - 1;
        const next = new Int32Array(n);
        while (left > 0) {
            let s;
            do s = Math.floor(Math.random() * n);
            while (carved[s]);
            // Random walk until it hits the maze; later visits overwrite
            // earlier exits, which erases any loops.
            let c = s;
            while (!carved[c]) {
                const ns = nbrs(c);
                next[c] = ns[Math.floor(Math.random() * ns.length)];
                c = next[c];
                head = c;
                if (Math.random() < 0.05) yield;
            }
            for (c = s; !carved[c]; c = next[c]) {
                link(c, next[c]);
                carved[c] = 1;
                left--;
                head = c;
                yield;
            }
        }
    }

    function* binary() {
        for (let i = 0; i < C * R; i++) {
            const x = i % C;
            const y = (i / C) | 0;
            const ch = [];
            if (y > 0) ch.push(i - C);
            if (x > 0) ch.push(i - 1);
            if (ch.length) link(i, ch[Math.floor(Math.random() * ch.length)]);
            carved[i] = 1;
            head = i;
            yield;
        }
    }

    function* solve() {
        dist = new Int32Array(C * R).fill(-1);
        const from = new Int32Array(C * R).fill(-1);
        dist[start] = 0;
        const list = [start];
        const dfs = solver === "dfs";
        while (list.length) {
            const c = dfs ? list.pop() : list.shift();
            head = c;
            if (c === goal) break;
            const ns = nbrs(c).filter((n) => dist[n] < 0 && linked(c, n));
            if (dfs) shuffle(ns);
            for (const n of ns) {
                dist[n] = dist[c] + 1;
                from[n] = c;
                list.push(n);
            }
            yield;
        }
        path = [];
        for (let c = goal; c >= 0; c = from[c]) path.push(c);
        head = -1;
    }

    function layout() {
        C = Math.max(4, Math.floor((w - 8) / size));
        R = Math.max(4, Math.floor((h - 8) / size));
        ox = Math.floor((w - C * size) / 2);
        oy = Math.floor((h - R * size) / 2);
    }

    function make() {
        layout();
        const n = C * R;
        openE = new Uint8Array(n);
        openS = new Uint8Array(n);
        carved = new Uint8Array(n);
        dist = null;
        path = [];
        start = 0;
        goal = n - 1;
        job = { backtrack, prim, kruskal, wilson, binary }[maker]();
        mode = "make";
    }

    function runSolve() {
        if (mode === "make") return;
        path = [];
        job = solve();
        mode = "solve";
    }

    function draw() {
        const rgb = ink();
        ctx.clearRect(0, 0, w, h);
        const s = size;
        // Uncarved rock, then the solver's flood, then the walls.
        ctx.fillStyle = `rgba(${rgb},0.12)`;
        for (let i = 0; i < C * R; i++) if (!carved[i]) ctx.fillRect(ox + (i % C) * s, oy + ((i / C) | 0) * s, s, s);
        if (dist) {
            let far = 1;
            for (let i = 0; i < dist.length; i++) if (dist[i] > far) far = dist[i];
            for (let i = 0; i < dist.length; i++) {
                if (dist[i] < 0) continue;
                ctx.fillStyle = `rgba(${rgb},${0.08 + 0.22 * (1 - dist[i] / far)})`;
                ctx.fillRect(ox + (i % C) * s, oy + ((i / C) | 0) * s, s, s);
            }
        }
        ctx.strokeStyle = `rgb(${rgb})`;
        ctx.lineWidth = Math.max(1, Math.min(3, s / 8));
        ctx.beginPath();
        ctx.rect(ox, oy, C * s, R * s);
        for (let i = 0; i < C * R; i++) {
            const x = ox + (i % C) * s;
            const y = oy + ((i / C) | 0) * s;
            if (!openE[i] && i % C < C - 1) {
                ctx.moveTo(x + s, y);
                ctx.lineTo(x + s, y + s);
            }
            if (!openS[i] && i + C < C * R) {
                ctx.moveTo(x, y + s);
                ctx.lineTo(x + s, y + s);
            }
        }
        ctx.stroke();
        const mid = (i) => [ox + (i % C) * s + s / 2, oy + ((i / C) | 0) * s + s / 2];
        if (path.length > 1) {
            ctx.lineWidth = Math.max(2, s / 3);
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            path.forEach((c, k) => ctx[k ? "lineTo" : "moveTo"](...mid(c)));
            ctx.stroke();
        }
        ctx.fillStyle = `rgb(${rgb})`;
        for (const c of [start, goal]) {
            const [x, y] = mid(c);
            ctx.fillRect(x - s * 0.3, y - s * 0.3, s * 0.6, s * 0.6);
        }
        if (head >= 0) {
            const [x, y] = mid(head);
            ctx.beginPath();
            ctx.arc(x, y, Math.max(2, s * 0.3), 0, Math.PI * 2);
            ctx.fill();
        }
    }

    return {
        resize(nw, nh) {
            w = nw;
            h = nh;
            make();
        },
        frame() {
            // With reduced motion, skip the animation and show the result.
            if (reduced && job) this.finish();
            if (job) {
                for (let s = 0; s < speed; s++) {
                    if (job.next().done) {
                        job = null;
                        head = -1;
                        if (mode === "make") {
                            mode = "idle";
                            runSolve();
                        } else mode = "idle";
                        break;
                    }
                }
            }
            draw();
            listener({ mode, cells: C * R, length: path.length ? path.length - 1 : 0, seen: dist ? dist.reduce((n, d) => n + (d >= 0), 0) : 0 });
        },
        down(p) {
            if (mode === "make") return;
            const cx = Math.floor((p.x - ox) / size);
            const cy = Math.floor((p.y - oy) / size);
            if (cx < 0 || cy < 0 || cx >= C || cy >= R) return;
            if (p.button === 2) start = cy * C + cx;
            else goal = cy * C + cx;
            runSolve();
            wake();
        },
        running: () => !!job,
        onStats(fn) {
            listener = fn;
        },
        set(key, v) {
            if (key === "size") size = v;
            if (key === "maker") maker = v;
            if (key === "solver") solver = v;
            if (key === "speed") speed = v;
            if (key === "size" || key === "maker") make();
            if (key === "solver") runSolve();
            wake();
        },
        make() {
            make();
            wake();
        },
        solve() {
            runSolve();
            wake();
        },
        finish() {
            if (job) while (!job.next().done);
            job = null;
            head = -1;
            if (mode === "make") {
                mode = "idle";
                runSolve();
            } else mode = "idle";
            wake();
        },
    };
}

export default function Maze() {
    const { canvasRef, toyRef } = useToy(create);
    const [maker, setMaker] = useState("backtrack");
    const [solver, setSolver] = useState("bfs");
    const [size, setSize] = useState(16);
    const [speed, setSpeed] = useState(8);
    const [stats, setStats] = useState({ mode: "make", cells: 0, length: 0, seen: 0 });
    const toy = () => toyRef.current;
    const set = (key, setter) => (v) => (setter(v), toy()?.set(key, v));

    useEffect(() => {
        let lastAt = 0;
        toyRef.current?.onStats((st) => {
            const now = performance.now();
            if (now - lastAt < 150) return;
            lastAt = now;
            setStats(st);
        });
    }, [toyRef]);

    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas" />
            <ToyPanel>
                <ToySelect label="Carve with" value={maker} options={MAKERS.map((m) => ({ value: m.id, label: m.label }))} onChange={set("maker", setMaker)} />
                <ToySelect
                    label="Solve with"
                    value={solver}
                    options={[
                        { value: "bfs", label: "Flood fill (breadth-first)" },
                        { value: "dfs", label: "Wander (depth-first)" },
                    ]}
                    onChange={set("solver", setSolver)}
                />
                <ToySlider label="Cell size" value={size} min={6} max={40} step={2} onChange={set("size", setSize)} format={(v) => v + "px"} />
                <ToySlider label="Speed" value={speed} min={1} max={200} onChange={set("speed", setSpeed)} format={(v) => v + " steps/frame"} />
                <ToyButtons
                    items={[
                        { id: "new", label: "New maze", onClick: () => toy()?.make() },
                        { id: "solve", label: "Solve again", onClick: () => toy()?.solve() },
                        { id: "skip", label: "Skip ahead", onClick: () => toy()?.finish() },
                    ]}
                />
                <ToyReadout
                    items={[
                        ["Doing", { make: "carving", solve: "solving", idle: "done" }[stats.mode]],
                        ["Explored", `${stats.seen} / ${stats.cells}`],
                        ["Path", stats.length ? stats.length + " steps" : "–"],
                    ]}
                />
            </ToyPanel>
            <ToyTools tools={[]} hint="Click to move the goal · right-click to move the start" />
        </>
    );
}
