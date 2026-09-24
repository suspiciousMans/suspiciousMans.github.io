import { useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToySelect, ToyButtons } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// Electric field lines. Positive charges push, negative ones pull, and the
// lines trace the direction a tiny positive test charge would be shoved.
// They leave every positive charge evenly spaced and end on a negative one
// (or fly off to infinity). The faint rings behind are lines of equal voltage.
const TAU = Math.PI * 2;
const SHADE = 2; // px per cell of the voltage contours

export const SETUPS = [
    { id: "dipole", label: "Dipole" },
    { id: "pair", label: "Two alike" },
    { id: "quad", label: "Quadrupole" },
    { id: "plates", label: "Capacitor" },
    { id: "random", label: "Random" },
];

function create({ ctx, ink, reduced, wake }) {
    let w = 0;
    let h = 0;
    let charges = [];
    let lines = [];
    let dirty = true;
    let drag = null;
    let sparks = [];
    let playing = !reduced;
    const opts = { per: 12, bands: true, sparks: true };
    const shade = document.createElement("canvas");
    const sctx = shade.getContext("2d");
    let simg = null;
    let shadeInk = "";

    function setup(id) {
        const cx = w / 2;
        const cy = h / 2;
        const s = Math.min(w, h);
        if (id === "dipole") charges = [{ x: cx - s * 0.18, y: cy, q: 1 }, { x: cx + s * 0.18, y: cy, q: -1 }];
        else if (id === "pair") charges = [{ x: cx - s * 0.18, y: cy, q: 1 }, { x: cx + s * 0.18, y: cy, q: 1 }];
        else if (id === "quad") {
            const d = s * 0.16;
            charges = [
                { x: cx - d, y: cy - d, q: 1 },
                { x: cx + d, y: cy - d, q: -1 },
                { x: cx + d, y: cy + d, q: 1 },
                { x: cx - d, y: cy + d, q: -1 },
            ];
        } else if (id === "plates") {
            charges = [];
            for (let i = -4; i <= 4; i++) {
                charges.push({ x: cx + i * s * 0.06, y: cy - s * 0.15, q: 0.5 });
                charges.push({ x: cx + i * s * 0.06, y: cy + s * 0.15, q: -0.5 });
            }
        } else {
            charges = Array.from({ length: 5 }, () => ({
                x: w * (0.15 + Math.random() * 0.7),
                y: h * (0.15 + Math.random() * 0.7),
                q: Math.random() < 0.5 ? 1 : -1,
            }));
        }
        dirty = true;
    }

    function field(x, y) {
        let ex = 0;
        let ey = 0;
        let v = 0;
        for (const c of charges) {
            const dx = x - c.x;
            const dy = y - c.y;
            const r2 = dx * dx + dy * dy + 1;
            const r = Math.sqrt(r2);
            const k = c.q / (r2 * r);
            ex += dx * k;
            ey += dy * k;
            v += c.q / r;
        }
        return [ex, ey, v];
    }

    // Follow the field from (x, y), in `dir` +1 (with it) or -1 (against).
    function trace(x, y, dir) {
        const pts = [x, y];
        const stepLen = 3;
        for (let i = 0; i < 1500; i++) {
            let [ex, ey] = field(x, y);
            let m = Math.hypot(ex, ey) || 1;
            // Midpoint step, for smoother curves.
            const mx = x + ((ex / m) * stepLen * dir) / 2;
            const my = y + ((ey / m) * stepLen * dir) / 2;
            [ex, ey] = field(mx, my);
            m = Math.hypot(ex, ey) || 1;
            x += (ex / m) * stepLen * dir;
            y += (ey / m) * stepLen * dir;
            pts.push(x, y);
            if (x < -w * 0.5 || y < -h * 0.5 || x > w * 1.5 || y > h * 1.5) break;
            if (charges.some((c) => Math.sign(c.q) === -dir && (c.x - x) ** 2 + (c.y - y) ** 2 < 36)) break;
        }
        return pts;
    }

    function rebuild() {
        lines = [];
        const plus = charges.filter((c) => c.q > 0);
        // With no positive charges, trace backwards out of the negative ones.
        const from = plus.length ? plus : charges;
        const dir = plus.length ? 1 : -1;
        for (const c of from) {
            const n = Math.max(2, Math.round(opts.per * Math.abs(c.q)));
            for (let i = 0; i < n; i++) {
                const a = (i / n) * TAU + 0.1;
                lines.push(trace(c.x + Math.cos(a) * 7, c.y + Math.sin(a) * 7, dir));
            }
        }
        buildShade();
        dirty = false;
    }

    function buildShade() {
        const sw = Math.ceil(w / SHADE);
        const sh = Math.ceil(h / SHADE);
        if (shade.width !== sw || shade.height !== sh) {
            shade.width = sw;
            shade.height = sh;
            simg = sctx.createImageData(sw, sh);
        }
        shadeInk = ink();
        const [r, g, b] = shadeInk.split(",").map(Number);
        const d = simg.data;
        const v = new Float32Array(sw * sh);
        for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) v[y * sw + x] = field(x * SHADE + SHADE / 2, y * SHADE + SHADE / 2)[2] * 400;
        for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
                const i = y * sw + x;
                // Equipotential contours: mark where the voltage crosses a level.
                const k = Math.floor(v[i]);
                const edge = Math.abs(v[i]) < 40 && ((x + 1 < sw && Math.floor(v[i + 1]) !== k) || (y + 1 < sh && Math.floor(v[i + sw]) !== k));
                const o = i * 4;
                d[o] = r;
                d[o + 1] = g;
                d[o + 2] = b;
                d[o + 3] = edge ? 80 : 0;
            }
        }
        sctx.putImageData(simg, 0, 0);
    }

    function stepSparks(dt) {
        while (sparks.length < 160) {
            const l = lines[Math.floor(Math.random() * lines.length)];
            if (!l) break;
            sparks.push({ l, i: Math.floor((Math.random() * l.length) / 2) * 2 });
        }
        for (const s of sparks) s.i += 2 * Math.max(1, Math.round(dt * 60));
        sparks = sparks.filter((s) => s.i < s.l.length && lines.includes(s.l));
    }

    function draw() {
        const rgb = ink();
        if (rgb !== shadeInk && opts.bands) buildShade();
        ctx.clearRect(0, 0, w, h);
        if (opts.bands) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(shade, 0, 0, shade.width * SHADE, shade.height * SHADE);
        }
        ctx.strokeStyle = `rgba(${rgb},0.75)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const l of lines) {
            ctx.moveTo(l[0], l[1]);
            for (let i = 2; i < l.length; i += 2) ctx.lineTo(l[i], l[i + 1]);
        }
        ctx.stroke();
        if (opts.sparks) {
            ctx.fillStyle = `rgb(${rgb})`;
            for (const s of sparks) ctx.fillRect(s.l[s.i] - 1.5, s.l[s.i + 1] - 1.5, 3, 3);
        }
        for (const c of charges) {
            const r = 6 + Math.abs(c.q) * 5;
            ctx.fillStyle = `rgb(${rgb})`;
            ctx.beginPath();
            ctx.arc(c.x, c.y, r, 0, TAU);
            ctx.fill();
            // Punch the sign out of the disc.
            ctx.globalCompositeOperation = "destination-out";
            ctx.fillRect(c.x - r * 0.55, c.y - 1.5, r * 1.1, 3);
            if (c.q > 0) ctx.fillRect(c.x - 1.5, c.y - r * 0.55, 3, r * 1.1);
            ctx.globalCompositeOperation = "source-over";
        }
    }

    function near(p) {
        return charges.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < 8 + Math.abs(c.q) * 5 + 4);
    }

    return {
        resize(nw, nh) {
            const first = !w;
            const sx = nw / (w || nw);
            const sy = nh / (h || nh);
            w = nw;
            h = nh;
            if (first) setup("dipole");
            else for (const c of charges) (c.x *= sx), (c.y *= sy);
            dirty = true;
        },
        frame(t, dt) {
            if (dirty) rebuild();
            if (opts.sparks && playing) stepSparks(dt);
            draw();
        },
        down(p) {
            const c = near(p);
            if (c && p.shift) {
                c.q = -c.q;
                dirty = true;
            } else if (c) drag = { c, dx: c.x - p.x, dy: c.y - p.y, moved: false };
            else if (charges.length < 16) {
                charges.push({ x: p.x, y: p.y, q: p.button === 2 ? -1 : 1 });
                dirty = true;
            }
        },
        move(p) {
            if (!drag || !p.down) return;
            drag.c.x = p.x + drag.dx;
            drag.c.y = p.y + drag.dy;
            drag.moved = true;
            dirty = true;
        },
        up(p) {
            // Right-click on a charge without dragging removes it.
            if (drag && !drag.moved && p.button === 2) {
                charges = charges.filter((c) => c !== drag.c);
                dirty = true;
            }
            drag = null;
            wake();
        },
        running: () => playing && opts.sparks,
        set(key, v) {
            opts[key] = v;
            dirty = true;
            wake();
        },
        setup(id) {
            setup(id);
            wake();
        },
        clear() {
            charges = [];
            dirty = true;
            wake();
        },
    };
}

export default function FieldLines() {
    const { canvasRef, toyRef } = useToy(create);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [setup, setSetup] = useState("dipole");
    const [s, setS] = useState({ per: 12, bands: true, sparks: !reduced });
    const toy = () => toyRef.current;
    const set = (key) => (v) => {
        setS((o) => ({ ...o, [key]: v }));
        toy()?.set(key, v);
    };

    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas" />
            <ToyPanel>
                <ToySelect label="Setup" value={setup} options={SETUPS.map((x) => ({ value: x.id, label: x.label }))} onChange={(id) => (setSetup(id), toy()?.setup(id))} />
                <ToySlider label="Lines per charge" value={s.per} min={4} max={32} onChange={set("per")} />
                <ToyButtons
                    items={[
                        { id: "bands", label: "Voltage", active: s.bands, onClick: () => set("bands")(!s.bands) },
                        { id: "sparks", label: "Flow", active: s.sparks, onClick: () => set("sparks")(!s.sparks) },
                        { id: "clear", label: "Clear", onClick: () => toy()?.clear() },
                    ]}
                />
            </ToyPanel>
            <ToyTools tools={[]} hint="Click to add + · right-click for − · drag to move · shift-click to flip" />
        </>
    );
}
