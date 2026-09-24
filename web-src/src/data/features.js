// Registry for the /lab section — small interactive experiments that live
// inside this SPA. Adding one = a new folder under src/features/<slug>/
// with a default-exported component, plus one entry here. Routing, the
// Lab index, and the Home page's "From the lab" strip all read this list;
// newest first.
//
// Fields:
//   slug    URL segment: /lab/<slug>
//   name    display name
//   blurb   one-line description
//   tags    array of strings
//   status  "live" | "wip"
//   load    () => import(...) of the feature's component (code-split)

const features = [
    {
        slug: "falling-sand",
        name: "Falling Sand",
        blurb: "Pour grains that pile up, slide down slopes and spill over the walls you draw.",
        tags: ["Pixels", "Sim", "Toy"],
        status: "live",
        load: () => import("@/features/falling-sand/index.jsx"),
    },
    {
        slug: "cloth",
        name: "Cloth",
        blurb: "A sheet of cloth pinned at the top. Grab it, fling it, yank it hard enough to tear.",
        tags: ["Physics", "Toy"],
        status: "live",
        load: () => import("@/features/cloth/index.jsx"),
    },
    {
        slug: "dither-paint",
        name: "Dither Paint",
        blurb: "Paint light that drifts up like heat, drawn in the same dithered dots as the site's art.",
        tags: ["Pixels", "Toy"],
        status: "live",
        load: () => import("@/features/dither-paint/index.jsx"),
    },
    {
        slug: "swarm",
        name: "Swarm",
        blurb: "Seven hundred specks that chase your cursor. Hold to gather them, let go to burst.",
        tags: ["Canvas", "Toy"],
        status: "live",
        load: () => import("@/features/swarm/index.jsx"),
    },
    {
        slug: "hex-toy",
        name: "Hex Toy",
        blurb: "A field of hexes that ripple away from your cursor. Click to drop a pulse.",
        tags: ["Canvas", "Toy"],
        status: "live",
        load: () => import("@/features/hex-toy/index.jsx"),
    },
];

export default features;
