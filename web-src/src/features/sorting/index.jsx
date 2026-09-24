import { useEffect, useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToySelect, ToyButtons, ToyReadout } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// Sorting algorithms, one comparison at a time. Each algorithm is a
// generator that yields every time it looks at or moves a bar, so you can
// see (and hear) how differently they attack the same shuffled list.
export const ALGOS = [
    { id: "quick", label: "Quicksort" },
    { id: "merge", label: "Merge sort" },
    { id: "heap", label: "Heapsort" },
    { id: "shell", label: "Shellsort" },
    { id: "radix", label: "Radix sort (LSD)" },
    { id: "insertion", label: "Insertion sort" },
    { id: "selection", label: "Selection sort" },
    { id: "bubble", label: "Bubble sort" },
    { id: "cocktail", label: "Cocktail shaker" },
    { id: "gnome", label: "Gnome sort" },
];

export const SHAPES = [
    { id: "random", label: "Shuffled" },
    { id: "reversed", label: "Reversed" },
    { id: "nearly", label: "Nearly sorted" },
    { id: "few", label: "Few unique values" },
];

// Each yields ["cmp", i, j] before comparing and ["swap", i, j] / ["set", i]
// after moving, which is how the frame loop counts and highlights.
const SORTS = {
    *bubble(a) {
        for (let n = a.length; n > 1; n--) {
            let swapped = false;
            for (let i = 1; i < n; i++) {
                yield ["cmp", i - 1, i];
                if (a[i - 1] > a[i]) {
                    [a[i - 1], a[i]] = [a[i], a[i - 1]];
                    swapped = true;
                    yield ["swap", i - 1, i];
                }
            }
            if (!swapped) return;
        }
    },
    *cocktail(a) {
        let lo = 0;
        let hi = a.length - 1;
        while (lo < hi) {
            for (let i = lo; i < hi; i++) {
                yield ["cmp", i, i + 1];
                if (a[i] > a[i + 1]) ([a[i], a[i + 1]] = [a[i + 1], a[i]]), yield ["swap", i, i + 1];
            }
            hi--;
            for (let i = hi; i > lo; i--) {
                yield ["cmp", i - 1, i];
                if (a[i - 1] > a[i]) ([a[i - 1], a[i]] = [a[i], a[i - 1]]), yield ["swap", i - 1, i];
            }
            lo++;
        }
    },
    *insertion(a) {
        for (let i = 1; i < a.length; i++) {
            for (let j = i; j > 0; j--) {
                yield ["cmp", j - 1, j];
                if (a[j - 1] <= a[j]) break;
                [a[j - 1], a[j]] = [a[j], a[j - 1]];
                yield ["swap", j - 1, j];
            }
        }
    },
    *gnome(a) {
        let i = 0;
        while (i < a.length) {
            if (i === 0) i++;
            yield ["cmp", i - 1, i];
            if (a[i - 1] <= a[i]) i++;
            else {
                [a[i - 1], a[i]] = [a[i], a[i - 1]];
                yield ["swap", i - 1, i];
                i--;
            }
        }
    },
    *selection(a) {
        for (let i = 0; i < a.length - 1; i++) {
            let m = i;
            for (let j = i + 1; j < a.length; j++) {
                yield ["cmp", m, j];
                if (a[j] < a[m]) m = j;
            }
            if (m !== i) {
                [a[i], a[m]] = [a[m], a[i]];
                yield ["swap", i, m];
            }
        }
    },
    *shell(a) {
        const gaps = [701, 301, 132, 57, 23, 10, 4, 1];
        for (const g of gaps) {
            for (let i = g; i < a.length; i++) {
                for (let j = i; j >= g; j -= g) {
                    yield ["cmp", j - g, j];
                    if (a[j - g] <= a[j]) break;
                    [a[j - g], a[j]] = [a[j], a[j - g]];
                    yield ["swap", j - g, j];
                }
            }
        }
    },
    *quick(a) {
        function* part(lo, hi) {
            if (lo >= hi) return;
            const mid = (lo + hi) >> 1;
            [a[mid], a[hi]] = [a[hi], a[mid]];
            yield ["swap", mid, hi];
            let p = lo;
            for (let i = lo; i < hi; i++) {
                yield ["cmp", i, hi];
                if (a[i] < a[hi]) {
                    [a[i], a[p]] = [a[p], a[i]];
                    yield ["swap", i, p];
                    p++;
                }
            }
            [a[p], a[hi]] = [a[hi], a[p]];
            yield ["swap", p, hi];
            yield* part(lo, p - 1);
            yield* part(p + 1, hi);
        }
        yield* part(0, a.length - 1);
    },
    *merge(a) {
        const tmp = a.slice();
        for (let width = 1; width < a.length; width *= 2) {
            for (let lo = 0; lo < a.length; lo += 2 * width) {
                const mid = Math.min(lo + width, a.length);
                const hi = Math.min(lo + 2 * width, a.length);
                let i = lo;
                let j = mid;
                for (let k = lo; k < hi; k++) {
                    if (i < mid && j < hi) yield ["cmp", i, j];
                    tmp[k] = i < mid && (j >= hi || a[i] <= a[j]) ? a[i++] : a[j++];
                }
                for (let k = lo; k < hi; k++) {
                    a[k] = tmp[k];
                    yield ["set", k];
                }
            }
        }
    },
    *heap(a) {
        const n = a.length;
        function* sift(i, end) {
            for (;;) {
                let big = i;
                const l = 2 * i + 1;
                const r = l + 1;
                if (l < end) {
                    yield ["cmp", l, big];
                    if (a[l] > a[big]) big = l;
                }
                if (r < end) {
                    yield ["cmp", r, big];
                    if (a[r] > a[big]) big = r;
                }
                if (big === i) return;
                [a[i], a[big]] = [a[big], a[i]];
                yield ["swap", i, big];
                i = big;
            }
        }
        for (let i = (n >> 1) - 1; i >= 0; i--) yield* sift(i, n);
        for (let end = n - 1; end > 0; end--) {
            [a[0], a[end]] = [a[end], a[0]];
            yield ["swap", 0, end];
            yield* sift(0, end);
        }
    },
    *radix(a) {
        const max = Math.max(...a);
        for (let exp = 1; Math.floor(max / exp) > 0; exp *= 4) {
            const buckets = [[], [], [], []];
            for (let i = 0; i < a.length; i++) {
                buckets[Math.floor(a[i] / exp) % 4].push(a[i]);
                yield ["read", i];
            }
            let k = 0;
            for (const b of buckets) for (const v of b) (a[k] = v), yield ["set", k++];
        }
    },
};

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let a = [];
    let n = 120;
    let shape = "random";
    let algo = "quick";
    let job = null;
    let speed = 6; // operations per frame
    let hot = []; // bars touched in the last frame
    let stats = { cmp: 0, moves: 0 };
    let done = false;
    let sweep = -1; // the green-light pass along a sorted list
    let audio = null;
    let sound = false;
    let listener = () => {};

    function fill() {
        a = Array.from({ length: n }, (_, i) => i + 1);
        if (shape === "few") a = a.map((v) => Math.ceil((v / n) * 5) * Math.ceil(n / 5));
        if (shape === "reversed") a.reverse();
        else if (shape === "nearly") {
            for (let k = 0; k < n / 12; k++) {
                const i = Math.floor(Math.random() * (n - 3));
                const j = i + 1 + Math.floor(Math.random() * 3);
                [a[i], a[j]] = [a[j], a[i]];
            }
        } else {
            for (let i = n - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
        }
        job = null;
        done = false;
        sweep = -1;
        hot = [];
        stats = { cmp: 0, moves: 0 };
    }

    function beep(v) {
        if (!sound || !audio) return;
        const t = audio.ctx.currentTime;
        audio.osc.frequency.setTargetAtTime(160 + Math.min(1, v / n) * 900, t, 0.004);
        audio.gain.gain.cancelScheduledValues(t);
        audio.gain.gain.setTargetAtTime(0.05, t, 0.003);
        audio.gain.gain.setTargetAtTime(0, t + 0.03, 0.02);
    }

    function draw() {
        const rgb = ink();
        ctx.clearRect(0, 0, w, h);
        const pad = 12;
        const bw = (w - pad * 2) / n;
        const top = 56;
        const base = h - 32; // clear of the hint along the bottom
        const max = Math.max(n, ...a);
        const gap = bw > 4 ? 1 : 0;
        const hotSet = new Set(hot);
        ctx.fillStyle = `rgba(${rgb},0.45)`;
        for (let i = 0; i < n; i++) {
            if (hotSet.has(i) || i <= sweep) continue;
            const bh = (a[i] / max) * (base - top);
            ctx.fillRect(pad + i * bw, base - bh, Math.max(1, bw - gap), bh);
        }
        ctx.fillStyle = `rgb(${rgb})`;
        for (let i = 0; i < n; i++) {
            if (!hotSet.has(i) && i > sweep) continue;
            const bh = (a[i] / max) * (base - top);
            ctx.fillRect(pad + i * bw, base - bh, Math.max(1, bw - gap), bh);
        }
    }

    return {
        resize(nw, nh) {
            const first = !w;
            w = nw;
            h = nh;
            if (first) fill();
        },
        frame() {
            hot = [];
            if (job) {
                // With reduced motion the whole sort runs in one go.
                const budget = reduced ? Infinity : speed;
                for (let s = 0; s < budget; s++) {
                    const r = job.next();
                    if (r.done) {
                        job = null;
                        done = true;
                        sweep = reduced ? n : 0;
                        break;
                    }
                    const [op, i, j] = r.value;
                    if (op === "cmp") stats.cmp++;
                    else if (op === "swap") stats.moves += 2;
                    else if (op === "set") stats.moves++;
                    hot.push(i);
                    if (j !== undefined) hot.push(j);
                }
                if (hot.length) beep(a[hot[hot.length - 1]]);
            } else if (done && sweep < n) {
                sweep += Math.max(1, Math.ceil(n / 60));
                if (sweep < n) beep(a[Math.min(sweep, n - 1)]);
            }
            draw();
            listener({ ...stats, state: job ? "sorting" : done ? "sorted" : "ready" });
        },
        running: () => !!job || (done && sweep < n),
        onStats(fn) {
            listener = fn;
        },
        start() {
            if (done) fill();
            job = SORTS[algo](a);
            wake();
        },
        stop() {
            job = null;
            wake();
        },
        shuffle() {
            fill();
            wake();
        },
        set(key, v) {
            if (key === "n") n = v;
            if (key === "shape") shape = v;
            if (key === "algo") algo = v;
            if (key === "speed") speed = v;
            if (key === "n" || key === "shape" || key === "algo") fill();
            wake();
        },
        setSound(on) {
            sound = on;
            if (on && !audio) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return;
                const c = new AC();
                const osc = c.createOscillator();
                const gain = c.createGain();
                osc.type = "triangle";
                gain.gain.value = 0;
                osc.connect(gain).connect(c.destination);
                osc.start();
                audio = { ctx: c, osc, gain };
            }
            if (audio) audio.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.01);
        },
        destroy() {
            audio?.ctx.close();
        },
    };
}

