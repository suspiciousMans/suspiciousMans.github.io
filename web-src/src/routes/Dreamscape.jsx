import { useEffect, useRef, useState } from "react";
import Title from "../components/Title.jsx";
import useScrollReveal from "../hooks/useScrollReveal.js";

const REPO = "https://github.com/suspiciousMans/dreamscape";

// /dreamscape/ is the game's Emscripten (WebAssembly + WebGL2) build, copied
// from the dreamscape repo's games/dreamscape/web output. Bump this whenever
// those files change, or browsers keep the cached frame.
const DREAMSCAPE_VERSION = "2";

// The gallery shots come from the repo's own
// games/dreamscape/tools/screenshots.sh.
const DREAMS = [
    { slug: "mycelium-grove", name: "Mycelium Grove", note: "Root bridges over the void; glowing veins lead to the shard." },
    { slug: "the-tunnel", name: "The Tunnel", note: "One long corridor toward a white light, gates opening in a wave." },
    { slug: "fractal-cathedral", name: "Fractal Cathedral", note: "Square rooms nested inside each other." },
    { slug: "elfworks", name: "Elfworks", note: "A jewelled toy workshop full of jesters." },
    { slug: "liminal-office", name: "Liminal Office", note: "Endless yellow halls. Stalkers only move when you can't see them." },
    { slug: "mirror-hall", name: "Mirror Hall", note: "Mimics walk your own path three seconds behind you." },
    { slug: "sky-stairs", name: "Sky Stairs", note: "Staircases hung in open sky." },
    { slug: "void-platforms", name: "Void Platforms", note: "Drifters swing across the gaps you jump." },
    { slug: "nightmare-factory", name: "Nightmare Factory", note: "Sentries sweep a beam and call the pacers." },
    { slug: "cursed-forest", name: "Cursed Forest", note: "Dark woods, swirling ground." },
    { slug: "garden", name: "Garden", note: "Bright hedges. Jesters throw you somewhere else." },
    { slug: "lobby", name: "Dream Lobby", note: "Where every run falls asleep." },
];

const CONTROLS = [
    ["WASD", "move"],
    ["Space", "jump"],
    ["Shift / E", "ability slot 1 / 2"],
    ["1 / 2 / 3", "pick an upgrade"],
    ["Esc", "pause"],
    ["L / B", "Lucid Store / dream booklet"],
];

export default function Dreamscape() {
    const revealRef = useScrollReveal();
    // The build is ~6 MB, so it only loads once the visitor asks to play.
    const [playing, setPlaying] = useState(false);
    const [fsLabel, setFsLabel] = useState("⛶ Fullscreen");
    const wrapRef = useRef(null);
    const frameRef = useRef(null);

    useEffect(() => {
        function onChange() {
            const fs = !!(document.fullscreenElement || document.webkitFullscreenElement);
            setFsLabel(fs ? "⛶ Exit Fullscreen" : "⛶ Fullscreen");
            frameRef.current?.contentWindow?.focus();
        }
        document.addEventListener("fullscreenchange", onChange);
        document.addEventListener("webkitfullscreenchange", onChange);
        return () => {
            document.removeEventListener("fullscreenchange", onChange);
            document.removeEventListener("webkitfullscreenchange", onChange);
        };
    }, []);

    function toggleFullscreen() {
        const wrap = wrapRef.current;
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
            (wrap.requestFullscreen || wrap.webkitRequestFullscreen)?.call(wrap);
        }
    }

    return (
        <div ref={revealRef}>
            <section className="hero hero-left hero-tight">
                <div className="wrap">
                    <span className="label eyebrow">Game · Rust</span>
                    <Title segments={[{ text: "Dream" }, { text: "scape", accent: true }]} />
                    <p className="lede">
                        A PS2-style dream-escape roguelike built on my own Rust engine. You fall asleep and sink through
                        an endless run of procedurally generated dreams, picking up an upgrade after each one. Collect
                        lucidity shards to wake up, or refuse the wake door and go deeper.
                    </p>
                </div>
            </section>

            <section className="section-flush">
                <div className="wrap">
                    <div className="game-shell">
                        <div className="game-canvas-wrap" style={{ aspectRatio: "16 / 9" }} ref={wrapRef}>
                            {playing ? (
                                <iframe
                                    ref={frameRef}
                                    src={"/dreamscape/index.html?v=" + DREAMSCAPE_VERSION}
                                    title="Dreamscape"
                                    allow="fullscreen; autoplay; gamepad"
                                    onLoad={() => frameRef.current?.contentWindow?.focus()}
                                ></iframe>
                            ) : (
                                <button type="button" className="dream-poster" onClick={() => setPlaying(true)}>
                                    <img src="/assets/img/dreamscape/mycelium-grove.jpg" alt="" />
                                    <span className="btn btn-primary">▶ Fall asleep</span>
                                </button>
                            )}
                        </div>
                        <div className="game-toolbar">
                            <span className="status">
                                Runs in your browser via WebAssembly + WebGL2. Needs a keyboard or a controller.
                            </span>
                            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                {playing && (
                                    <button type="button" className="btn btn-outline" onClick={toggleFullscreen}>
                                        {fsLabel}
                                    </button>
                                )}
                                <a className="btn btn-outline" href={REPO} target="_blank" rel="noopener noreferrer">
                                    Source ↗
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="section-tight">
                <div className="wrap">
                    <span className="label eyebrow">Some of the dreams</span>
                    <div className="dream-grid">
                        {DREAMS.map((d) => (
                            <figure key={d.slug} className="dream-shot reveal" data-reveal>
                                <img src={`/assets/img/dreamscape/${d.slug}.jpg`} alt={`Dreamscape: ${d.name}`} loading="lazy" />
                                <figcaption>
                                    <strong>{d.name}</strong>
                                    <span>{d.note}</span>
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                </div>
            </section>

            <section className="section-tight">
                <div className="wrap dream-info">
                    <div className="reveal" data-reveal>
                        <span className="label eyebrow">What's in it</span>
                        <ul>
                            <li>No hand-built levels: every dream has its own layout rules, props, palette and music.</li>
                            <li>Three random upgrades after every dream, with rare abilities, curses and combos.</li>
                            <li>Special enemies from depth 3: stalkers, mimics, sentries, drifters and jesters.</li>
                            <li>First-person dreams, and nightmare bosses that get harder the deeper you go.</li>
                            <li>Today's dream (one shared seed a day), ten ascension levels and a codex.</li>
                            <li>Every sound effect is synthesized in code.</li>
                        </ul>
                    </div>
                    <div className="reveal" data-reveal>
                        <span className="label eyebrow">Controls</span>
                        <table className="dream-controls">
                            <tbody>
                                {CONTROLS.map(([key, action]) => (
                                    <tr key={key}>
                                        <td className="mono">{key}</td>
                                        <td>{action}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <span className="label eyebrow">Run it natively</span>
                        <pre className="dream-run mono">
                            {`git clone ${REPO}\ncd dreamscape\ncargo run -p dreamscape --release`}
                        </pre>
                    </div>
                </div>
            </section>
        </div>
    );
}
