// Purely decorative/interactive flourishes, kept separate from lang.js
// (the language runtime) and playground.js (the editor) — nothing here
// affects the language or the playground's correctness, so it's safe to
// gate all of it behind prefers-reduced-motion without losing function.
(function () {
    "use strict";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---------- ambient embers drifting up through the header ----------
    if (!reducedMotion) {
        const header = document.querySelector(".ox-header");
        if (header) {
            const field = document.createElement("div");
            field.className = "ember-field";
            field.setAttribute("aria-hidden", "true");
            const COUNT = 16;
            for (let i = 0; i < COUNT; i++) {
                const ember = document.createElement("span");
                ember.className = "ember";
                const size = 2 + Math.random() * 3;
                const duration = 6 + Math.random() * 7;
                const delay = Math.random() * duration;
                const drift = (Math.random() - 0.5) * 70;
                ember.style.left = Math.random() * 100 + "%";
                ember.style.width = size + "px";
                ember.style.height = size + "px";
                ember.style.animationDuration = duration + "s";
                ember.style.animationDelay = "-" + delay + "s";
                ember.style.setProperty("--drift", drift + "px");
                field.appendChild(ember);
            }
            header.prepend(field);
        }
    }

    // ---------- cursor-reactive glow over the hero ----------
    const header = document.querySelector(".ox-header");
    if (header && !reducedMotion && window.matchMedia("(hover: hover)").matches) {
        header.addEventListener("pointermove", (e) => {
            const rect = header.getBoundingClientRect();
            header.style.setProperty("--glow-x", ((e.clientX - rect.left) / rect.width) * 100 + "%");
            header.style.setProperty("--glow-y", ((e.clientY - rect.top) / rect.height) * 100 + "%");
        });
    }

    // ---------- title stagger-in: letters "rust into place" ----------
    const title = document.querySelector(".ox-title");
    if (title && !reducedMotion) {
        const text = title.textContent;
        title.setAttribute("aria-label", text);
        title.textContent = "";
        const holder = document.createElement("span");
        holder.setAttribute("aria-hidden", "true");
        Array.from(text).forEach((ch, i) => {
            const span = document.createElement("span");
            span.className = "ox-title-char" + (ch === "." ? " rust-o" : "");
            span.style.animationDelay = (i * 0.035).toFixed(3) + "s";
            span.textContent = ch;
            holder.appendChild(span);
        });
        title.appendChild(holder);
    }

    // ---------- scroll reveal ----------
    const revealEls = document.querySelectorAll(".ox-feature, .ox-ref-row, .ox-playground");
    revealEls.forEach((el) => el.classList.add("reveal"));

    if ("IntersectionObserver" in window && !reducedMotion) {
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("revealed");
                        io.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
        );
        revealEls.forEach((el) => io.observe(el));
        // Safety net: a pathologically fast jump-to-bottom (scrollbar drag,
        // "End" key) could in theory outrun the observer's callback timing.
        // Nothing should stay invisible forever over an animation detail.
        setTimeout(() => revealEls.forEach((el) => el.classList.add("revealed")), 2500);
    } else {
        revealEls.forEach((el) => el.classList.add("revealed"));
    }
})();
