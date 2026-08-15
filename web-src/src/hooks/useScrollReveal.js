import { useEffect, useRef } from "react";

// IntersectionObserver-driven scroll reveal for any subtree of elements
// marked data-reveal — fade + rise into place the first time each one
// enters the viewport, then stop observing it (a one-shot reveal, not a
// repeating scroll effect). An element can also carry a nested
// [data-shimmer] node (a card's image wrapper) that gets a brief shimmer
// sweep the moment its wrapper reveals, styled as a skeleton-loading cue
// even though the image itself is already loaded.
export default function useScrollReveal() {
    const containerRef = useRef(null);

    useEffect(() => {
        const root = containerRef.current;
        if (!root) return;

        const targets = root.querySelectorAll("[data-reveal]");
        if (!targets.length) return;

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reducedMotion) {
            targets.forEach((el) => el.classList.add("revealed"));
            return;
        }

        function reveal(el) {
            el.classList.add("revealed");
            const media = el.querySelector("[data-shimmer]");
            if (!media) return;
            media.classList.add("shimmer");
            const clearShimmer = () => media.classList.remove("shimmer");
            media.addEventListener("animationend", clearShimmer, { once: true });
            // Belt-and-suspenders in case animationend never fires.
            setTimeout(clearShimmer, 4500);
        }

        function isRoughlyInView(el) {
            const rect = el.getBoundingClientRect();
            return rect.bottom > 0 && rect.top < window.innerHeight;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        reveal(entry.target);
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15 }
        );

        // IntersectionObserver's first callback is asynchronous by spec,
        // and gets measurably delayed further while a View Transition is
        // actively animating (confirmed empirically — the common case
        // here, since this hook's own mount is itself the "new page" side
        // of a route's page-content transition). Rather than have content
        // that's already on screen sit invisible for the better part of a
        // second, check synchronously up front and reveal those
        // immediately; only elements actually below the fold go through
        // the observer.
        targets.forEach((el) => {
            if (isRoughlyInView(el)) {
                reveal(el);
            } else {
                observer.observe(el);
            }
        });

        return () => observer.disconnect();
    }, []);

    return containerRef;
}
