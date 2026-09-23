import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";

// Standard chrome around a Lab feature: title bar, a full-bleed stage the
// feature renders into, and a fullscreen toggle.
export default function FeatureFrame({ feature, children }) {
    const stageRef = useRef(null);
    const [fullscreen, setFullscreen] = useState(false);

    useEffect(() => {
        const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current);
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);

    function toggleFullscreen() {
        if (document.fullscreenElement) document.exitFullscreen();
        else stageRef.current?.requestFullscreen?.();
    }

    return (
        <section className="feature">
            <div className="wrap">
                <div className="feature-bar">
                    <Link to="/lab.html" className="label">
                        ← Lab
                    </Link>
                    <span className="label">{feature.tags.join(" · ")}</span>
                </div>
                <h1 className="display display-sm">{feature.name}</h1>
                <p className="lede">{feature.blurb}</p>
                <div className="feature-stage" ref={stageRef}>
                    {children}
                </div>
                {document.fullscreenEnabled && (
                    <div className="feature-tools">
                        <button type="button" className="btn btn-outline btn-sm" onClick={toggleFullscreen}>
                            {fullscreen ? "Exit fullscreen" : "Fullscreen"}
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
