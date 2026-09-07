// Static stand-in for HexField3D — no WebGL context, no JS animation loop.
// Renders inside the caller's own `.hero-visual` box (used for
// prefers-reduced-motion, low-power devices, and as the Suspense fallback
// while the real scene's chunk is still loading), so there's never a
// layout shift when the canvas mounts in its place.
export default function HexFieldFallback() {
    return (
        <svg viewBox="0 0 200 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
                <pattern id="hex-fallback" width="34" height="59" patternUnits="userSpaceOnUse" patternTransform="translate(0,0)">
                    <polygon
                        points="17,2 32,10.5 32,27.5 17,36 2,27.5 2,10.5"
                        fill="none"
                        stroke="rgba(1,200,135,0.16)"
                        strokeWidth="1.5"
                    />
                    <polygon
                        points="17,31 32,39.5 32,56.5 17,65 2,56.5 2,39.5"
                        fill="none"
                        stroke="rgba(1,200,135,0.1)"
                        strokeWidth="1.5"
                    />
                </pattern>
            </defs>
            <rect width="200" height="200" fill="url(#hex-fallback)" />
        </svg>
    );
}
