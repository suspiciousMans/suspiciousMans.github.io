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

    useEffect(() => {
        if (!unlocked) inputRef.current?.focus();
    }, [unlocked]);

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
                                <div className="game-canvas-wrap" style={{ aspectRatio: "16 / 9" }}>
                                    <iframe src="/logistica/index.html" title="Logistica — logic gate simulator"></iframe>
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
