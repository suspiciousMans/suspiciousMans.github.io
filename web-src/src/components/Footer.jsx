import { Link } from "react-router-dom";

export default function Footer() {
    return (
        <footer className="site-footer">
            <div className="wrap">
                <span>&copy; 2026 suspiciousMans</span>
                <div className="footer-links">
                    <a href="https://github.com/suspiciousMans" target="_blank" rel="noopener noreferrer">
                        GitHub
                    </a>
                    <Link to="/projects.html">Projects</Link>
                    <Link to="/about.html">About</Link>
                </div>
            </div>
        </footer>
    );
}
