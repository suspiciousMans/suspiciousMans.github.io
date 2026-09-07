import { useCallback, useState, useRef, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import TypewriterTitle from "../components/TypewriterTitle.jsx";
import HeroSting from "../components/HeroSting.jsx";
import HexFieldFallback from "../components/HexFieldFallback.jsx";
import useScrollTimeline from "../hooks/useScrollTimeline.js";
import { prefersReducedMotion, isLowPowerDevice } from "../utils/deviceCapability.js";

const HexField3D = lazy(() => import("../components/HexField3D.jsx"));

export default function Home() {
    // Home.jsx fully remounts on every arrival at "/" (route content keys
    // off the pathname — see App.jsx), so mounting HeroSting unconditionally
    // here already gives the "plays on every fresh homepage load" behavior
    // without needing any persistence flag; it just plays once per mount
    // and then removes itself.
    const [stingDone, setStingDone] = useState(false);
    const onStingDone = useCallback(() => setStingDone(true), []);

    // Gate the 3D hero visual once per mount rather than re-checking on
    // every render — matches prefers-reduced-motion/low-power devices by
    // skipping the dynamic import of HexField3D (and therefore three.js)
    // entirely, falling back to a static decorative panel instead.
    const [mount3D] = useState(() => !prefersReducedMotion() && !isLowPowerDevice());
    const scrollProgressRef = useRef(0);

    const timelineRef = useScrollTimeline(({ gsap, ScrollTrigger, root }) => {
        const featureRows = root.querySelectorAll(".feature-row");

        // Scroll-linked drift for the 3D hex field as the hero gives way to
        // the first feature row — written straight into a ref that
        // HexField3D's own render loop reads, so this never triggers a
        // React re-render.
        ScrollTrigger.create({
            trigger: root.querySelector(".hero"),
            start: "top top",
            end: "bottom top",
            scrub: true,
            onUpdate: (self) => {
                scrollProgressRef.current = self.progress;
            },
        });

        featureRows.forEach((row) => {
            const reversed = row.classList.contains("reverse");
            const media = row.querySelector(".feature-media");
            const copy = row.querySelector(".feature-copy");

            gsap.fromTo(
                media,
                { autoAlpha: 0, x: reversed ? 70 : -70 },
                {
                    autoAlpha: 1,
                    x: 0,
                    ease: "power3.out",
                    scrollTrigger: { trigger: row, start: "top 78%", end: "top 38%", scrub: 0.6 },
                }
            );
            gsap.fromTo(
                copy,
                { autoAlpha: 0, x: reversed ? -70 : 70 },
                {
                    autoAlpha: 1,
                    x: 0,
                    ease: "power3.out",
                    scrollTrigger: { trigger: row, start: "top 78%", end: "top 38%", scrub: 0.6 },
                }
            );
        });
    }, []);

    return (
        <div ref={timelineRef}>
            {!stingDone && <HeroSting onDone={onStingDone} />}
            <section className="hero">
                <div className="wrap hero-grid">
                    <div className="hero-copy">
                        <span className="eyebrow">Rust · Game Dev · Web</span>
                        <TypewriterTitle segments={[{ text: "I Am " }, { text: "Suspicious", accent: true }]} />
                        <p className="lede">
                            I build things in Rust — a hex-grid colony builder, a PS2-style game engine, and whatever
                            else keeps me off the grass. Most of it ends up here eventually.
                        </p>
                        <div className="hero-actions">
                            <Link className="btn btn-primary" to="/hex-colony.html">
                                Play Hex Colony
                            </Link>
                            <Link className="btn btn-outline" to="/projects.html">
                                See Projects
                            </Link>
                        </div>
                    </div>
                    <div className="hero-visual">
                        {mount3D ? (
                            <Suspense fallback={<HexFieldFallback />}>
                                <HexField3D scrollProgressRef={scrollProgressRef} />
                            </Suspense>
                        ) : (
                            <HexFieldFallback />
                        )}
                    </div>
                </div>
            </section>

            <section id="featured">
                <div className="wrap">
                    <div className="feature-row">
                        <div className="feature-media">
                            <div className="card-media">
                                <img
                                    src="/assets/img/hex-colony-preview.png"
                                    alt="Hex Colony gameplay screenshot showing the hex grid board and hotbar"
                                    loading="lazy"
                                />
                            </div>
                        </div>
                        <div className="feature-copy">
                            <div className="section-head">
                                <span className="eyebrow">Featured</span>
                                <h2>Hex Colony</h2>
                                <p>
                                    A turn-based, pixel-art hex colony builder written in Rust — now playable straight
                                    in the browser.
                                </p>
                            </div>
                            <div className="tags">
                                <span className="tag tag-accent">Rust</span>
                                <span className="tag">WebAssembly</span>
                                <span className="tag">Pixel Art</span>
                            </div>
                            <p>
                                Place buildings on a hex grid, manage resources, and race to a score target —
                                compiled to WebAssembly so it runs entirely client-side, no download required.
                            </p>
                            <div className="card-links">
                                <Link to="/hex-colony.html">Play in browser</Link>
                                <a href="https://github.com/suspiciousMans/Hex-Colony" target="_blank" rel="noopener noreferrer">
                                    Source
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="autocode-featured">
                <div className="wrap">
                    <div className="feature-row reverse">
                        <div className="feature-media">
                            <div className="card-media">
                                <img
                                    src="/assets/img/autocode-preview.png"
                                    alt="AutoCode gameplay screenshot showing a script editor and a growing wheat plot"
                                    loading="lazy"
                                />
                            </div>
                        </div>
                        <div className="feature-copy">
                            <div className="section-head">
                                <span className="eyebrow">Also playable</span>
                                <h2>AutoCode</h2>
                                <p>
                                    Write JavaScript or Python and automate a farm, a spaceship, a store, and a
                                    factory — runs entirely in the browser.
                                </p>
                            </div>
                            <div className="tags">
                                <span className="tag tag-accent">JavaScript</span>
                                <span className="tag">Python</span>
                                <span className="tag">TypeScript</span>
                            </div>
                            <p>
                                Four worlds, one idea: describe what should happen, then watch your script run it —
                                once, or every tick, forever.
                            </p>
                            <div className="card-links">
                                <Link to="/autocode.html">Play in browser</Link>
                                <a href="https://github.com/suspiciousMans/AutoCode" target="_blank" rel="noopener noreferrer">
                                    Source
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="about-teaser">
                <div className="wrap">
                    <div className="callout-band">
                        <span className="eyebrow">Who's this</span>
                        <h2>A bit about me</h2>
                        <p>
                            I'm somewhat of a web designer and mostly a Rust enthusiast. I enjoy building small
                            engines and games from scratch more than using existing ones.
                        </p>
                        <Link className="btn btn-outline" to="/about.html">
                            Read more
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
