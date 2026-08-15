import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A one-time, ~5s cinematic intro that plays over the real (already
// mounted, already interactive) homepage: the hex brand mark scales in at
// center, shrinks into the nav corner while the hero content builds in,
// nav links fade in and a simulated cursor glides across them (the same
// hover-pill the real nav uses), then the whole overlay crossfades away to
// reveal the real page underneath. From the "Hero Sting.dc.html" design —
// adapted from its fixed 1920x1080 mock into responsive layout reusing the
// site's actual CSS classes, and from a forever-loop into a single
// once-per-arrival intro (see HeroSting's caller in Home.jsx for why).
//
// Purely decorative: pointer-events stay off throughout, and it never
// touches the real Nav/Home underneath — it just sits on top of them and
// fades away, so there's no risk of it leaving the real page in a broken
// state if anything about the timing is slightly off.
//
// All positions the mark/cursor/pill animate to are measured off mimic
// elements laid out with the site's real CSS classes (.site-header, .wrap,
// .brand, nav.main-nav) rather than guessed as viewport percentages — the
// real nav sits inside a max-width, centered .wrap, so its actual pixel
// position depends on viewport width in a way that isn't a fixed
// percentage. Measuring guarantees the mark's "small" end state lines up
// with where the real brand mark actually is, so the closing crossfade
// hands off cleanly instead of visibly jumping.

const NAV_LINKS = ["Home", "Projects", "Hex Colony", "AutoCode", "Gooba", "About", "Chat"];
// The cursor visits every link, but in this order — not NAV_LINKS' own
// left-to-right order — so it lands on Home last. Home is where the real
// nav's pill actually is once this overlay fades away (this plays on the
// homepage), so ending there instead of wherever the last link in the row
// happens to be is what makes the pill's position continuous through the
// handoff instead of jumping the instant the real page takes over.
const VISIT_ORDER = [1, 2, 3, 4, 5, 6, 0];

const TITLE_FULL = "I Am Suspicious";
const TITLE_START = 1.45;
const TITLE_CPS = 20; // characters per second, matching the design

const CURSOR_START = 3.05;
const DWELL = 0.22;
const TRAVEL = 0.16;
const PER_LINK = DWELL + TRAVEL;
const NAV_DEMO_END = CURSOR_START + NAV_LINKS.length * PER_LINK;
const FADE_START = NAV_DEMO_END + 0.15;
const FADE_END = FADE_START + 0.45;

function lerp(a, b, f) {
    return a + (b - a) * f;
}
function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}
function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// Piecewise-eased lookup across a visit step's [arrive, leave] timing, used
// for both the cursor tip and the hover pill so they move in lockstep.
// Walks VISIT_ORDER rather than linkRects directly — see its comment.
function cursorX(t, linkRects) {
    if (!linkRects.length) return 0;
    const first = linkRects[VISIT_ORDER[0]];
    if (t <= CURSOR_START) return first.cx;
    for (let i = 0; i < VISIT_ORDER.length; i++) {
        const arrive = CURSOR_START + i * PER_LINK + TRAVEL;
        const leave = arrive + DWELL;
        const rect = linkRects[VISIT_ORDER[i]];
        if (t <= arrive) {
            const prevRect = i === 0 ? first : linkRects[VISIT_ORDER[i - 1]];
            const f = easeInOutCubic(clamp01((t - (arrive - TRAVEL)) / TRAVEL));
            return lerp(prevRect.cx, rect.cx, f);
        }
        if (t <= leave) return rect.cx;
    }
    return linkRects[VISIT_ORDER[VISIT_ORDER.length - 1]].cx;
}

