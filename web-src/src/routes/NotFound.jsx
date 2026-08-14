import { Link } from "react-router-dom";

export default function NotFound() {
    return (
        <section className="hero">
            <div className="wrap">
                <span className="eyebrow">404</span>
                <h1>
                    Nothing <span>Suspicious</span> Here
                </h1>
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
