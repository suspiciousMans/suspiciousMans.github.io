import { Link } from "react-router-dom";
import SmartLink from "../components/SmartLink.jsx";
import Shapes from "../components/Shapes.jsx";
import projects from "../data/projects.js";
import features from "../data/features.js";
import { useTheme } from "../theme.js";

const FEATURED = [
    {
        name: "Hex Colony",
        kicker: "Rust · WebAssembly",
        image: "hex-colony-preview-dither.png",
        imageAlt: "Hex Colony title screen, dithered",
        text: "A turn-based, pixel-art hex colony builder. Place buildings, manage resources, race to a score target — compiled to WebAssembly and running entirely in your browser.",
        play: "/hex-colony.html",
        source: "https://github.com/suspiciousMans/Hex-Colony",
    },
    {
        name: "AutoCode",
        kicker: "JavaScript · Python",
        image: "autocode-preview-dither.png",
        imageAlt: "AutoCode script editor and farm plot, dithered",
        text: "Write real scripts to automate a farm, a spaceship, a store, and a factory. Describe what should happen, then watch it run — once, or every tick, forever.",
        play: "/autocode.html",
        source: "https://github.com/suspiciousMans/AutoCode",
    },
];

const FEATURED_NAMES = new Set(FEATURED.map((f) => f.name));

// Dithered art that exists for a Lab feature, keyed by slug.
const LAB_ART = { "hex-toy": "hex-toy.png" };

function describe(p) {
    return p.descriptionParts
        ? p.descriptionParts.map((part, i) =>
              typeof part === "string" ? <span key={i}>{part}</span> : <code key={i}>{part.code}</code>
          )
        : p.description;
}

export default function Home() {
    const theme = useTheme();
    const img = (file) => `/assets/img/theme/${theme}/${file}`;
    const rest = projects.filter((p) => !FEATURED_NAMES.has(p.name));
    const lab = features[0];

    return (
        <div className="home">
            <Shapes />

            <section className="hero hero-split">
                <div className="wrap">
                    <div className="hero-copy">
                        <span className="label eyebrow">#0 · Rust · Game Dev · Web</span>
                        <h1 className="display">
                            I am
                            <br />
                            suspicious.
                        </h1>
                        <p className="lede">
                            I build things from scratch — a hex-grid colony builder, a PS2-style game engine, and whatever
                            else keeps me off the grass. Most of it ends up here.
                        </p>
                        <div className="hero-actions">
                            <Link className="btn btn-primary" to="/hex-colony.html">
                                Play Hex Colony <span aria-hidden="true">→</span>
                            </Link>
                            <Link className="btn btn-outline" to="/projects.html">
                                See projects
                            </Link>
                        </div>
                    </div>
                    <div className="hero-board rv-wipe">
                        <picture>
                            <source media="(max-width: 760px)" srcSet={img("hero-board-m.png")} />
                            <img
                                src={img("hero-board.png")}
                                alt="Dithered render of a hexagonal column rising from a field of smaller hexes"
                                width="600"
                                height="720"
                            />
                        </picture>
                        <div className="pixel-window">
                            <div className="pixel-window-bar">
                                <span>hex-colony.wasm</span>
                                <span aria-hidden="true">x</span>
                            </div>
                            <div className="pixel-window-body">
                                <span>Start a new colony?</span>
                                <div className="pixel-window-actions">
                                    <Link to="/hex-colony.html" className="pixel-btn pixel-btn-primary">
                                        OK
                                    </Link>
                                    <Link to="/projects.html" className="pixel-btn">
                                        Cancel
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="solid play">
                <div className="wrap">
                    <h2 className="display display-md rv-rise">Straight in the browser.</h2>
                    <div className="play-grid">
                        {FEATURED.map((f, i) => (
                            <article className="play-item" key={f.name}>
                                <div className="play-copy rv-rise">
                                    <span className="label">
                                        #{i + 1} · {f.kicker}
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
                                <Link to={f.play} className="play-media rv-wipe" tabIndex={-1} aria-hidden="true">
                                    <img src={img(f.image)} alt={f.imageAlt} loading="lazy" width="1120" height="632" />
                                </Link>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {lab && (
                <section className="lab-band">
                    <div className="wrap">
                        <Link to={`/lab/${lab.slug}`} className={"lab-card" + (LAB_ART[lab.slug] ? "" : " lab-card-plain")}>
                            <div className="lab-card-copy rv-rise">
                                <span className="label">#3 · From the lab · {lab.tags.join(" · ")}</span>
                                <div>
                                    <h2 className="display display-md">{lab.name}</h2>
                                    <p>{lab.blurb}</p>
                                </div>
                                <span className="label lab-card-cta">Open experiment →</span>
                            </div>
                            {LAB_ART[lab.slug] && (
                                <img
                                    className="rv-wipe"
                                    src={img(LAB_ART[lab.slug])}
                                    alt=""
                                    loading="lazy"
                                    width="1284"
                                    height="720"
                                />
                            )}
                        </Link>
                        {features.length > 1 && (
                            <Link to="/lab.html" className="label link-arrow lab-more">
                                All experiments →
                            </Link>
                        )}
                    </div>
                </section>
            )}

            <section className="solid">
                <div className="wrap">
                    <div className="section-head section-head-split">
                        <h2 className="display display-md rv-rise">
                            Mostly Rust,
                            <br />
                            mostly from scratch.
                        </h2>
                        <Link to="/projects.html" className="label link-arrow">
                            All projects →
                        </Link>
                    </div>
                    <div className="home-rows">
                        {rest.map((p, i) => {
                            const primary = p.links[0];
                            return (
                                <SmartLink
                                    key={p.name}
                                    href={primary.href}
                                    external={primary.external}
                                    className="home-row rv-rise"
                                >
                                    <span className="label home-row-num">#{String(i + 1).padStart(2, "0")}</span>
                                    <span className="home-row-name">{p.name}</span>
                                    <span className="home-row-main">
                                        <span className="home-row-desc">{describe(p)}</span>
                                        <span className="tags">
                                            {p.tags.map((t) => (
                                                <span key={t} className="tag">
                                                    {t}
                                                </span>
                                            ))}
                                        </span>
                                    </span>
                                    <span className="home-row-arrow" aria-hidden="true">
                                        {primary.external ? "↗" : "→"}
                                    </span>
                                </SmartLink>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="closer">
                <div className="wrap">
                    <div className="closer-box">
                        <span className="label">#4 · Who's this</span>
                        <p className="closer-text rv-rise">
                            Somewhat of a web designer, mostly a Rust enthusiast. I'd rather build a small engine than use
                            a big one.
                        </p>
                        <div className="hero-actions">
                            <Link className="btn btn-primary" to="/about.html">
                                About me <span aria-hidden="true">→</span>
                            </Link>
                            <a
                                className="btn btn-outline"
                                href="https://github.com/suspiciousMans"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                GitHub ↗
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
