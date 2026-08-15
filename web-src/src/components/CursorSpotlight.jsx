import { useEffect, useRef } from "react";

// A large, soft glow that follows the cursor around the whole page —
// separate from (and much subtler than) the per-card spotlight in
// cardSpotlight.js. Written straight to the DOM on pointer move rather than
// through React state, same reasoning as the card spotlight: this fires on
// every pointer move, and re-rendering the tree for that would be wasteful.
// Starts off-screen so it doesn't flash into view at (0,0) before the
// first real pointer move.
export default function CursorSpotlight() {
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        // A large glow trailing the cursor around the whole page is exactly
        // the kind of continuous parallax-style motion prefers-reduced-motion
        // is meant to suppress — skip attaching the listener entirely, so it
        // just never appears (opacity stays at its default 0).
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        // pointermove, not mousemove: mobile browsers dispatch a synthetic
        // "compatibility" mousemove right after every tap, which would make
        // this glow pop into view at the tap location and then just sit
        // there — there's no follow-up movement on a touchscreen to carry
        // it anywhere or fade it back out. A PointerEvent carries a real
        // pointerType, so touch taps can be told apart from an actual
        // mouse and ignored outright.
        function onMove(e) {
            if (e.pointerType !== "mouse") return;
            el.style.transform = `translate(${e.clientX - 320}px, ${e.clientY - 320}px)`;
            el.style.opacity = "1";
        }

        window.addEventListener("pointermove", onMove);
        return () => window.removeEventListener("pointermove", onMove);
    }, []);

    return <div className="cursor-spotlight" ref={ref} aria-hidden="true" />;
}
