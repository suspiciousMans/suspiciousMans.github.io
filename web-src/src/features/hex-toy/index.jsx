import { useEffect, useRef } from "react";

// Starter Lab feature: a hex grid on a canvas. Hexes lift toward the cursor
// and clicks send out an expanding ring. Fills whatever box it's given.
const SIZE = 22;
const W = Math.sqrt(3) * SIZE;
const H = 1.5 * SIZE;

export default function HexToy() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const pointer = { x: -1e4, y: -1e4 };
        const pulses = [];
        let raf = 0;
        let width = 0;
        let height = 0;

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            if (reduced) draw(0);
        }

        function hexPath(cx, cy, r) {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i + Math.PI / 6;
                const x = cx + r * Math.cos(a);
                const y = cy + r * Math.sin(a);
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.closePath();
        }

        function draw(t) {
            ctx.clearRect(0, 0, width, height);
            for (let i = pulses.length - 1; i >= 0; i--) {
                if (t - pulses[i].t0 > 2000) pulses.splice(i, 1);
            }
            const rows = Math.ceil(height / H) + 1;
            const cols = Math.ceil(width / W) + 1;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const cx = c * W + (r % 2 ? W / 2 : 0);
                    const cy = r * H;
                    const d = Math.hypot(cx - pointer.x, cy - pointer.y);
                    let k = Math.max(0, 1 - d / 180);
                    for (const p of pulses) {
                        const ring = ((t - p.t0) / 2000) * 600;
                        const dd = Math.abs(Math.hypot(cx - p.x, cy - p.y) - ring);
                        k = Math.max(k, Math.max(0, 1 - dd / 40) * (1 - (t - p.t0) / 2000));
                    }
                    hexPath(cx, cy, SIZE * (0.55 + 0.35 * k));
                    ctx.strokeStyle = `rgba(188,171,174,${0.14 + 0.7 * k})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    if (k > 0.6) {
                        ctx.fillStyle = `rgba(236,230,231,${(k - 0.6) * 1.6})`;
                        ctx.fill();
                    }
                }
            }
        }

        function loop(t) {
            draw(t);
            raf = requestAnimationFrame(loop);
        }

        function move(e) {
            const rect = canvas.getBoundingClientRect();
            pointer.x = e.clientX - rect.left;
            pointer.y = e.clientY - rect.top;
            if (reduced) draw(performance.now());
        }
        function leave() {
            pointer.x = pointer.y = -1e4;
            if (reduced) draw(performance.now());
        }
        function click(e) {
            move(e);
            if (!reduced) pulses.push({ x: pointer.x, y: pointer.y, t0: performance.now() });
        }

        const ro = new ResizeObserver(resize);
        ro.observe(canvas);
        canvas.addEventListener("pointermove", move);
        canvas.addEventListener("pointerleave", leave);
        canvas.addEventListener("pointerdown", click);
        if (!reduced) raf = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            canvas.removeEventListener("pointermove", move);
            canvas.removeEventListener("pointerleave", leave);
            canvas.removeEventListener("pointerdown", click);
        };
    }, []);

    return <canvas ref={canvasRef} className="fill-canvas" />;
}
