// Single source of truth for the projects grid. The automated daily
// "new projects" Routine edits THIS file (adding a new object to the
// array) rather than raw HTML — see the Routine's prompt for the exact
// shape it's expected to produce.
//
// Fields:
//   name        card title
//   image       optional card screenshot, relative to /assets/img/
//   imageAlt    required if image is set
//   tags        array of strings; first tag gets the accent color
//   description card body text (JSX-safe: plain string, or an array of
//               strings/elements if inline formatting like <code> is needed)
//   links       array of { label, href, external? }

const projects = [
    {
        name: "Hex Colony",
        image: "hex-colony-preview.png",
        imageAlt: "Hex Colony gameplay screenshot",
        tags: ["Rust", "WebAssembly", "SDL2"],
        description:
            "A turn-based, pixel-art hex colony builder. Place buildings on a hex grid, manage resources, and race to a score target. Runs natively via SDL2 or in the browser via WebAssembly.",
        links: [
            { label: "Play in browser", href: "/hex-colony.html" },
            { label: "Source", href: "https://github.com/suspiciousMans/Hex-Colony", external: true },
        ],
    },
    {
        name: "AutoCode",
        image: "autocode-preview.png",
        imageAlt: "AutoCode gameplay screenshot showing a script editor and a growing wheat plot",
        tags: ["TypeScript", "JavaScript", "Python"],
        description:
            "A browser automation-coding game. Write scripts that plant crops, pilot a mining ship, run a shop, and manage a factory line — once, or every tick, forever.",
        links: [
            { label: "Play in browser", href: "/autocode.html" },
            { label: "Source", href: "https://github.com/suspiciousMans/AutoCode", external: true },
        ],
    },
    {
        name: "jame-engine",
        tags: ["Rust", "Engine"],
        description: "A lightweight, PS2-style game engine written in Rust. The foundation for Hex Colony's rendering and platform layer.",
        links: [{ label: "Source", href: "https://github.com/suspiciousMans/jame-engine", external: true }],
    },
    {
        name: "Music Player",
        tags: ["TypeScript", "Electron", "Web Component"],
        descriptionParts: [
            "A shared playback engine with two front ends: an Electron + React desktop app for your own library, and a dependency-free ",
            { code: "<music-widget>" },
            " embed for any website — you're hearing it right now, floating in the corner of this page.",
        ],
        links: [{ label: "Source", href: "https://github.com/suspiciousMans/Music-Player", external: true }],
    },
    {
        name: "Task Manager",
        tags: ["JavaScript", "Electron"],
        description:
            "A framework-free task manager with a list view and a month calendar view. Tasks support notes, due date/time, priority, and category, and persist to localStorage — runs in the browser or as an Electron desktop app.",
        links: [{ label: "Source", href: "https://github.com/suspiciousMans/Task-Manager", external: true }],
    },
    {
        name: "Gooba",
        tags: ["JavaScript", "Canvas"],
        description:
            "A retro dithering studio. Drop in a photo, GIF, or video and turn it into crunchy pixel art, animated or still, with a stackable effects chain (scanlines, glow, glitch, and more) and batch export — all client-side.",
        links: [
            { label: "Use it", href: "/gooba.html" },
            { label: "Source", href: "https://github.com/suspiciousMans/Dithering-Retroslop", external: true },
        ],
    },
    {
        name: "This site",
        tags: ["React", "Vite"],
        description:
            "A single-page React app, hosted on GitHub Pages. Same color palette since the beginning — now with seamless navigation and a music player that doesn't restart every time you click a link.",
        links: [{ label: "Source", href: "https://github.com/suspiciousMans/suspiciousMans.github.io", external: true }],
    },
];

export default projects;
