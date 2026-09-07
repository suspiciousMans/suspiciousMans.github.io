import { useState, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

const LINKS = [
    { to: "/", label: "Home", end: true },
    { to: "/projects.html", label: "Projects" },
    { to: "/hex-colony.html", label: "Hex Colony" },
    { to: "/autocode.html", label: "AutoCode" },
    { to: "/gooba.html", label: "Gooba" },
    { to: "/about.html", label: "About" },
];

export default function Nav() {
    const [open, setOpen] = useState(false);
    const location = useLocation();
    const navRef = useRef(null);

    // Close the mobile menu automatically on navigation, matching the old
    // vanilla behavior (there, a full page load reset it for free).
    useEffect(() => {
        setOpen(false);
    }, [location.pathname]);

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
                {/* Height/opacity are only ever meaningful on mobile — a
                    matching !important rule in global.css forces both back
                    to auto/1 above the mobile breakpoint, so this never
                    hides the desktop nav regardless of `open`. */}
                <motion.nav
                    ref={navRef}
                    className={"main-nav" + (open ? " open" : "")}
                    initial={false}
                    animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                >
                    {LINKS.map((link) => (
                        <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => (isActive ? "active" : undefined)}>
                            {({ isActive }) => (
                                <>
                                    {/* Shared layoutId — Framer Motion animates this element
                                        from its previous active link to this one automatically,
                                        replacing the old manual getBoundingClientRect measuring. */}
                                    {isActive && (
                                        <motion.span
                                            className="nav-pill"
                                            layoutId="nav-pill"
                                            aria-hidden="true"
                                            transition={{ type: "spring", stiffness: 500, damping: 40 }}
                                        />
                                    )}
                                    {link.label}
                                </>
                            )}
                        </NavLink>
                    ))}
                    <a href="https://github.com/suspiciousMans" target="_blank" rel="noopener noreferrer">
                        GitHub
                    </a>
                </motion.nav>
            </div>
        </header>
    );
}
