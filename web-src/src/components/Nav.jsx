import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";

const LINKS = [
    { to: "/", label: "Home", end: true },
    { to: "/projects.html", label: "Projects" },
    { to: "/hex-colony.html", label: "Hex Colony" },
    { to: "/autocode.html", label: "AutoCode" },
    { to: "/gooba.html", label: "Gooba" },
    { to: "/about.html", label: "About" },
    { to: "/chat.html", label: "Chat" },
];

export default function Nav() {
    const [open, setOpen] = useState(false);
    const location = useLocation();
    const navRef = useRef(null);
    const [pillStyle, setPillStyle] = useState({ opacity: 0 });

    // Close the mobile menu automatically on navigation, matching the old
    // vanilla behavior (there, a full page load reset it for free).
    useEffect(() => {
        setOpen(false);
    }, [location.pathname]);

    // Glide a shared pill behind whichever link is active instead of just
    // popping a color change — measured in JS since the links live in a
    // wrapping flex row (desktop) that becomes a stacked column (mobile),
    // so a pure-CSS shared-position trick can't cover both layouts.
    function measurePill() {
        const nav = navRef.current;
        if (!nav) return;
        const activeEl = nav.querySelector("a.active");
        if (!activeEl) {
            setPillStyle((prev) => ({ ...prev, opacity: 0 }));
            return;
        }
        const navRect = nav.getBoundingClientRect();
        const linkRect = activeEl.getBoundingClientRect();
        setPillStyle({
            opacity: 1,
            width: linkRect.width,
            height: linkRect.height,
            transform: `translate(${linkRect.left - navRect.left}px, ${linkRect.top - navRect.top}px)`,
        });
    }

    useLayoutEffect(measurePill, [location.pathname, open]);

    useEffect(() => {
        window.addEventListener("resize", measurePill);
        return () => window.removeEventListener("resize", measurePill);
    }, []);

    return (
        <header className="site-header">
            <div className="wrap">
                <NavLink className="brand" to="/" end>
                    <svg className="brand-mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="50,3 93,26 93,74 50,97 7,74 7,26" fill="#060f11" stroke="#01c887" strokeWidth="6" />
                    </svg>
                    suspiciousMans
                </NavLink>
                <button
                    className="nav-toggle"
                    aria-label="Toggle navigation"
                    aria-expanded={open}
                    onClick={() => setOpen((v) => !v)}
                >
                    &#9776;
                </button>
                <nav ref={navRef} className={"main-nav" + (open ? " open" : "")}>
                    <span className="nav-pill" style={pillStyle} aria-hidden="true" />
                    {LINKS.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.end}
                            className={({ isActive }) => (isActive ? "active" : undefined)}
                        >
                            {link.label}
                        </NavLink>
                    ))}
                    <a href="https://github.com/suspiciousMans" target="_blank" rel="noopener noreferrer">
                        GitHub
                    </a>
                </nav>
            </div>
        </header>
    );
}
