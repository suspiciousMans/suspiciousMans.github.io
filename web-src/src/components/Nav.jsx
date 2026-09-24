import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import BrandMark from "./BrandMark.jsx";
import ThemeSwitch from "./ThemeSwitch.jsx";

const LINKS = [
    { to: "/projects.html", label: "Projects" },
    { to: "/lab.html", label: "Lab" },
    { to: "/hex-colony.html", label: "Hex Colony" },
    { to: "/autocode.html", label: "AutoCode" },
    { to: "/gooba.html", label: "Gooba" },
    { to: "/battle.html", label: "Battle" },
    { to: "/about.html", label: "About" },
];

// Oxidized is a fully separate static site rather than a route in this SPA,
// so it's a plain <a> (full page navigation) instead of a NavLink.
const OXIDIZED_LINK = { href: "/oxidized/index.html", label: "Oxidized" };

export default function Nav() {
    const [open, setOpen] = useState(false);
    const location = useLocation();

    useEffect(() => {
        setOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        document.documentElement.classList.toggle("nav-open", open);
    }, [open]);

    // Slide the header away while scrolling down, back as soon as the reader
    // scrolls up. Never while the mobile menu is open.
    const [hidden, setHidden] = useState(false);
    useEffect(() => {
        let last = window.scrollY;
        function onScroll() {
            const y = window.scrollY;
            if (Math.abs(y - last) < 4) return;
            setHidden(y > last && y > 80);
            last = y;
        }
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header className={"site-header" + (hidden && !open ? " is-hidden" : "")}>
            <div className="wrap">
                <NavLink className="brand" to="/" end>
                    <BrandMark />
                    suspiciousMans
                </NavLink>
                <ThemeSwitch />
                <button
                    className="nav-toggle"
                    aria-label="Toggle navigation"
                    aria-expanded={open}
                    onClick={() => setOpen((v) => !v)}
                >
                    <span />
                    <span />
                </button>
                <nav className={"main-nav" + (open ? " open" : "")}>
                    {LINKS.map((link) => (
                        <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? "active" : undefined)}>
                            {link.label}
                        </NavLink>
                    ))}
                    <a href={OXIDIZED_LINK.href}>{OXIDIZED_LINK.label}</a>
                    <a href="https://github.com/suspiciousMans" target="_blank" rel="noopener noreferrer">
                        GitHub ↗
                    </a>
                </nav>
            </div>
        </header>
    );
}
