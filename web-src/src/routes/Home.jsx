import { Link } from "react-router-dom";
import Title from "../components/Title.jsx";
import ProjectRow from "../components/ProjectRow.jsx";
import useScrollReveal from "../hooks/useScrollReveal.js";
import projects from "../data/projects.js";
import features from "../data/features.js";

const FEATURED = [
    {
        name: "Hex Colony",
        kicker: "Rust · WebAssembly",
        image: "/assets/img/hex-colony-preview.png",
        imageAlt: "Hex Colony gameplay screenshot showing the hex grid board and hotbar",
        text: "A turn-based, pixel-art hex colony builder. Place buildings, manage resources, race to a score target — compiled to WebAssembly and running entirely in your browser.",
        play: "/hex-colony.html",
        source: "https://github.com/suspiciousMans/Hex-Colony",
    },
    {
        name: "AutoCode",
        kicker: "JavaScript · Python",
        image: "/assets/img/autocode-preview.png",
        imageAlt: "AutoCode gameplay screenshot showing a script editor and a growing wheat plot",
        text: "Write real scripts to automate a farm, a spaceship, a store, and a factory. Describe what should happen, then watch it run — once, or every tick, forever.",
        play: "/autocode.html",
        source: "https://github.com/suspiciousMans/AutoCode",
    },
];

const FEATURED_NAMES = new Set(FEATURED.map((f) => f.name));

export default function Home() {
    const revealRef = useScrollReveal();
    const rest = projects.filter((p) => !FEATURED_NAMES.has(p.name));

    return (
        <div ref={revealRef}>
            <section className="hero">
                <div className="wrap">
                    <span className="label eyebrow">Rust · Game Dev · Web</span>
                    <Title segments={[{ text: "I am " }, { text: "suspicious.", accent: true }]} />
                    <p className="lede">
                        I build things from scratch — a hex-grid colony builder, a PS2-style game engine, and whatever
                        else keeps me off the grass. Most of it ends up here.
                    </p>
                    <div className="hero-actions">
                        <Link className="btn btn-primary" to="/hex-colony.html">
                            Play Hex Colony
                        </Link>
                        <Link className="btn btn-outline" to="/projects.html">
                            See projects
                        </Link>
                    </div>
                </div>
            </section>

            <section>
                <div className="wrap">
                    <div className="section-head">
                        <span className="label">Playable now</span>
                        <h2 className="display display-sm">Straight in the browser.</h2>
                    </div>
                    <div className="features">
                        {FEATURED.map((f, i) => (
                            <article className="feature-block reveal" data-reveal key={f.name}>
                                <div className="feature-copy">
                                    <span className="label">
                                        {String(i + 1).padStart(2, "0")} — {f.kicker}
                                    </span>
                                    <h3>{f.name}</h3>
                                    <p>{f.text}</p>
                                    <div className="row-links">
                                        <Link to={f.play}>Play in browser →</Link>
                                        <a href={f.source} target="_blank" rel="noopener noreferrer">
                                            Source ↗
                                        </a>
                                    </div>
                                </div>
                                <Link to={f.play} className="feature-media" tabIndex={-1} aria-hidden="true">
                                    <img src={f.image} alt={f.imageAlt} loading="lazy" />
                                </Link>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {features.length > 0 && (
                <section className="band">
                    <div className="wrap">
                        <div className="section-head section-head-split">
                            <div>
                                <span className="label">From the lab</span>
                                <h2 className="display display-sm">Small things to poke at.</h2>
                            </div>
                            <Link to="/lab.html" className="label link-arrow">
                                All experiments →
                            </Link>
                        </div>
                        <div className="lab-strip">
                            {features.slice(0, 3).map((f) => (
                                <Link key={f.slug} to={`/lab/${f.slug}`} className="lab-tile reveal" data-reveal>
                                    <span className="label">{f.tags.join(" · ")}</span>
                                    <h3>{f.name}</h3>
                                    <p>{f.blurb}</p>
                                    <span className="arrow" aria-hidden="true">→</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <section>
                <div className="wrap">
                    <div className="section-head section-head-split">
                        <div>
                            <span className="label">Everything else</span>
                            <h2 className="display display-sm">Mostly Rust, mostly from scratch.</h2>
                        </div>
                        <Link to="/projects.html" className="label link-arrow">
                            All projects →
                        </Link>
                    </div>
                    <div className="rows">
                        {rest.map((p, i) => (
                            <ProjectRow key={p.name} project={p} index={i} />
                        ))}
                    </div>
                </div>
            </section>

            <section className="closer">
                <div className="wrap">
                    <span className="label">Who's this</span>
                    <p className="closer-text">
                        Somewhat of a web designer, mostly a Rust enthusiast. I'd rather build a small engine than use a
                        big one.
                    </p>
                    <Link className="btn btn-outline" to="/about.html">
                        About me
                    </Link>
                </div>
            </section>
        </div>
    );
}
