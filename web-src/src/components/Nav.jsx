import { useState, useEffect } from "react";
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
                <nav className={"main-nav" + (open ? " open" : "")}>
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
