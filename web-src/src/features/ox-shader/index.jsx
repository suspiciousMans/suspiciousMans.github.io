import { useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToySelect, ToyReadout } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";
import OxToy, { useAutoRun, useLatestRun, describe } from "../OxToy.jsx";
import { splitOutput, toNumber, checkSource } from "../oxidized.js";

// Draw pictures with a function, like a tiny shader. `shade(x, y, t)`
// returns how bright each cell is, from 0 to 9, for every cell of a small
// grid and every frame of a short loop. The answers are worked out once
// in the background, then played back in the site's dithered dots.
const SIZES = {
    small: { W: 48, H: 30, label: "Small · 48 × 30" },
    medium: { W: 64, H: 40, label: "Medium · 64 × 40" },
    large: { W: 96, H: 60, label: "Large · 96 × 60" },
};
const DOT = 4; // screen dots per grid cell, for the dither pattern

const BAYER = Float32Array.from([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], (v) => (v + 0.5) / 16);

const HEAD = `// Runs for every cell of the grid, every frame.
//   x, y   the cell, from 0 up to WIDTH and HEIGHT
//   t      the frame, from 0 up to FRAMES
// WIDTH, HEIGHT and FRAMES are filled in for you.
// Return how bright the cell is, from 0 (dark) to 9.

`;

export const EXAMPLES = [
    {
        id: "ripples",
        label: "Ripples",
        code: `${HEAD}fn shade(x, y, t) -> Int {
    let dx = x - WIDTH / 2
    let dy = y - HEIGHT / 2
    let d = sqrt((dx * dx + dy * dy) as Float) as Int

    # rings every 10 cells, moving out one ring per loop
    return (d + 100 - t * 10 / FRAMES) % 10
}
`,
    },
    {
        id: "interference",
        label: "Two sources",
        code: `${HEAD}fn dist(x, y, cx, cy) -> Int {
    let dx = x - cx
    let dy = y - cy
    return sqrt((dx * dx + dy * dy) as Float) as Int
}

fn shade(x, y, t) -> Int {
    let gap = WIDTH / 6
    let a = dist(x, y, WIDTH / 2 - gap, HEIGHT / 2)
    let b = dist(x, y, WIDTH / 2 + gap, HEIGHT / 2)
    let wave = t * 8 / FRAMES

    # where the rings from both line up, it's bright
    let v = (a + wave) % 8 + (b + wave) % 8
    return v * 9 / 14
}
`,
    },
    {
        id: "diamonds",
        label: "Diamonds",
        code: `${HEAD}fn shade(x, y, t) -> Int {
    let d = abs(x - WIDTH / 2) + abs(y - HEIGHT / 2)
    return (d + 100 - t * 10 / FRAMES) % 10
}
`,
    },
    {
        id: "checker",
        label: "Checker wave",
        code: `${HEAD}fn shade(x, y, t) -> Int {
    let size = 6
    # shift each row a little further each frame
    let shift = (y / size) * t
    let cx = (x + shift) / size
    let cy = y / size
    if (cx + cy) % 2 == 0 {
        return 9
    }
    return 1
}
`,
    },
    {
        id: "sunset",
        label: "Sunset",
        code: `${HEAD}fn shade(x, y, t) -> Int {
    let horizon = HEIGHT * 3 / 5
    let sx = x - WIDTH / 2
    let sy = y - horizon + 2

    # the sun: a disc sitting on the horizon
    if y < horizon && sx * sx + sy * sy < 150 {
        return 9
    }
    # sky: darker the higher you look
    if y < horizon {
        return y * 6 / horizon
    }
    # sea: stripes that shimmer frame to frame
    if (y + t + x / 7) % 3 == 0 && abs(sx) < (y - horizon) * 2 {
        return 7
    }
    return 1
}
`,
    },
    {
        id: "blank",
        label: "Start from scratch",
        code: `${HEAD}fn shade(x, y, t) -> Int {
    # a gradient from left to right; make it yours
    return x * 10 / WIDTH
}
`,
    },
];

// WIDTH, HEIGHT and FRAMES are swapped for numbers before the run: calling
// a function for them instead would triple the time each cell takes.
function harness(code, W, H, T) {
    const filled = code.replace(/\bWIDTH\b/g, W).replace(/\bHEIGHT\b/g, H).replace(/\bFRAMES\b/g, T);
    return `${filled}

fn main() {
    for t in range(0, ${T}) {
        for y in range(0, ${H}) {
            let line = "@"
            for x in range(0, ${W}) {
                line = line + " " + (shade(x, y, t) as String)
            }
            print(line)
        }
    }
}
`;
}

