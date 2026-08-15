import { useEffect, useRef, useState } from "react";
import TypewriterTitle from "../components/TypewriterTitle.jsx";

// SHA-256 hex digest of the access password, same approach as the hidden
// Task Manager gate (tasks-97b57abb/index.html) — the password itself is
// never stored client-side, only this digest. Worth being upfront that
// this is a speed bump, not real security: the digest and the app behind
// it both ship in the same public bundle, so anyone willing to read the
// source (or just brute-force a 4-digit PIN offline) gets through. It's
// here because it was asked for, not as an access-control guarantee.
const PASSWORD_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";
const SESSION_KEY = "logistica_gate_ok";

async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export default function Logistica() {
    const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [shake, setShake] = useState(false);
    const inputRef = useRef(null);
    const canvasWrapRef = useRef(null);
    const frameRef = useRef(null);
    const [fsLabel, setFsLabel] = useState("⛶ Fullscreen");
    const [fsSupported, setFsSupported] = useState(true);

    useEffect(() => {
        if (!unlocked) inputRef.current?.focus();
    }, [unlocked]);

    // Only set up once the iframe/canvas-wrap actually exists post-unlock —
    // same fullscreen pattern as Hex Colony's game-canvas-wrap, minus the
    // canvas buffer sync (the iframe's own content resizes itself via CSS
    // 100%/100% plus eframe's internal ResizeObserver, so there's nothing
    // extra to drive from the host page).
    useEffect(() => {
        const canvasWrap = canvasWrapRef.current;
        if (!canvasWrap) return;

        function isFullscreen() {
            return !!(document.fullscreenElement || document.webkitFullscreenElement);
        }

        function onFullscreenChange() {
            setFsLabel(isFullscreen() ? "⛶ Exit Fullscreen" : "⛶ Fullscreen");
            if (isFullscreen()) frameRef.current?.contentWindow?.focus();
        }

        // The browser already exits fullscreen on Escape natively — except
        // entering fullscreen here also moves keyboard focus into the
        // iframe (a separate, same-origin document), and the app itself
        // binds Escape to "deselect the current tool". Depending on how it
        // handles that keydown, it can end up swallowing the press before
        // it's treated as the global fullscreen-exit shortcut. Explicit,
        // capture-phase listeners on both the outer page and the iframe's
        // own document make the exit deterministic either way.
        function onKeyDown(e) {
            if (e.key === "Escape" && isFullscreen()) {
                (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
            }
        }

        const canRequestFullscreen = canvasWrap.requestFullscreen || canvasWrap.webkitRequestFullscreen;
        if (canRequestFullscreen) {
            document.addEventListener("fullscreenchange", onFullscreenChange);
            document.addEventListener("webkitfullscreenchange", onFullscreenChange);
            document.addEventListener("keydown", onKeyDown, true);
        } else {
            setFsSupported(false);
        }

        const frame = frameRef.current;
        let frameDoc = null;
        function attachFrameKeyDown() {
            try {
                frameDoc = frame.contentDocument;
                frameDoc?.addEventListener("keydown", onKeyDown, true);
            } catch (err) {
                // Shouldn't happen (same-origin), but don't break the page over it.
            }
        }
        frame?.addEventListener("load", attachFrameKeyDown);
        attachFrameKeyDown(); // in case the iframe already finished loading

        return () => {
            document.removeEventListener("fullscreenchange", onFullscreenChange);
            document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
            document.removeEventListener("keydown", onKeyDown, true);
            frame?.removeEventListener("load", attachFrameKeyDown);
            frameDoc?.removeEventListener("keydown", onKeyDown, true);
        };
    }, [unlocked]);

    function toggleFullscreen() {
        const canvasWrap = canvasWrapRef.current;
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        if (isFs) {
            (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
            (canvasWrap.requestFullscreen || canvasWrap.webkitRequestFullscreen).call(canvasWrap);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const hash = await sha256Hex(password);
        if (hash === PASSWORD_HASH) {
            sessionStorage.setItem(SESSION_KEY, "1");
            setUnlocked(true);
        } else {
            setError("Incorrect password.");
            setPassword("");
            setShake(true);
            setTimeout(() => setShake(false), 400);
            inputRef.current?.focus();
        }
    }

    return (
        <>
            <section className="hero" style={{ paddingBottom: "20px" }}>
                <div className="wrap">
                    <span className="eyebrow">Members only</span>
                    <TypewriterTitle segments={[{ text: "Logi" }, { text: "stica", accent: true }]} />
                    <p className="lede">
                        A gate-level logic simulator for building microprocessors out of logic gates — click-and-place
                        gates and wires on a canvas, backed by a fast headless simulation engine, running entirely in
                        your browser via WebAssembly.
                    </p>
                </div>
            </section>

            <section style={{ paddingTop: 0 }}>
                <div className="wrap">
                    {!unlocked ? (
                        <div className={"gate-card" + (shake ? " gate-shake" : "")}>
                            <h2>Enter password</h2>
                            <form onSubmit={handleSubmit} autoComplete="off">
                                <input
                                    ref={inputRef}
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoFocus
                                />
                                <button type="submit" className="btn btn-primary">
                                    Unlock
                                </button>
                                {error && <p className="gate-error">{error}</p>}
                            </form>
                        </div>
                    ) : (
                        <>
                            <div className="game-shell">
                                <div className="game-canvas-wrap" style={{ aspectRatio: "16 / 9" }} ref={canvasWrapRef}>
                                    <iframe ref={frameRef} src="/logistica/index.html" title="Logistica — logic gate simulator"></iframe>
                                </div>
                                <div className="game-toolbar">
                                    <span className="status">Running locally in your browser via WebAssembly.</span>
                                    {fsSupported && (
                                        <button type="button" className="btn btn-outline" onClick={toggleFullscreen}>
                                            {fsLabel}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "14px", marginTop: "26px" }}>
                                Source on{" "}
                                <a href="https://github.com/suspiciousMans/Logistica-" target="_blank" rel="noopener noreferrer">
                                    GitHub
                                </a>
                            </p>
                        </>
                    )}
                </div>
            </section>
        </>
    );
}
