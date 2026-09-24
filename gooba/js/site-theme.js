// Only when Gooba is embedded on suspiciousmans.github.io (the /gooba.html
// page frames this file): take on the site's look. It copies the site's
// current theme colors in as --site-* variables, loads css/site.css (which
// maps Gooba's own variables onto them), and follows every theme change.
// Opened on its own, Gooba keeps its original look.
(function () {
    "use strict";
    let host;
    try {
        if (window.parent === window) return;
        host = window.parent.document.documentElement;
    } catch (err) {
        return; // framed by another origin
    }
    const root = document.documentElement;
    root.classList.add("on-site");

    const fonts = document.createElement("link");
    fonts.rel = "stylesheet";
    fonts.href =
        "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&family=Silkscreen&display=swap";
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "css/site.css";
    document.head.append(fonts, css);

    const TOKENS = ["bg", "bg-deep", "bg-deeper", "fg", "fg-rgb", "fg-dim", "fg-faint", "line", "line-strong", "head"];
    function sync() {
        const cs = window.parent.getComputedStyle(host);
        for (const t of TOKENS) root.style.setProperty("--site-" + t, cs.getPropertyValue("--" + t).trim());
        root.style.colorScheme = cs.colorScheme || "dark";
    }
    sync();
    new MutationObserver(sync).observe(host, { attributes: true, attributeFilter: ["data-theme", "style"] });
})();