export default function HeroSting({ onDone }) {
    const [t, setT] = useState(0);
    const [skip, setSkip] = useState(false);
    const [linkRects, setLinkRects] = useState([]);
    const [markTarget, setMarkTarget] = useState(null);
    const [markOrigin, setMarkOrigin] = useState(null);
    const rafRef = useRef(null);
    const startRef = useRef(null);
    const navRef = useRef(null);
    const linkRefs = useRef([]);
    const markTargetRef = useRef(null);
    const overlayRef = useRef(null);
    const doneRef = useRef(false);

    useEffect(() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        // The nav-link cursor demo only makes sense against the desktop nav
        // row (mobile collapses it behind a hamburger), matching the same
        // 720px breakpoint the real nav switches at.
        const tooNarrow = window.innerWidth <= 720;
        if (reducedMotion || tooNarrow) {
            setSkip(true);
            onDone();
            return;
        }

        function tick(ts) {
            if (startRef.current === null) startRef.current = ts;
            const elapsed = (ts - startRef.current) / 1000;
            setT(elapsed);
            if (elapsed < FADE_END) {
                rafRef.current = requestAnimationFrame(tick);
            } else if (!doneRef.current) {
                doneRef.current = true;
                onDone();
            }
        }
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Measure the mimic nav links and the brand-mark placeholder once
    // they're laid out — opacity 0 still participates in layout, so this
    // doesn't need to wait for anything to actually be visible.
    useLayoutEffect(() => {
        if (skip) return;
        const nav = navRef.current;
        const markTargetEl = markTargetRef.current;
        const overlay = overlayRef.current;
        if (!nav || !markTargetEl || !overlay) return;

        const rects = linkRefs.current.filter(Boolean).map((el) => {
            const r = el.getBoundingClientRect();
            return { left: r.left, width: r.width, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
        });
        setLinkRects(rects);

        const mr = markTargetEl.getBoundingClientRect();
        setMarkTarget({ cx: mr.left + mr.width / 2, cy: mr.top + mr.height / 2, size: mr.width });

        const overlayRect = overlay.getBoundingClientRect();
        setMarkOrigin({ cx: overlayRect.width / 2, cy: overlayRect.height * 0.4 });
    }, [skip]);

    if (skip) return null;

    const ready = markTarget && markOrigin;

    // Two independent phases share the same element: an entrance (grows in
    // from nothing at center) followed by a move-and-shrink into the nav
    // corner. Both drive the same markSize so there's no seam between
    // them — at t=0.85 the entrance phase is already at its full resting
    // size, which is exactly where the shrink phase starts interpolating
    // from.
    const bigSize = 190;
    const markEntrance = easeInOutCubic(clamp01(t / 0.85));
    const markOpacity = clamp01(t / 0.35);
    const markToSmall = clamp01((t - 0.85) / 0.5);
    const markSize = t < 0.85 ? lerp(40, bigSize, markEntrance) : lerp(bigSize, markTarget ? markTarget.size : 22, easeInOutCubic(markToSmall));
    const markCx = ready ? lerp(markOrigin.cx, markTarget.cx, easeInOutCubic(markToSmall)) : 0;
    const markCy = ready ? lerp(markOrigin.cy, markTarget.cy, easeInOutCubic(markToSmall)) : 0;
    const idlePulse = 0.5 + 0.5 * Math.sin(t * 2.1);

    const navBgOpacity = clamp01((t - 1.1) / 0.3);
    const brandTextOpacity = clamp01((t - 1.3) / 0.3);
    const navLinksOpacity = clamp01((t - 2.75) / 0.25);

    const heroOpacity = clamp01((t - 1.25) / 0.2);
    const eyebrowOpacity = clamp01((t - 1.25) / 0.2);

    const typedCount = Math.max(0, Math.min(TITLE_FULL.length, Math.floor((t - TITLE_START) * TITLE_CPS)));
    const typed = TITLE_FULL.slice(0, typedCount);
    const plainPart = typed.slice(0, Math.min(typed.length, 5));
    const accentPart = typed.slice(5);
    const typingDone = typedCount >= TITLE_FULL.length;
    const cursorBlinkOn = Math.floor(t * 3) % 2 === 0;

    const ledeOpacity = clamp01((t - 2.55) / 0.25);
    const btnOpacity = clamp01((t - 2.75) / 0.25);
    const btnScale = lerp(0.92, 1, clamp01((t - 2.75) / 0.25));

    const cx = linkRects.length ? cursorX(t, linkRects) : 0;
    const cy = linkRects.length ? linkRects[0].cy : 0;
    const visitStep = Math.min(VISIT_ORDER.length - 1, Math.max(0, Math.floor((t - CURSOR_START) / PER_LINK)));
    const pillRect = linkRects[VISIT_ORDER[visitStep]];
    const navContainerLeft = linkRects.length ? navRef.current.getBoundingClientRect().left : 0;
    const pillOpacity = t >= CURSOR_START + TRAVEL * 0.4 && t < NAV_DEMO_END ? navLinksOpacity : 0;
    const cursorOpacity = clamp01((t - CURSOR_START + 0.15) / 0.15) * (1 - clamp01((t - NAV_DEMO_END) / 0.2));

    const overlayOpacity = 1 - clamp01((t - FADE_START) / (FADE_END - FADE_START));

    // Portaled straight to <body>: .page-content (the routed-content
    // wrapper in App.jsx) carries a view-transition-name for the route
    // cross-fade, and per spec that gives it its own stacking context —
    // any z-index set on a descendant only ever competes with that
    // context's other contents, never with siblings outside it like the
    // real sticky nav. Rendering here instead escapes that entirely, so
    // z-index actually has final say over the whole page.
    return createPortal(
        <div className="hero-sting" style={{ opacity: overlayOpacity }} ref={overlayRef} aria-hidden="true">
            <div className="hero-sting-blobs">
                <div className="hero-sting-blob hero-sting-blob-1" />
                <div className="hero-sting-blob hero-sting-blob-2" />
                <div className="hero-sting-blob hero-sting-blob-3" />
            </div>

            <header className="site-header" style={{ opacity: navBgOpacity, position: "static" }}>
                <div className="wrap">
                    <div className="brand" style={{ opacity: brandTextOpacity }}>
                        <span ref={markTargetRef} style={{ width: 22, height: 22, display: "inline-block", flexShrink: 0 }} />
                        suspiciousMans
                    </div>
                    <nav className="main-nav" ref={navRef} style={{ opacity: navLinksOpacity }}>
                        {pillRect && (
                            <span
                                className="nav-pill"
                                style={{
                                    opacity: pillOpacity,
                                    width: pillRect.width,
                                    height: 36,
                                    transform: `translate(${pillRect.cx - navContainerLeft - pillRect.width / 2}px, 2px)`,
                                }}
                            />
                        )}
                        {NAV_LINKS.map((label, i) => (
                            <span
                                key={label}
                                ref={(el) => (linkRefs.current[i] = el)}
                                style={{ position: "relative", zIndex: 1, color: "var(--text-dim)", fontSize: 15, fontWeight: 500, padding: "8px 14px" }}
                            >
                                {label}
                            </span>
                        ))}
                        {/* Not part of the cursor demo (it's external, not a route), but the
                            real nav has it trailing the links — included here purely so the
                            handoff frame matches exactly, not just the pieces the cursor visits. */}
                        <span style={{ color: "var(--text-dim)", fontSize: 15, fontWeight: 500, padding: "8px 14px" }}>GitHub</span>
                    </nav>
                </div>
            </header>

            {ready && (
                <svg
                    className="hero-sting-mark"
                    viewBox="0 0 100 100"
                    style={{
                        left: markCx,
                        top: markCy,
                        width: markSize,
                        height: markSize,
                        opacity: markOpacity,
                        filter: `drop-shadow(0 0 ${18 + idlePulse * 26}px rgba(1,200,135,${0.35 + idlePulse * 0.35}))`,
                    }}
                >
                    <polygon points="50,3 93,26 93,74 50,97 7,74 7,26" fill="#060f11" stroke="#01c887" strokeWidth="6" />
                </svg>
            )}

            <section className="hero" style={{ opacity: heroOpacity }}>
                <div className="wrap">
                    <span className="eyebrow" style={{ opacity: eyebrowOpacity }}>
                        Rust · Game Dev · Web
                    </span>
                    <h1>
                        {plainPart}
                        <span style={{ color: "var(--accent)" }}>{accentPart}</span>
                        <span
                            className="typewriter-cursor"
                            style={{ opacity: typingDone ? (cursorBlinkOn ? 1 : 0) * clamp01(1 - (t - 2.2) / 1.2) : cursorBlinkOn ? 1 : 0 }}
                        />
                    </h1>
                    <p className="lede" style={{ opacity: ledeOpacity }}>
                        I build things in Rust — a hex-grid colony builder, a PS2-style game engine, and whatever else
                        keeps me off the grass.
                    </p>
                    <div className="hero-actions" style={{ opacity: btnOpacity, transform: `scale(${btnScale})` }}>
                        <span className="btn btn-primary">Play Hex Colony</span>
                        <span className="btn btn-outline">See Projects</span>
                    </div>
                </div>
            </section>

            <div className="hero-sting-cursor" style={{ opacity: cursorOpacity, transform: `translate(${cx}px, ${cy}px)` }}>
                <svg width="22" height="25" viewBox="0 0 22 25">
                    <path d="M1 1 L1 20 L6.5 15.5 L9.5 22 L13 20.5 L10 14 L17 14 Z" fill="#e9f3f1" stroke="#060f11" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
            </div>
        </div>,
        document.body
    );
}
