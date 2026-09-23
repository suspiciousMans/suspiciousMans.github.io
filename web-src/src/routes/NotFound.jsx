import { Link } from "react-router-dom";
import Title from "../components/Title.jsx";

export default function NotFound() {
    return (
        <section className="hero">
            <div className="wrap">
                <span className="label eyebrow">404</span>
                <Title segments={[{ text: "Nothing " }, { text: "suspicious", accent: true }, { text: " here." }]} />
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
