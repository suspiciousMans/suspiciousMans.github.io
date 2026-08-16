import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import TypewriterTitle from "./TypewriterTitle.jsx";

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

    // This component mounts once for the app's whole lifetime (see the
    // file-level comment), so TypewriterTitle would only ever type its
    // intro once, on first load, and just sit there statically on every
    // later visit. Bumping a key on it each time the route becomes active
    // forces it to remount and retype, the same "fresh visit" effect the
    // other (normally-mounted) routes get for free.
    const [titleKey, setTitleKey] = useState(0);
    useEffect(() => {
        if (active) setTitleKey((k) => k + 1);
    }, [active]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const canvasWrap = canvasWrapRef.current;

        canvas.addEventListener("click", () => canvas.focus());

        // The compiled game reads MouseEvent.offsetX/offsetY straight off
        // the browser event and uses it directly as a pixel coordinate
        // into its own canvas buffer — it has no concept of
        // devicePixelRatio. offsetX/offsetY are always reported in CSS
        // pixels, so now that syncCanvasBuffer (below) renders the buffer
        // at a DPR-scaled resolution, the game would see coordinates too
        // small by exactly that factor and every click/pan/zoom would
        // land off by roughly half on a 2x display. These listeners run
        // ahead of the game's own (which only get attached once the wasm
        // module below finishes loading — same-target DOM listeners fire
        // in registration order) and rewrite offsetX/offsetY into buffer-
        // pixel space before the game ever sees the event.
        function patchOffsetToBufferSpace(e) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            Object.defineProperty(e, "offsetX", { value: (e.clientX - rect.left) * scaleX, configurable: true });
            Object.defineProperty(e, "offsetY", { value: (e.clientY - rect.top) * scaleY, configurable: true });
        }
        const patchedEventTypes = ["mousedown", "mouseup", "mousemove", "wheel", "contextmenu"];
        patchedEventTypes.forEach((type) => canvas.addEventListener(type, patchOffsetToBufferSpace));

        function syncCanvasBuffer() {
            const rect = canvas.getBoundingClientRect();
            // The backing buffer has to be sized in device pixels, not CSS
            // pixels — otherwise on any HiDPI display the game renders at
            // 1x and the browser stretches that to fill 2x+ physical
            // pixels. image-rendering: pixelated (for the crisp pixel-art
            // look) makes that stretch nearest-neighbor rather than blurry,
            // but the result is still visibly blockier than the display is
            // capable of. Capped at 3x since going higher just costs fill
            // rate for no visible gain.
            const dpr = Math.min(window.devicePixelRatio || 1, 3);
            const w = Math.max(1, Math.round(rect.width * dpr));
            const h = Math.max(1, Math.round(rect.height * dpr));
            const resized = canvas.width !== w || canvas.height !== h;
            if (canvas.width !== w) canvas.width = w;
            if (canvas.height !== h) canvas.height = h;
            // Setting canvas.width/height resets *all* 2D context state,
            // including imageSmoothingEnabled — the game sets that to
            // false once at startup for crisp pixel art, but every resize
            // after that (window resize, fullscreen toggle, and now every
            // DPR-driven resize above) silently put it back to the
            // browser's smoothing-on default. That's what was actually
            // producing the blur: sprites drawn via drawImage() got
            // bilinear-filtered on every scale up instead of staying
            // nearest-neighbor, and it only became obvious once the
            // buffer was large enough to need real upscaling.
            if (resized) {
                const ctx = canvas.getContext("2d");
                if (ctx) ctx.imageSmoothingEnabled = false;
            }
        }

        function isFullscreen() {
            return !!(document.fullscreenElement || document.webkitFullscreenElement);
        }

        function onFullscreenChange() {
            setFsLabel(isFullscreen() ? "⛶ Exit Fullscreen" : "⛶ Fullscreen");
            syncCanvasBuffer();
            canvas.focus();
            // fullscreenchange fires as soon as fullscreen mode is
            // *entered*, but on some browsers the box hasn't finished
            // settling to its final 100vw/100vh size yet at that exact
            // moment — the immediate sync above can grab a mid-transition
            // rect and lock in a buffer that's slightly too small, which
            // then sits there looking soft for the rest of the session
            // since nothing else prompts a re-check. Re-syncing across a
            // couple of animation frames catches that once layout is
            // actually final, at negligible cost (a no-op if the size
            // already matched).
            requestAnimationFrame(() => requestAnimationFrame(syncCanvasBuffer));
            // Some OS-level fullscreen transitions (e.g. macOS's animated
            // Space switch) run well past a couple of animation frames —
            // catch those too.
            setTimeout(syncCanvasBuffer, 400);
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
            patchedEventTypes.forEach((type) => canvas.removeEventListener(type, patchOffsetToBufferSpace));
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
                    <TypewriterTitle key={titleKey} segments={[{ text: "Hex " }, { text: "Colony", accent: true }]} />
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
