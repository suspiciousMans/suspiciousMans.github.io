import { Link } from "react-router-dom";
import TypewriterTitle from "../components/TypewriterTitle.jsx";
import useScrollReveal from "../hooks/useScrollReveal.js";

export default function About() {
    const revealRef = useScrollReveal();

    return (
        <section style={{ paddingTop: "72px" }} ref={revealRef}>
            <div className="wrap">
                <div className="prose">
                    <span className="eyebrow">About</span>
                    <TypewriterTitle segments={[{ text: "I'm a very suspicious person." }]} />
                    <p className="reveal" data-reveal>
                        As you may know. I enjoy a lot of suspicious things — touching grass (occasionally), Assembly, and
                        Rust. I dream in JavaScript and exist in binary. Send help.
                    </p>
                    <p className="reveal" data-reveal style={{ transitionDelay: "80ms" }}>
                        I'm somewhat of a web designer, but mostly I like building things from the ground up: game
                        engines, hex-grid colony builders, and whatever project currently has my attention. Most of it
                        ends up written in Rust, because I enjoy fighting the borrow checker more than is probably
                        healthy.
                    </p>
                    <p className="reveal" data-reveal style={{ transitionDelay: "160ms" }}>
                        Right now most of my time goes into <Link to="/hex-colony.html">Hex Colony</Link>, a turn-based
                        pixel-art colony builder, and the little engine underneath it. Everything I ship publicly is
                        linked from the <Link to="/projects.html">projects page</Link>.
                    </p>
                    <p className="reveal" data-reveal style={{ transitionDelay: "240ms" }}>
                        Best way to find me is on{" "}
                        <a href="https://github.com/suspiciousMans" target="_blank" rel="noopener noreferrer">
                            GitHub
                        </a>
                        .
                    </p>
                </div>
            </div>
        </section>
    );
}
