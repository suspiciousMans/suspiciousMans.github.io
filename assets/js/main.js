document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.querySelector("nav.main-nav");
    if (toggle && nav) {
        toggle.addEventListener("click", () => {
            const open = nav.classList.toggle("open");
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
        });
        nav.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => nav.classList.remove("open"));
        });
    }

    const path = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("nav.main-nav a").forEach((link) => {
        const href = link.getAttribute("href");
        if (href === path || (path === "" && href === "index.html")) {
            link.classList.add("active");
        }
    });
});
