import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Instances, Instance } from "@react-three/drei";
import { isMidTierDevice } from "../utils/deviceCapability.js";

const ACCENT = "#01c887";
const ACCENT_2 = "#f7b117";
const BASE_LOW = "#0a1416";
const BASE_HIGH = "#17262a";

// Small deterministic hash so each hex's color/height/jitter is stable
// across re-renders without needing a seeded-random dependency.
function hash(q, r) {
    const x = Math.sin(q * 127.1 + r * 311.7) * 43758.5453;
    return x - Math.floor(x);
}

// Flat-top axial hex grid, "radius" rings out from the origin — the
// standard redblobgames axial-to-pixel formula. Not intended to tile
// perfectly seamlessly (a couple of decorative gaps/overlaps are fine for
// ambient background texture); the point is a recognizable hex-field
// silhouette, not a literal playable board.
function buildHexes(rings) {
    const size = 1.02;
    const hexes = [];
    for (let q = -rings; q <= rings; q++) {
        const rMin = Math.max(-rings, -q - rings);
        const rMax = Math.min(rings, -q + rings);
        for (let r = rMin; r <= rMax; r++) {
            const x = size * 1.5 * q;
            const z = size * (Math.sqrt(3) / 2) * q + size * Math.sqrt(3) * r;
            const h = hash(q, r);
            const dist = Math.sqrt(q * q + r * r + q * r) / rings;
            const terrain = 0.16 + 0.14 * Math.sin(q * 0.5 + r * 0.35) * Math.cos(r * 0.4 - q * 0.22);
            const height = Math.max(0.05, terrain + h * 0.06) * (1 - dist * 0.35);
            let color = h > 0.94 ? ACCENT : h > 0.9 ? ACCENT_2 : null;
            const lit = color !== null;
            if (!color) {
                color = h > 0.5 ? BASE_HIGH : BASE_LOW;
            }
            hexes.push({ q, r, x, z, height, color, lit });
        }
    }
    return hexes;
}

function HexGrid({ rings, scrollProgressRef, enableParallax }) {
    const groupRef = useRef(null);
    const pointer = useRef({ x: 0, y: 0 });
    const hexes = useMemo(() => buildHexes(rings), [rings]);

    useFrame((state, delta) => {
        const group = groupRef.current;
        if (!group) return;

        // Idle drift — a slow perpetual rotation so the field never looks
        // like a static image, independent of any user input.
        group.rotation.y += delta * 0.035;

        if (enableParallax) {
            const targetX = pointer.current.x * 0.35;
            const targetTilt = -pointer.current.y * 0.12;
            group.rotation.x += (targetTilt - group.rotation.x) * Math.min(1, delta * 3);
            group.position.x += (targetX - group.position.x) * Math.min(1, delta * 3);
        }

        if (scrollProgressRef) {
            const progress = scrollProgressRef.current || 0;
            group.position.y = -progress * 0.6;
        }
    });

    function onPointerMove(e) {
        if (!enableParallax) return;
        pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    }

    return (
        <group
            ref={groupRef}
            rotation={[-0.55, 0.5, 0]}
            onPointerMove={enableParallax ? onPointerMove : undefined}
        >
            <Instances limit={hexes.length} range={hexes.length}>
                <cylinderGeometry args={[1, 1, 1, 6]} />
                <meshStandardMaterial roughness={0.55} metalness={0.15} />
                {hexes.map((hex) => (
                    <Instance
                        key={`${hex.q},${hex.r}`}
                        position={[hex.x, hex.height / 2, hex.z]}
                        scale={[0.92, hex.height, 0.92]}
                        rotation={[0, Math.PI / 6, 0]}
                        color={hex.color}
                    />
                ))}
            </Instances>
            {/* Emissive glow layer for the lit tiles, drawn as a second cheap
                instanced pass rather than adding a point light per tile. */}
            <Instances limit={hexes.length} range={hexes.length}>
                <cylinderGeometry args={[0.5, 0.5, 0.06, 6]} />
                <meshStandardMaterial emissiveIntensity={1.4} toneMapped={false} />
                {hexes
                    .filter((hex) => hex.lit)
                    .map((hex) => (
                        <Instance
                            key={`glow-${hex.q},${hex.r}`}
                            position={[hex.x, hex.height + 0.03, hex.z]}
                            rotation={[0, Math.PI / 6, 0]}
                            color={hex.color}
                            emissive={hex.color}
                        />
                    ))}
            </Instances>
        </group>
    );
}

// Ambient decoration only — fixed camera, no OrbitControls, nothing the
// visitor is meant to "explore". Mouse parallax and scroll drift are both
// optional, gated by the caller based on device capability.
export default function HexField3D({ scrollProgressRef, reduceComplexity = false }) {
    const midTier = reduceComplexity || isMidTierDevice();
    const rings = midTier ? 5 : 8;
    const enableParallax = !midTier && typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

    return (
        <Canvas
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true }}
            camera={{ position: [0, 5.5, 9], fov: 38 }}
            style={{ background: "transparent" }}
        >
            <ambientLight intensity={0.65} />
            <directionalLight position={[4, 6, 3]} intensity={0.9} color="#e9f3f1" />
            <HexGrid rings={rings} scrollProgressRef={scrollProgressRef} enableParallax={enableParallax} />
        </Canvas>
    );
}
