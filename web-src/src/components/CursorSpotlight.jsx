import { useEffect, useRef } from "react";

// A large, soft glow that follows the cursor around the whole page —
// separate from (and much subtler than) the per-card spotlight in
// cardSpotlight.js. Written straight to the DOM on mousemove rather than
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

        function onMove(e) {
            el.style.transform = `translate(${e.clientX - 320}px, ${e.clientY - 320}px)`;
            el.style.opacity = "1";
        }

        window.addEventListener("mousemove", onMove);
        return () => window.removeEventListener("mousemove", onMove);
    }, []);

    return <div className="cursor-spotlight" ref={ref} aria-hidden="true" />;
}
