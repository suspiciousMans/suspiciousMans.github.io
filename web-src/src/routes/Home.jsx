import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import TypewriterTitle from "../components/TypewriterTitle.jsx";
import HeroSting from "../components/HeroSting.jsx";
import { handleCardPointerMove, handleCardPointerLeave } from "../utils/cardSpotlight.js";
import useScrollReveal from "../hooks/useScrollReveal.js";

export default function Home() {
    const revealRef = useScrollReveal();
    // Home.jsx fully remounts on every arrival at "/" (route content keys
    // off the pathname — see App.jsx), so mounting HeroSting unconditionally
    // here already gives the "plays on every fresh homepage load" behavior
    // without needing any persistence flag; it just plays once per mount
    // and then removes itself.
    const [stingDone, setStingDone] = useState(false);
    const onStingDone = useCallback(() => setStingDone(true), []);

    return (
        <div ref={revealRef}>
            {!stingDone && <HeroSting onDone={onStingDone} />}
            <section className="hero">
                <div className="wrap">
                    <span className="eyebrow">Rust · Game Dev · Web</span>
                    <TypewriterTitle segments={[{ text: "I Am " }, { text: "Suspicious", accent: true }]} />
                    <p className="lede">
                        I build things in Rust — a hex-grid colony builder, a PS2-style game engine, and whatever else
                        keeps me off the grass. Most of it ends up here eventually.
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
            </section>

            <section id="featured">
                <div className="wrap">
                    <div className="section-head">
                        <span className="eyebrow">Featured</span>
                        <h2>Hex Colony</h2>
                        <p>A turn-based, pixel-art hex colony builder written in Rust — now playable straight in the browser.</p>
                    </div>
                    <div className="reveal" data-reveal style={{ maxWidth: "820px", margin: "0 auto" }}>
                        <div className="card" onPointerMove={handleCardPointerMove} onPointerLeave={handleCardPointerLeave}>
                            <div className="card-media" data-shimmer>
                                <img
                                    src="/assets/img/hex-colony-preview.png"
                                    alt="Hex Colony gameplay screenshot showing the hex grid board and hotbar"
                                    loading="lazy"
                                />
                            </div>
                            <div className="tags">
                                <span className="tag tag-accent">Rust</span>
                                <span className="tag">WebAssembly</span>
                                <span className="tag">Pixel Art</span>
                            </div>
                            <p>
                                Place buildings on a hex grid, manage resources, and race to a score target — compiled to
                                WebAssembly so it runs entirely client-side, no download required.
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
                    <div className="section-head">
                        <span className="eyebrow">Also playable</span>
                        <h2>AutoCode</h2>
                        <p>Write JavaScript or Python and automate a farm, a spaceship, a store, and a factory — runs entirely in the browser.</p>
                    </div>
                    <div className="reveal" data-reveal style={{ maxWidth: "820px", margin: "0 auto" }}>
                        <div className="card" onPointerMove={handleCardPointerMove} onPointerLeave={handleCardPointerLeave}>
                            <div className="card-media" data-shimmer>
                                <img
                                    src="/assets/img/autocode-preview.png"
                                    alt="AutoCode gameplay screenshot showing a script editor and a growing wheat plot"
                                    loading="lazy"
                                />
                            </div>
                            <div className="tags">
                                <span className="tag tag-accent">JavaScript</span>
                                <span className="tag">Python</span>
                                <span className="tag">TypeScript</span>
                            </div>
                            <p>Four worlds, one idea: describe what should happen, then watch your script run it — once, or every tick, forever.</p>
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
                    <div className="section-head">
                        <span className="eyebrow">Who's this</span>
                        <h2>A bit about me</h2>
                        <p>
                            I'm somewhat of a web designer and mostly a Rust enthusiast. I enjoy building small engines and
                            games from scratch more than using existing ones.
                        </p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                        <Link className="btn btn-outline" to="/about.html">
                            Read more
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
