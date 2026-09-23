import SmartLink from "./SmartLink.jsx";

// One numbered row of a project list. Rows are separated by hairlines, not
// boxed as cards; the thumbnail (if any) sits in the right-hand column.
export default function ProjectRow({ project, index }) {
    const { name, image, imageAlt, tags, description, descriptionParts, links } = project;
    const primary = links[0];

    return (
        <article className="row reveal" data-reveal>
            <span className="row-num label">{String(index + 1).padStart(2, "0")}</span>
            <div className="row-main">
                <h3>
                    {primary ? (
                        <SmartLink href={primary.href} external={primary.external} className="row-title">
                            {name}
                            <span className="arrow" aria-hidden="true">→</span>
                        </SmartLink>
                    ) : (
                        name
                    )}
                </h3>
                <p>
                    {descriptionParts
                        ? descriptionParts.map((part, i) =>
                              typeof part === "string" ? <span key={i}>{part}</span> : <code key={i}>{part.code}</code>
                          )
                        : description}
                </p>
                <div className="row-meta">
                    <div className="tags">
                        {tags.map((tag) => (
                            <span key={tag} className="tag">
                                {tag}
                            </span>
                        ))}
                    </div>
                    <div className="row-links">
                        {links.map((link) => (
                            <SmartLink key={link.href} href={link.href} external={link.external}>
                                {link.label}
                                {link.external ? " ↗" : " →"}
                            </SmartLink>
                        ))}
                    </div>
                </div>
            </div>
            {image && (
                <div className="row-media">
                    <img src={`/assets/img/${image}`} alt={imageAlt} loading="lazy" />
                </div>
            )}
        </article>
    );
}
