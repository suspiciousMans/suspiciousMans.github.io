import { Link } from "react-router-dom";

const COLUMNS = [
    {
        title: "Play",
        links: [
            { to: "/hex-colony.html", label: "Hex Colony" },
            { to: "/autocode.html", label: "AutoCode" },
            { to: "/gooba.html", label: "Gooba" },
            { to: "/lab.html", label: "Lab" },
        ],
    },
    {
        title: "Site",
        links: [
            { to: "/", label: "Home" },
            { to: "/projects.html", label: "Projects" },
            { to: "/about.html", label: "About" },
            { href: "/oxidized/index.html", label: "Oxidized" },
        ],
    },
    {
        title: "Elsewhere",
        links: [{ href: "https://github.com/suspiciousMans", label: "GitHub ↗", external: true }],
    },
];

export default function Footer() {
    return (
        <footer className="site-footer">
            <div className="wrap">
                <div className="footer-grid">
                    {COLUMNS.map((col) => (
                        <div key={col.title} className="footer-col">
                            <span className="label">{col.title}</span>
                            {col.links.map((link) =>
                                link.to ? (
                                    <Link key={link.label} to={link.to}>
                                        {link.label}
                                    </Link>
                                ) : (
                                    <a
                                        key={link.label}
                                        href={link.href}
                                        {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                                    >
                                        {link.label}
                                    </a>
                                )
                            )}
                        </div>
                    ))}
                </div>
                <div className="footer-mark">suspiciousMans</div>
                <div className="footer-base label">
                    <span>&copy; 2026 suspiciousMans</span>
                    <span>Built with React + Vite</span>
                </div>
            </div>
        </footer>
    );
}
