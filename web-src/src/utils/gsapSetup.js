// Lazy, memoized GSAP + ScrollTrigger loader — only Home and Projects ever
// call this (via useScrollTimeline), so every other route's bundle never
// pays for GSAP.
let modulePromise;

export function getGsap() {
    if (!modulePromise) {
        modulePromise = Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
            ([gsapModule, scrollTriggerModule]) => {
                const gsap = gsapModule.gsap || gsapModule.default;
                const ScrollTrigger = scrollTriggerModule.ScrollTrigger || scrollTriggerModule.default;
                gsap.registerPlugin(ScrollTrigger);
                return { gsap, ScrollTrigger };
            }
        );
    }
    return modulePromise;
}
