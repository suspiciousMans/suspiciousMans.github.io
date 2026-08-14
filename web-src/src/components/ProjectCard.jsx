import { Link } from "react-router-dom";
import { handleCardMouseMove } from "../utils/cardSpotlight.js";

function isInternal(href) {
    return href.startsWith("/");
}

export default function ProjectCard({ project }) {
    const { name, image, imageAlt, tags, description, descriptionParts, links } = project;

    return (
        <div className="card" onMouseMove={handleCardMouseMove}>
            {image && (
                <div className="card-media">
                    <img src={`/assets/img/${image}`} alt={imageAlt} loading="lazy" />
                </div>
            )}
            <h3>{name}</h3>
            <div className="tags">
                {tags.map((tag, i) => (
                    <span key={tag} className={"tag" + (i === 0 ? " tag-accent" : "")}>
                        {tag}
                    </span>
                ))}
            </div>
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
        </div>
    );
}