// Parse the output into T frames of W × H brightness values.
function readFrames(data, W, H, T) {
    if (data.length < T * H) return { error: `expected ${T * H} rows of output but got ${data.length}` };
    const frames = [];
    for (let t = 0; t < T; t++) {
        const f = new Float32Array(W * H);
        for (let y = 0; y < H; y++) {
            const parts = data[t * H + y].split(" ");
            for (let x = 0; x < W; x++) {
                const v = toNumber(parts[x + 1]);
                if (Number.isNaN(v)) return { error: `shade(${x}, ${y}, ${t}) returned ${parts[x + 1]}; it needs to return a number.` };
                f[y * W + x] = Math.min(9, Math.max(0, v));
            }
        }
        frames.push(f);
    }
    return { frames };
}

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    const off = document.createElement("canvas");
    const octx = off.getContext("2d");
    let frames = [];
    let images = [];
    let W = 0;
    let H = 0;
    let madeWith = "";
    let playing = !reduced;
    let fps = 8;
    let clock = 0;
    let shown = 0;
    let listener = () => {};

    // Dither each frame once per theme colour, then just blit.
    function bake() {
        const rgb = ink();
        const [r, g, b] = rgb.split(",").map(Number);
        const iw = W * DOT;
        const ih = H * DOT;
        off.width = iw;
        off.height = ih;
        images = frames.map((f) => {
            const img = octx.createImageData(iw, ih);
            const d = img.data;
            for (let py = 0; py < ih; py++) {
                const row = Math.floor(py / DOT) * W;
                for (let px = 0; px < iw; px++) {
                    const c = f[row + Math.floor(px / DOT)] / 9;
                    const o = (py * iw + px) * 4;
                    d[o] = r;
                    d[o + 1] = g;
                    d[o + 2] = b;
                    d[o + 3] = c > BAYER[(py & 3) * 4 + (px & 3)] ? 255 : 0;
                }
            }
            return img;
        });
        madeWith = rgb;
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);
        if (!images.length) return;
        if (ink() !== madeWith) bake();
        octx.putImageData(images[shown], 0, 0);
        // Fit the picture in the stage, keeping its shape and crisp dots.
        const pad = 16;
        const s = Math.min((w - pad * 2) / off.width, (h - pad * 2) / off.height);
        const dw = off.width * s;
        const dh = off.height * s;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }

    return {
        resize(nw, nh) {
            w = nw;
            h = nh;
        },
        frame(t, dt) {
            if (playing && frames.length > 1) {
                clock += dt * fps;
                shown = Math.floor(clock) % frames.length;
            }
            draw();
            listener({ frame: shown });
        },
        down(p) {
            // Clicking steps one frame, handy while paused.
            if (!frames.length) return;
            shown = (shown + (p.button === 2 ? frames.length - 1 : 1)) % frames.length;
            clock = shown;
            wake();
        },
        running: () => playing && frames.length > 1,
        onStats(fn) {
            listener = fn;
        },
        setFrames(fs, nW, nH) {
            frames = fs;
            W = nW;
            H = nH;
            shown = Math.min(shown, frames.length - 1);
            bake();
            wake();
        },
        setFps(v) {
            fps = v;
        },
        play(on) {
            playing = on;
            wake();
        },
    };
}

export default function OxShader() {
    const { canvasRef, toyRef } = useToy(create);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [example, setExample] = useState("ripples");
    const [code, setCode] = useState(EXAMPLES[0].code);
    const [status, setStatus] = useState({ kind: "running", text: "Loading Oxidized…" });
    const [printed, setPrinted] = useState([]);
    const [size, setSize] = useState("medium");
    const [count, setCount] = useState(8);
    const [fps, setFps] = useState(8);
    const [playing, setPlaying] = useState(!reduced);
    const [ms, setMs] = useState(0);
    const run = useLatestRun();
    const toy = () => toyRef.current;

    async function compile(src, sz, T) {
        const bad = checkSource(src, ["shade"]);
        if (bad) return setStatus({ kind: "error", text: bad });
        const { W, H } = SIZES[sz];
        setStatus({ kind: "running", text: `Drawing ${W * H * T} cells…` });
        const t0 = performance.now();
        const result = await run(harness(src, W, H, T), { timeout: 10000 });
        if (!result) return;
        const { data, printed } = splitOutput(result.out || []);
        setPrinted(printed);
        if (!result.ok) return setStatus(describe(result));
        const f = readFrames(data, W, H, T);
        if (f.error) return setStatus({ kind: "error", text: f.error });
        toy()?.setFrames(f.frames, W, H);
        const took = Math.round(performance.now() - t0);
        setMs(took);
        setStatus({ kind: "ok", text: `Drew ${T} frame${T > 1 ? "s" : ""} of ${W} × ${H} in ${took} ms` });
    }

    // Re-run when the code, grid or frame count changes.
    const runNow = useAutoRun(JSON.stringify([code, size, count]), () => compile(code, size, count), 900);

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
            <canvas ref={canvasRef} className="fill-canvas" />
            <ToyPanel>
                <ToySelect
                    label="Grid"
                    value={size}
                    options={Object.entries(SIZES).map(([value, s]) => ({ value, label: s.label }))}
                    onChange={setSize}
                />
                <ToySlider label="Frames" value={count} min={1} max={16} onChange={setCount} />
                <ToySlider label="Playback" value={fps} min={1} max={24} onChange={(v) => (setFps(v), toy()?.setFps(v))} format={(v) => v + " fps"} />
                <ToyReadout items={[["Last run", ms ? ms + " ms" : "–"]]} />
            </ToyPanel>
            <ToyTools
                tools={[{ id: "play", label: playing ? "Pause" : "Play", onClick: () => (setPlaying(!playing), toy()?.play(!playing)) }]}
                hint="Click to step a frame"
            />
        </OxToy>
    );
}
