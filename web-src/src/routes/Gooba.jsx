import { useEffect, useRef, useState } from "react";

// Unlike Hex Colony, this is a normal per-route mount: it's an iframe, and
// browsers fully tear down an iframe's entire JS realm — all its listeners,
// any rAF loops — the moment the element leaves the DOM, so there's no
// leak risk in letting it mount/unmount with navigation like any other
// route.
export default function Gooba() {
    const frameRef = useRef(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const frame = frameRef.current;

        function resize() {
            try {
                const doc = frame.contentDocument;
                if (!doc || !doc.documentElement) return;
                frame.style.height = doc.documentElement.scrollHeight + "px";
            } catch (err) {
                // Same-origin, so this shouldn't throw.
            }
        }

        function attachObserver() {
            resize();
            setReady(true);
            try {
                const ro = new ResizeObserver(resize);
                ro.observe(frame.contentDocument.documentElement);
                frame.__cleanupResizeObserver = () => ro.disconnect();
            } catch (err) {
                window.addEventListener("resize", resize);
                frame.__cleanupResizeObserver = () => window.removeEventListener("resize", resize);
            }
        }

        // Browsers give a freshly-created iframe an instant "about:blank"
        // placeholder document — itself reporting readyState "complete"
        // almost immediately — before the real src finishes loading. A
        // naive readyState check matches that empty placeholder (near-zero
        // height) rather than the real page; guard against that by also
        // requiring the frame to have navigated away from about:blank.
        function realPageAlreadyLoaded() {
            try {
                return (
                    frame.contentWindow &&
                    frame.contentWindow.location.href !== "about:blank" &&
                    frame.contentDocument &&
                    frame.contentDocument.readyState === "complete"
                );
            } catch (err) {
                return false;
            }
        }

        if (realPageAlreadyLoaded()) {
            attachObserver();
        } else {
            frame.addEventListener("load", attachObserver);
        }

        return () => {
            frame.removeEventListener("load", attachObserver);
            if (frame.__cleanupResizeObserver) frame.__cleanupResizeObserver();
        };
    }, []);

    return (
        <>
            <section className="hero" style={{ paddingBottom: "20px" }}>
                <div className="wrap">
                    <span className="eyebrow">Use it in browser</span>
                    <h1>
                        Goo<span>ba</span>
                    </h1>
                    <p className="lede">
                        A retro dithering studio. Drop in a photo, GIF, or video and turn it into crunchy pixel art —
                        animated or still, with a stackable effects chain and batch export — entirely client-side.
                        Nothing you upload ever leaves your browser.
                    </p>
                </div>
            </section>

            <section style={{ paddingTop: 0 }}>
                <div className="wrap">
                    <div className="tool-shell">
                        <iframe
                            ref={frameRef}
                            className="tool-frame"
                            src="/gooba/index.html"
                            title="Gooba — retro image dithering studio"
                            style={{ opacity: ready ? 1 : 0, transition: "opacity 0.3s ease" }}
                        ></iframe>
                    </div>
                    <p style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "14px", marginTop: "26px" }}>
                        Source on{" "}
                        <a href="https://github.com/suspiciousMans/Dithering-Retroslop" target="_blank" rel="noopener noreferrer">
                            GitHub
                        </a>
                    </p>
                </div>
            </section>
        </>
    );
}
