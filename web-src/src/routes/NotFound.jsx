import { Link } from "react-router-dom";
import TypewriterTitle from "../components/TypewriterTitle.jsx";

export default function NotFound() {
    return (
        <section className="hero">
            <div className="wrap">
                <span className="eyebrow">404</span>
                <TypewriterTitle
                    segments={[{ text: "Nothing " }, { text: "Suspicious", accent: true }, { text: " Here" }]}
                />
                <p className="lede">
                    Whatever you were looking for isn't at this address. Maybe it moved, maybe you mistyped it, maybe
                    it never existed and you're just testing me.
                </p>
                <div className="hero-actions">
                    <Link className="btn btn-primary" to="/">
                        Back to Home
                    </Link>
                    <Link className="btn btn-outline" to="/projects.html">
                        See Projects
                    </Link>
                </div>
            </div>
        </section>
    );
}
