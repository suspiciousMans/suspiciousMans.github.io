import { useEffect, useRef } from "react";
import { getGsap } from "../utils/gsapSetup.js";

// Backs the pin/scrub-driven motion that useScrollReveal's plain
// IntersectionObserver reveal can't do (pinning sections, scroll-scrubbed
// timelines) — kept as a separate hook rather than folding it into
// useScrollReveal, since the two solve different problems and a dual-mode
// API would just conflate them. useScrollReveal stays exactly as-is for the
// simple one-shot reveals elsewhere on the site.
//
// `buildFn({ gsap, ScrollTrigger, root })` is only invoked under
// "(prefers-reduced-motion: no-preference)" (via gsap.matchMedia, which
// also auto-reverts whatever it creates if that media query stops
// matching, e.g. the OS setting changes mid-session) and should build and
// return its ScrollTrigger-driven animations scoped to `root`.
export default function useScrollTimeline(buildFn, deps = []) {
    const rootRef = useRef(null);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return undefined;

        let mm;
        let cancelled = false;

        getGsap().then(({ gsap, ScrollTrigger }) => {
            if (cancelled || !rootRef.current) return;
            mm = gsap.matchMedia();
            mm.add("(prefers-reduced-motion: no-preference)", () => buildFn({ gsap, ScrollTrigger, root: rootRef.current }));
        });

        return () => {
            cancelled = true;
            if (mm) mm.revert();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return rootRef;
}
