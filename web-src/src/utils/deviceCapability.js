// Shared gating logic for anything that mounts a heavier decorative effect
// (currently just HexField3D, but written generically so future 3D/canvas
// work can reuse it instead of re-deriving these thresholds).

export function prefersReducedMotion() {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Below this viewport width, or on hardware that reports itself as
// constrained, skip the effect entirely rather than risk jank — there's no
// way to benchmark actual GPU performance up front, so these are the same
// coarse signals commonly used to gate this kind of ambient decoration.
export function isLowPowerDevice() {
    if (typeof window === "undefined") return true;
    if (window.innerWidth < 768) return true;
    if (typeof navigator !== "undefined") {
        if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return true;
        if (navigator.deviceMemory && navigator.deviceMemory <= 4) return true;
    }
    return false;
}

// The middle ground: not low-power enough to skip the effect, but not
// spacious enough to run it at full instance count either.
export function isMidTierDevice() {
    return typeof window !== "undefined" && window.innerWidth < 1200;
}
