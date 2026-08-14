import { useEffect } from "react";

const SITE_URL = "https://suspiciousmans.github.io";

function setMeta(selector, attr, value) {
    let el = document.head.querySelector(selector);
    if (!el) {
        el = document.createElement("meta");
        const [, attrName, attrValue] = selector.match(/\[(\w+)="([^"]+)"\]/);
        el.setAttribute(attrName, attrValue);
        document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
}

// No react-helmet dependency: there's only one static HTML shell in an SPA,
// so per-route <title>/OG/Twitter tags have to be applied imperatively on
// each route mount instead of being baked into separate HTML files.
export default function PageMeta({ title, description, path, image, noindex }) {
    useEffect(() => {
        document.title = title;
        setMeta('meta[name="description"]', "content", description);
        setMeta('meta[property="og:type"]', "content", "website");
        setMeta('meta[property="og:title"]', "content", title);
        setMeta('meta[property="og:description"]', "content", description);
        setMeta('meta[property="og:url"]', "content", SITE_URL + path);
        setMeta('meta[property="og:image"]', "content", SITE_URL + image);
        setMeta('meta[name="twitter:card"]', "content", "summary_large_image");
        setMeta('meta[name="twitter:title"]', "content", title);
        setMeta('meta[name="twitter:description"]', "content", description);
        setMeta('meta[name="twitter:image"]', "content", SITE_URL + image);

        let robots = document.head.querySelector('meta[name="robots"]');
        if (noindex) {
            if (!robots) {
                robots = document.createElement("meta");
                robots.setAttribute("name", "robots");
                document.head.appendChild(robots);
            }
            robots.setAttribute("content", "noindex");
        } else if (robots) {
            robots.remove();
        }
    }, [title, description, path, image, noindex]);

    return null;
}
