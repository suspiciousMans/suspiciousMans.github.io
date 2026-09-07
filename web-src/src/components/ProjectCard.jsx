import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { handleCardPointerMove, handleCardPointerLeave } from "../utils/cardSpotlight.js";

function isInternal(href) {
    return href.startsWith("/");
}

// Replaces the old `.card:hover .tag:nth-child(n) { transition-delay: … }`
// CSS hack (hardcoded to 4 children) with a real, N-agnostic stagger:
// hovering the card sets its variant to "hover", which propagates down to
// every child sharing these variant keys with no per-tag wiring needed.
const tagsHoverVariants = {
    rest: { transition: { staggerChildren: 0 } },
    hover: { transition: { staggerChildren: 0.04 } },
};
const tagHoverVariants = {
    rest: { y: 0 },
    hover: { y: -3 },
};

// revealMode "reveal" (default) wraps the card in the IntersectionObserver-
// driven one-shot reveal (see useScrollReveal.js) — used wherever a page
// just wants a simple fade/rise-in. revealMode "none" skips that wrapper
// entirely so a parent can drive the card's entrance itself instead (e.g.
// Projects.jsx's GSAP scroll-scrubbed stagger) without the two competing.
export default function ProjectCard({ project, revealMode = "reveal" }) {
    const { name, image, imageAlt, tags, description, descriptionParts, links } = project;

    const card = (
        <motion.div
            className="card"
            initial="rest"
            animate="rest"
            whileHover="hover"
            onPointerMove={handleCardPointerMove}
            onPointerLeave={handleCardPointerLeave}
        >
            {image && (
                <div className="card-media" data-shimmer>
                    <img src={`/assets/img/${image}`} alt={imageAlt} loading="lazy" />
                </div>
            )}
            <h3>{name}</h3>
            <motion.div className="tags" variants={tagsHoverVariants}>
                {tags.map((tag, i) => (
                    <motion.span key={tag} className={"tag" + (i === 0 ? " tag-accent" : "")} variants={tagHoverVariants}>
                        {tag}
                    </motion.span>
                ))}
            </motion.div>
            <p>
                {descriptionParts
                    ? descriptionParts.map((part, i) =>
                          typeof part === "string" ? <span key={i}>{part}</span> : <code key={i}>{part.code}</code>
                      )
                    : description}
            </p>
            <div className="card-links">
                {links.map((link) =>
                    isInternal(link.href) ? (
                        <Link key={link.href} to={link.href}>
                            {link.label}
                        </Link>
                    ) : (
                        <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                            {link.label}
                        </a>
                    )
                )}
            </div>
        </motion.div>
    );

    if (revealMode === "none") return card;
    return (
        <div className="reveal" data-reveal>
            {card}
        </div>
    );
}
