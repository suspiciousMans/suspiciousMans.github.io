import { useState } from "react";
import useToy from "../useToy.js";
import ToyTools from "../ToyTools.jsx";

// A sheet of cloth pinned along the top. Grab it anywhere and drag; yank
// hard and it tears. Right-drag (or the Cut tool) slices it.
const GAP = 16;
const TEAR = 3.2; // a link snaps when stretched past this many rest lengths

function create({ ctx, ink }) {
    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;
    let x, y, ox, oy, pinned;
    let links = []; // [a, b, alive]
    let grab = -1;
    let cutting = false;
    let cutMode = false;
    const pointer = { x: 0, y: 0, down: false, button: 0 };
    const last = { x: 0, y: 0 };

    function build() {
        cols = Math.max(8, Math.min(48, Math.floor((w * 0.8) / GAP)));
        rows = Math.max(6, Math.min(28, Math.floor((h * 0.6) / GAP)));
        const n = cols * rows;
        x = new Float32Array(n);
        y = new Float32Array(n);
        ox = new Float32Array(n);
        oy = new Float32Array(n);
        pinned = new Uint8Array(n);
        const left = (w - (cols - 1) * GAP) / 2;
        const top = Math.max(24, h * 0.08);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const i = r * cols + c;
                x[i] = ox[i] = left + c * GAP;
                y[i] = oy[i] = top + r * GAP;
                pinned[i] = r === 0 && c % 3 === 0 ? 1 : 0;
            }
        }
        links = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const i = r * cols + c;
                if (c < cols - 1) links.push([i, i + 1, true]);
                if (r < rows - 1) links.push([i, i + cols, true]);
            }
        }
    }

    function nearest(px, py, max) {
        let best = -1;
        let bd = max * max;
        for (let i = 0; i < x.length; i++) {
            const d = (x[i] - px) ** 2 + (y[i] - py) ** 2;
            if (d < bd) {
                bd = d;
                best = i;
            }
        }
        return best;
    }

    // Does segment p1-p2 cross segment p3-p4?
    function crosses(ax, ay, bx, by, cx, cy, dx, dy) {
        const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
        if (!d) return false;
        const u = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
        const v = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
        return u >= 0 && u <= 1 && v >= 0 && v <= 1;
    }

    function cut(x1, y1, x2, y2) {
        for (const l of links) {
            if (l[2] && crosses(x1, y1, x2, y2, x[l[0]], y[l[0]], x[l[1]], y[l[1]])) l[2] = false;
        }
    }

    function simulate(dt) {
        const g = 900 * dt * dt;
        for (let i = 0; i < x.length; i++) {
            if (pinned[i]) continue;
            const vx = (x[i] - ox[i]) * 0.99;
            const vy = (y[i] - oy[i]) * 0.99;
            ox[i] = x[i];
            oy[i] = y[i];
            x[i] += vx;
            y[i] += vy + g;
        }
        if (grab >= 0) {
            x[grab] = pointer.x;
            y[grab] = pointer.y;
        }
        for (let pass = 0; pass < 4; pass++) {
            for (const l of links) {
                if (!l[2]) continue;
                const [a, b] = l;
                const dx = x[b] - x[a];
                const dy = y[b] - y[a];
                const d = Math.hypot(dx, dy) || 0.001;
                if (d > GAP * TEAR) {
                    l[2] = false;
                    continue;
                }
                const k = (d - GAP) / d / 2;
                const wa = pinned[a] || a === grab ? 0 : 1;
                const wb = pinned[b] || b === grab ? 0 : 1;
                const s = wa + wb;
                if (!s) continue;
                x[a] += (dx * k * 2 * wa) / s;
                y[a] += (dy * k * 2 * wa) / s;
                x[b] -= (dx * k * 2 * wb) / s;
                y[b] -= (dy * k * 2 * wb) / s;
            }
        }
        for (let i = 0; i < x.length; i++) {
            if (y[i] > h - 2) {
                y[i] = h - 2;
                ox[i] = x[i] + (x[i] - ox[i]) * -0.3;
            }
            x[i] = Math.min(w - 2, Math.max(2, x[i]));
        }
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);
        const rgb = ink();
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const l of links) {
            if (!l[2]) continue;
            ctx.moveTo(x[l[0]], y[l[0]]);
            ctx.lineTo(x[l[1]], y[l[1]]);
        }
        ctx.strokeStyle = `rgba(${rgb},0.8)`;
        ctx.stroke();
        ctx.fillStyle = `rgb(${rgb})`;
        for (let i = 0; i < x.length; i++) if (pinned[i]) ctx.fillRect(x[i] - 3, y[i] - 3, 6, 6);
    }

    return {
        resize(nw, nh) {
            const first = !w;
            w = nw;
            h = nh;
            if (first) build();
        },
        frame(t, dt) {
            simulate(Math.min(dt, 1 / 30));
            draw();
        },
        down(p) {
            Object.assign(pointer, p);
            last.x = p.x;
            last.y = p.y;
            cutting = cutMode || p.button === 2;
            grab = cutting ? -1 : nearest(p.x, p.y, 40);
            if (grab >= 0 && pinned[grab]) grab = -1;
        },
        move(p) {
            pointer.x = p.x;
            pointer.y = p.y;
            if (cutting && p.down) {
                cut(last.x, last.y, p.x, p.y);
                last.x = p.x;
                last.y = p.y;
            }
        },
        up() {
            grab = -1;
            cutting = false;
        },
        setCut(on) {
            cutMode = on;
        },
        reset() {
            build();
        },
    };
}

export default function Cloth() {
    const { canvasRef, toyRef } = useToy(create);
    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas" />
            <ClothTools toyRef={toyRef} />
        </>
    );
}

function ClothTools({ toyRef }) {
    const [cut, setCut] = useState(false);
    const toggle = (on) => {
        setCut(on);
        toyRef.current?.setCut(on);
    };
    return (
        <ToyTools
            tools={[
                { id: "grab", label: "Grab", active: !cut, onClick: () => toggle(false) },
                { id: "cut", label: "Cut", active: cut, onClick: () => toggle(true) },
                { id: "reset", label: "Reset", onClick: () => toyRef.current?.reset() },
            ]}
            hint="Drag to pull · yank hard to tear · right-drag to cut"
        />
    );
}
