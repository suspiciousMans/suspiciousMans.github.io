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
        slug: "hex-toy",
        name: "Hex Toy",
        blurb: "A field of hexes that ripple away from your cursor. Click to drop a pulse.",
        tags: ["Canvas", "Toy"],
        status: "live",
        load: () => import("@/features/hex-toy/index.jsx"),
    },
];

export default features;
