import { useEffect, useRef } from "react";

// Shared plumbing for the canvas toys: sizing, pointer input, the frame loop
// and the theme's ink color. A toy passes `create(env)` and gets back
// { canvasRef, toyRef }: the ref for its <canvas>, and the object `create`
// returned (so buttons can call its own methods). That object has any of:
//   resize(w, h)      canvas size in toy units (px, or cells when `cell` is set)
//   frame(t, dt)      advance and draw; t and dt in seconds
//   down(p) move(p) up(p)   pointer in toy units: { x, y, down, button, shift }
// env: { canvas, ctx, ink(), reduced, wake() }. ink() is the theme's --fg as
// "r, g, b", read fresh so a theme switch shows up on the next frame.
//
// `cell` renders at 1/cell resolution and scales up pixelated, for the
// grid toys. With reduced motion the loop only runs while someone is
// interacting, plus a moment after, instead of all the time.
export default function useToy(create, { cell = 0 } = {}) {
    const ref = useRef(null);
    const toyRef = useRef(null);

    useEffect(() => {
        const canvas = ref.current;
        const ctx = canvas.getContext("2d");
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let ink = "255, 197, 61";
        let inkAt = 0;
        const readInk = () => {
            const now = performance.now();
            if (now - inkAt > 250) {
                ink = getComputedStyle(canvas).getPropertyValue("--fg-rgb").trim() || ink;
                inkAt = now;
            }
            return ink;
        };

        let raf = 0;
        let last = 0;
        let awakeUntil = 0;
        let sized = false; // no frames until the toy has been told its size
        const pointer = { x: -1e4, y: -1e4, down: false, button: 0, shift: false };

        function wake() {
            awakeUntil = performance.now() + 1500;
            if (!raf) raf = requestAnimationFrame(loop);
        }

        const toy = create({ canvas, ctx, ink: readInk, reduced, wake }) || {};
        toyRef.current = toy;

        function resize() {
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            if (!w || !h) return;
            sized = true;
            if (cell) {
                canvas.width = Math.max(1, Math.floor(w / cell));
                canvas.height = Math.max(1, Math.floor(h / cell));
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                toy.resize?.(canvas.width, canvas.height);
            } else {
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                canvas.width = Math.round(w * dpr);
                canvas.height = Math.round(h * dpr);
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                toy.resize?.(w, h);
            }
            wake();
        }

        function loop(ts) {
            const t = ts / 1000;
            const dt = last ? Math.min(t - last, 1 / 20) : 1 / 60;
            last = t;
            if (sized) toy.frame?.(t, dt);
            if (reduced && !pointer.down && ts > awakeUntil) {
                raf = 0;
                last = 0;
                return;
            }
            raf = requestAnimationFrame(loop);
        }

        function locate(e) {
            const rect = canvas.getBoundingClientRect();
            const k = cell ? canvas.width / rect.width : 1;
            pointer.x = (e.clientX - rect.left) * k;
            pointer.y = (e.clientY - rect.top) * k;
            pointer.shift = e.shiftKey;
        }
        function down(e) {
            if (!sized) return;
            locate(e);
            pointer.down = true;
            pointer.button = e.button;
            canvas.setPointerCapture?.(e.pointerId);
            toy.down?.(pointer);
            wake();
        }
        function move(e) {
            locate(e);
            toy.move?.(pointer);
            if (reduced) wake();
        }
        function up(e) {
            locate(e);
            pointer.down = false;
            toy.up?.(pointer);
            wake();
        }
        function leave() {
            if (pointer.down) return;
            pointer.x = pointer.y = -1e4;
            toy.move?.(pointer);
        }
        const noMenu = (e) => e.preventDefault();

        const ro = new ResizeObserver(resize);
        ro.observe(canvas);
        canvas.addEventListener("pointerdown", down);
        canvas.addEventListener("pointermove", move);
        canvas.addEventListener("pointerup", up);
        canvas.addEventListener("pointercancel", up);
        canvas.addEventListener("pointerleave", leave);
        canvas.addEventListener("contextmenu", noMenu);
        const onVisible = () => !document.hidden && wake();
        document.addEventListener("visibilitychange", onVisible);
        wake();

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            canvas.removeEventListener("pointerdown", down);
            canvas.removeEventListener("pointermove", move);
            canvas.removeEventListener("pointerup", up);
            canvas.removeEventListener("pointercancel", up);
            canvas.removeEventListener("pointerleave", leave);
            canvas.removeEventListener("contextmenu", noMenu);
            document.removeEventListener("visibilitychange", onVisible);
            toy.destroy?.();
        };
        // `create` is a module-level function per toy; run once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { canvasRef: ref, toyRef };
}
