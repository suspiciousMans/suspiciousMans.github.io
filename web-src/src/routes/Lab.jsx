import { Link } from "react-router-dom";
import features from "../data/features.js";
import Title from "../components/Title.jsx";
import useScrollReveal from "../hooks/useScrollReveal.js";

export default function Lab() {
    const revealRef = useScrollReveal();

    return (
        <div ref={revealRef}>
            <section className="hero hero-left">
                <div className="wrap">
                    <span className="label eyebrow">Lab</span>
                    <Title segments={[{ text: "Small things to " }, { text: "poke at." , accent: true }]} />
                    <p className="lede">Interactive experiments that live right here on the site. New ones land at the top.</p>
                </div>
            </section>
            <section className="section-tight">
                <div className="wrap">
                    <div className="rows">
                        {features.map((f, i) => (
                            <article className="row reveal" data-reveal key={f.slug}>
                                <span className="row-num label">{String(i + 1).padStart(2, "0")}</span>
                                <div className="row-main">
                                    <h3>
                                        <Link to={`/lab/${f.slug}`} className="row-title">
                                            {f.name}
                                            <span className="arrow" aria-hidden="true">→</span>
                                        </Link>
                                    </h3>
                                    <p>{f.blurb}</p>
                                    <div className="row-meta">
                                        <div className="tags">
                                            {f.tags.map((t) => (
                                                <span key={t} className="tag">
                                                    {t}
                                                </span>
                                            ))}
                                            {f.status === "wip" && <span className="tag tag-accent">WIP</span>}
                                        </div>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
