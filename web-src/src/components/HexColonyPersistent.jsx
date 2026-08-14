import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const ROUTE = "/hex-colony.html";

// Mounted once for the whole app lifetime and never unmounted — this is
// deliberate, not an oversight. The compiled game attaches its input
// listeners directly to the canvas element (safe to lose on unmount) but
// also starts a self-perpetuating requestAnimationFrame loop with no
// exported stop/destroy hook. In a traditional multi-page site a fresh
// page load wipes that state for free; in an SPA nothing ever reloads, so
// naively mounting/unmounting this per-route would start a second
// concurrent game loop — still referencing the first, by-then-detached
// canvas — on every single revisit, leaking forever. Toggling visibility
// on a permanently-mounted instance avoids that entirely, and as a bonus
// means the game state (camera, current turn) survives navigating away
// and back instead of resetting.
export default function HexColonyPersistent() {
    const location = useLocation();
    const active = location.pathname === ROUTE;

    const canvasRef = useRef(null);
    const canvasWrapRef = useRef(null);
    const fsBtnRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [status, setStatus] = useState("Loading…");
    const [fsLabel, setFsLabel] = useState("⛶ Fullscreen");
    const [fsSupported, setFsSupported] = useState(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        const canvasWrap = canvasWrapRef.current;

        canvas.addEventListener("click", () => canvas.focus());

        function syncCanvasBuffer() {
            const rect = canvas.getBoundingClientRect();
            const w = Math.max(1, Math.round(rect.width));
            const h = Math.max(1, Math.round(rect.height));
            if (canvas.width !== w) canvas.width = w;
            if (canvas.height !== h) canvas.height = h;
        }

        function isFullscreen() {
            return !!(document.fullscreenElement || document.webkitFullscreenElement);
        }

        function onFullscreenChange() {
            setFsLabel(isFullscreen() ? "⛶ Exit Fullscreen" : "⛶ Fullscreen");
            syncCanvasBuffer();
            canvas.focus();
        }

        const canRequestFullscreen = canvasWrap.requestFullscreen || canvasWrap.webkitRequestFullscreen;
        if (canRequestFullscreen) {
            document.addEventListener("fullscreenchange", onFullscreenChange);
            document.addEventListener("webkitfullscreenchange", onFullscreenChange);
        } else {
            setFsSupported(false);
        }

        let resizeObserver;
        // The Rust/wasm-bindgen build lives in public/ as a passthrough
        // static file (not part of the React module graph). A literal
        // string argument here gets statically resolved (and fails to
        // build) even with a /* @vite-ignore */ comment, so the path is
        // built at runtime instead — genuinely opaque to Rollup's analyzer.
        const hexColonyModuleUrl = ["", "assets", "game", "hex-colony.js"].join("/");
        import(/* @vite-ignore */ hexColonyModuleUrl)
            .then((mod) => mod.default())
            .then(() => {
                setLoading(false);
                setStatus("Running locally in your browser via WebAssembly.");
                syncCanvasBuffer();
                resizeObserver = new ResizeObserver(() => syncCanvasBuffer());
                resizeObserver.observe(canvasWrap);
                window.addEventListener("resize", syncCanvasBuffer);
            })
            .catch((err) => {
                console.error("Failed to start Hex Colony:", err);
                setLoading(false);
                setError(true);
                setStatus("Failed to load — try the Windows build instead.");
            });

        return () => {
            document.removeEventListener("fullscreenchange", onFullscreenChange);
            document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
            if (resizeObserver) resizeObserver.disconnect();
        };
        // Intentionally mount-once — see the file-level comment.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function toggleFullscreen() {
        const canvasWrap = canvasWrapRef.current;
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        if (isFs) {
            (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
            (canvasWrap.requestFullscreen || canvasWrap.webkitRequestFullscreen).call(canvasWrap);
        }
    }

    return (
        <div style={{ display: active ? "block" : "none" }}>
            <section className="hero" style={{ paddingBottom: "20px" }}>
                <div className="wrap">
                    <span className="eyebrow">Play in browser</span>
                    <h1>
                        Hex <span>Colony</span>
                    </h1>
                    <p className="lede">
                        A turn-based, pixel-art hex colony builder — written in Rust, compiled to WebAssembly, running
                        entirely on your machine. No install, no account.
                    </p>
                </div>
            </section>

            <section style={{ paddingTop: 0 }}>
                <div className="wrap">
                    <div className="game-shell">
                        <div className="game-canvas-wrap" ref={canvasWrapRef}>
                            <canvas ref={canvasRef} id="canvas" width="1280" height="800" tabIndex={0}></canvas>
                            <div className={"game-loading" + (loading ? "" : " hidden")}>
                                <div className="spinner"></div>
                                <span>Loading Hex Colony…</span>
                            </div>
                            <div className={"game-error" + (error ? " visible" : "")}>
                                <strong style={{ color: "#e8a7b6" }}>Couldn't load the game.</strong>
                                <p style={{ maxWidth: "420px" }}>
                                    Your browser may not support WebAssembly, or the build files failed to load. Try a
                                    recent Chrome, Firefox, or Safari, or grab the native build below.
                                </p>
                            </div>
                        </div>
                        <div className="game-toolbar">
                            <span className="status">{status}</span>
                            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                {fsSupported && (
                                    <button ref={fsBtnRef} type="button" className="btn btn-outline" onClick={toggleFullscreen}>
                                        {fsLabel}
                                    </button>
                                )}
                                <a className="btn btn-outline" href="https://github.com/suspiciousMans/Hex-Colony-Builds/raw/master/hex-colony.exe">
                                    Download Windows build
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="controls-list">
                        <div className="control">
                            <p>
                                <kbd>Click</kbd> a hex tile to place the selected building
                            </p>
                        </div>
                        <div className="control">
                            <p>
                                <kbd>1</kbd>–<kbd>9</kbd> <kbd>0</kbd> <kbd>-</kbd> or click the hotbar to select a building
                            </p>
                        </div>
                        <div className="control">
                            <p>
                                <kbd>Enter</kbd> to end your turn
                            </p>
                        </div>
                        <div className="control">
                            <p>
                                <kbd>H</kbd> in-game for the full how-to-play
                            </p>
                        </div>
                    </div>

                    <p style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "14px", marginTop: "26px" }}>
                        Source on{" "}
                        <a href="https://github.com/suspiciousMans/Hex-Colony" target="_blank" rel="noopener noreferrer">
                            GitHub
                        </a>
                    </p>
                </div>
            </section>
        </div>
    );
}
