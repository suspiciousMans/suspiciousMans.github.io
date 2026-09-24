import useToy from "../useToy.js";
import ToyTools from "../ToyTools.jsx";

// A swarm of specks that chases the cursor. Hold to pull them in tight,
// let go to burst them out. Left alone, they trace a slow loop.
const COUNT = 700;

function create({ ctx, ink }) {
    let w = 0;
    let h = 0;
    const px = new Float32Array(COUNT);
    const py = new Float32Array(COUNT);
    const vx = new Float32Array(COUNT);
    const vy = new Float32Array(COUNT);
    const spd = new Float32Array(COUNT); // each speck's own eagerness
    const pointer = { x: -1e4, y: -1e4, down: false };
    let seeded = false;

    function seed() {
        for (let i = 0; i < COUNT; i++) {
            px[i] = Math.random() * w;
            py[i] = Math.random() * h;
            vx[i] = vy[i] = 0;
            spd[i] = 0.6 + Math.random() * 0.8;
        }
        seeded = true;
    }

    function burst(x, y, power) {
        for (let i = 0; i < COUNT; i++) {
            const dx = px[i] - x;
            const dy = py[i] - y;
            const d = Math.hypot(dx, dy) + 1;
            const k = (power * spd[i]) / Math.sqrt(d);
            vx[i] += (dx / d) * k;
            vy[i] += (dy / d) * k;
        }
    }

    return {
        resize(nw, nh) {
            w = nw;
            h = nh;
            if (!seeded) seed();
        },
        frame(t, dt) {
            const here = pointer.x > -1e3;
            // With no cursor, follow a lazy figure-eight.
            const tx = here ? pointer.x : w / 2 + Math.sin(t * 0.5) * w * 0.3;
            const ty = here ? pointer.y : h / 2 + Math.sin(t * 1.0) * h * 0.22;
            const pull = pointer.down ? 2600 : 900;
            const drag = pointer.down ? 0.9 : 0.955;
            const s = dt * 60;
            for (let i = 0; i < COUNT; i++) {
                let dx = tx - px[i];
                let dy = ty - py[i];
                const d = Math.hypot(dx, dy) + 30;
                // Swirl around the target rather than piling onto it.
                const sw = pointer.down ? 0.2 : 0.9;
                const ax = (dx - dy * sw) / d;
                const ay = (dy + dx * sw) / d;
                vx[i] = (vx[i] + ax * pull * spd[i] * dt) * Math.pow(drag, s);
                vy[i] = (vy[i] + ay * pull * spd[i] * dt) * Math.pow(drag, s);
                px[i] += vx[i] * dt * 60 * 0.12;
                py[i] += vy[i] * dt * 60 * 0.12;
                if (px[i] < 0 || px[i] > w) vx[i] *= -0.8;
                if (py[i] < 0 || py[i] > h) vy[i] *= -0.8;
                px[i] = Math.min(w, Math.max(0, px[i]));
                py[i] = Math.min(h, Math.max(0, py[i]));
            }
            ctx.clearRect(0, 0, w, h);
            const rgb = ink();
            for (let i = 0; i < COUNT; i++) {
                const v = Math.min(1, Math.hypot(vx[i], vy[i]) / 30);
                ctx.fillStyle = `rgba(${rgb},${0.35 + 0.65 * v})`;
                const size = 2 + v * 1.5;
                ctx.fillRect(Math.round(px[i]), Math.round(py[i]), size, size);
            }
        },
        move(p) {
            pointer.x = p.x;
            pointer.y = p.y;
        },
        down(p) {
            pointer.x = p.x;
            pointer.y = p.y;
            pointer.down = true;
        },
        up(p) {
            pointer.down = false;
            burst(p.x, p.y, 60);
        },
        scatter() {
            seed();
        },
    };
}

export default function Swarm() {
    const { canvasRef, toyRef } = useToy(create);
    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas" />
            <ToyTools
                tools={[{ id: "scatter", label: "Scatter", onClick: () => toyRef.current?.scatter() }]}
                hint="Move to lead · hold to gather · let go to burst"
            />
        </>
    );
}