export default function Sorting() {
    const { canvasRef, toyRef } = useToy(create);
    const [algo, setAlgo] = useState("quick");
    const [shape, setShape] = useState("random");
    const [n, setN] = useState(120);
    const [speed, setSpeed] = useState(6);
    const [sound, setSound] = useState(false);
    const [stats, setStats] = useState({ cmp: 0, moves: 0, state: "ready" });
    const toy = () => toyRef.current;
    const set = (key, setter) => (v) => (setter(v), toy()?.set(key, v));

    useEffect(() => {
        let lastAt = 0;
        toyRef.current?.onStats((st) => {
            const now = performance.now();
            if (now - lastAt < 120 && st.state === "sorting") return;
            lastAt = now;
            setStats(st);
        });
    }, [toyRef]);

    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas" />
            <ToyPanel>
                <ToySelect label="Algorithm" value={algo} options={ALGOS.map((x) => ({ value: x.id, label: x.label }))} onChange={set("algo", setAlgo)} />
                <ToySelect label="Start from" value={shape} options={SHAPES.map((x) => ({ value: x.id, label: x.label }))} onChange={set("shape", setShape)} />
                <ToySlider label="Bars" value={n} min={8} max={400} step={4} onChange={set("n", setN)} />
                <ToySlider label="Speed" value={speed} min={1} max={200} onChange={set("speed", setSpeed)} format={(v) => v + " ops/frame"} />
                <ToyButtons items={[{ id: "sound", label: "Sound", active: sound, onClick: () => (setSound(!sound), toy()?.setSound(!sound)) }]} />
                <ToyReadout
                    items={[
                        ["Comparisons", stats.cmp.toLocaleString()],
                        ["Moves", stats.moves.toLocaleString()],
                        ["State", stats.state],
                    ]}
                />
            </ToyPanel>
            <ToyTools
                tools={[
                    { id: "go", label: stats.state === "sorting" ? "Stop" : "Sort", onClick: () => (stats.state === "sorting" ? toy()?.stop() : toy()?.start()) },
                    { id: "shuffle", label: "Shuffle", onClick: () => toy()?.shuffle() },
                ]}
                hint="Pick an algorithm in the controls, then Sort"
            />
        </>
    );
}
