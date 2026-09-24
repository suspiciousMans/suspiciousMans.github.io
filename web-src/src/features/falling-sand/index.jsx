import { useState } from "react";
import useToy from "../useToy.js";
import ToyTools from "../ToyTools.jsx";

// Falling sand on a 4px grid. Drag to pour sand or draw walls; sand piles
// up, slides off slopes and spills over edges.
const CELL = 4;
const EMPTY = 0;
const SAND = 1;
const WALL = 2;

function create({ ctx, ink }) {
    let w = 0;
    let h = 0;
    let grid = new Uint8Array(0);
    let shade = new Uint8Array(0); // per-grain brightness, for texture
    let img = null;
    let tool = SAND;
    let pour = null;
    let prev = null;
    let n = 1; // dabs this frame; sand spreads its grains across them
    let flip = false;

    // Stamp along the path since the last frame so fast drags draw solid lines.
    function paint(p) {
        const from = prev || p;
        n = Math.max(1, Math.ceil(Math.hypot(p.x - from.x, p.y - from.y)));
        for (let s = 1; s <= n; s++) dab(from.x + ((p.x - from.x) * s) / n, from.y + ((p.y - from.y) * s) / n, p.button);
        prev = { x: p.x, y: p.y };
    }

    function dab(px, py, button) {
        const r = tool === WALL ? 2 : 3;
        const cx = Math.round(px);
        const cy = Math.round(py);
        for (let y = -r; y <= r; y++) {
            for (let x = -r; x <= r; x++) {
                if (x * x + y * y > r * r) continue;
                const gx = cx + x;
                const gy = cy + y;
                if (gx < 0 || gy < 0 || gx >= w || gy >= h) continue;
                const i = gy * w + gx;
                if (tool === WALL) grid[i] = button === 2 ? EMPTY : WALL;
                else if (button === 2) grid[i] = EMPTY;
                else if (grid[i] === EMPTY && Math.random() < 0.35 / Math.min(n, 4)) {
                    grid[i] = SAND;
                    shade[i] = 150 + Math.random() * 105;
                }
            }
        }
    }

    function step() {
        flip = !flip;
        for (let y = h - 2; y >= 0; y--) {
            const row = y * w;
            for (let k = 0; k < w; k++) {
                const x = flip ? k : w - 1 - k;
                const i = row + x;
                if (grid[i] !== SAND) continue;
                const below = i + w;
                let to = -1;
                if (grid[below] === EMPTY) to = below;
                else {
                    const dir = Math.random() < 0.5 ? -1 : 1;
                    for (const d of [dir, -dir]) {
                        const nx = x + d;
                        if (nx >= 0 && nx < w && grid[below + d] === EMPTY && grid[i + d] === EMPTY) {
                            to = below + d;
                            break;
                        }
                    }
                }
                if (to >= 0) {
                    grid[to] = SAND;
                    shade[to] = shade[i];
                    grid[i] = EMPTY;
                }
            }
        }
    }

    function draw() {
        const [r, g, b] = ink().split(",").map(Number);
        const d = img.data;
        for (let i = 0; i < grid.length; i++) {
            const o = i * 4;
            const c = grid[i];
            d[o] = r;
            d[o + 1] = g;
            d[o + 2] = b;
            d[o + 3] = c === SAND ? shade[i] : c === WALL ? 120 : 0;
        }
        ctx.putImageData(img, 0, 0);
    }

    return {
        resize(nw, nh) {
            const old = grid;
            const ow = w;
            const oh = h;
            const oldShade = shade;
            w = nw;
            h = nh;
            grid = new Uint8Array(w * h);
            shade = new Uint8Array(w * h);
            // Keep what's there, anchored to the floor.
            for (let y = 0; y < Math.min(oh, h); y++) {
                for (let x = 0; x < Math.min(ow, w); x++) {
                    const from = (oh - 1 - y) * ow + x;
                    const to = (h - 1 - y) * w + x;
                    grid[to] = old[from];
                    shade[to] = oldShade[from];
                }
            }
            img = ctx.createImageData(w, h);
        },
        frame() {
            if (pour) paint(pour);
            step();
            step();
            draw();
        },
        down(p) {
            pour = p;
            prev = null;
        },
        up() {
            pour = null;
            prev = null;
        },
        setTool(t) {
            tool = t;
        },
        clear() {
            grid.fill(EMPTY);
        },
    };
}

export default function FallingSand() {
    const { canvasRef, toyRef } = useToy(create, { cell: CELL });
    const [tool, setTool] = useState(SAND);
    const pick = (t) => {
        setTool(t);
        toyRef.current?.setTool(t);
    };
    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas pixel-canvas" />
            <ToyTools
                tools={[
                    { id: "sand", label: "Sand", active: tool === SAND, onClick: () => pick(SAND) },
                    { id: "wall", label: "Wall", active: tool === WALL, onClick: () => pick(WALL) },
                    { id: "clear", label: "Clear", onClick: () => toyRef.current?.clear() },
                ]}
                hint="Drag to pour · right-drag to erase"
            />
        </>
    );
}
