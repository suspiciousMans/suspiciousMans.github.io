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
        slug: "sequencer",
        name: "Sequencer",
        blurb: "A sixteen-step beat maker with a tiny synth. Tap in notes and drums, pick a scale, add swing and echo.",
        tags: ["Sound", "Toy"],
        status: "live",
        load: () => import("@/features/sequencer/index.jsx"),
    },
    {
        slug: "fractal",
        name: "Fractal Explorer",
        blurb: "Dive into the Mandelbrot set, then flip to its Julia sets. Click to zoom, drag to pan, and keep going.",
        tags: ["Math", "Pixels", "In depth"],
        status: "live",
        load: () => import("@/features/fractal/index.jsx"),
    },
    {
        slug: "ripple-tank",
        name: "Ripple Tank",
        blurb: "Waves on water. Poke the surface, send light through a double slit and draw your own walls.",
        tags: ["Physics", "Pixels", "In depth"],
        status: "live",
        load: () => import("@/features/ripple-tank/index.jsx"),
    },
    {
        slug: "boids",
        name: "Flock",
        blurb: "Birds that follow three simple rules and move as one. Be the hawk that scatters them or the bait they chase.",
        tags: ["Sim", "Canvas"],
        status: "live",
        load: () => import("@/features/boids/index.jsx"),
    },
    {
        slug: "l-system",
        name: "L-Systems",
        blurb: "Short rewriting rules that grow ferns, trees and snowflake curves. Drag to bend the angle and watch them change.",
        tags: ["Math", "Canvas"],
        status: "live",
        load: () => import("@/features/l-system/index.jsx"),
    },
    {
        slug: "maze",
        name: "Maze",
        blurb: "Watch five algorithms carve a maze, then watch it get solved. Move the goal and it solves again.",
        tags: ["Algorithms", "Canvas"],
        status: "live",
        load: () => import("@/features/maze/index.jsx"),
    },
    {
        slug: "sorting",
        name: "Sorting",
        blurb: "Ten sorting algorithms racing through the same shuffled bars, one comparison at a time. With sound.",
        tags: ["Algorithms", "Canvas"],
        status: "live",
        load: () => import("@/features/sorting/index.jsx"),
    },
    {
        slug: "double-pendulum",
        name: "Double Pendulum",
        blurb: "A dozen pendulums a hair apart that swing as one and then fly into chaos. Drag to lift them.",
        tags: ["Physics", "Chaos"],
        status: "live",
        load: () => import("@/features/double-pendulum/index.jsx"),
    },
    {
        slug: "flow-field",
        name: "Flow Field",
        blurb: "Thousands of specks tracing invisible currents of Perlin noise. Push them around and change the field.",
        tags: ["Pixels", "Generative"],
        status: "live",
        load: () => import("@/features/flow-field/index.jsx"),
    },
    {
        slug: "crystal",
        name: "Crystal",
        blurb: "Random wanderers stick where they land and grow frost, coral and lightning.",
        tags: ["Pixels", "Sim"],
        status: "live",
        load: () => import("@/features/crystal/index.jsx"),
    },
    {
        slug: "metaballs",
        name: "Metaballs",
        blurb: "Lava-lamp blobs that melt together when they meet. Grab them, throw them, add more.",
        tags: ["Pixels", "Toy"],
        status: "live",
        load: () => import("@/features/metaballs/index.jsx"),
    },
    {
        slug: "field-lines",
        name: "Field Lines",
        blurb: "Drop positive and negative charges and see the electric field they make, with the voltage shaded in.",
        tags: ["Physics", "Canvas"],
        status: "live",
        load: () => import("@/features/field-lines/index.jsx"),
    },
    {
        slug: "spirograph",
        name: "Spirograph",
        blurb: "Pick the gears and watch the pen trace it out. Layer curves on top of each other.",
        tags: ["Math", "Generative"],
        status: "live",
        load: () => import("@/features/spirograph/index.jsx"),
    },
    {
        slug: "turmites",
        name: "Langton's Ant",
        blurb: "An ant with two rules that makes a mess for ten thousand steps, then builds a highway. Plus six stranger cousins.",
        tags: ["Automata", "Pixels"],
        status: "live",
        load: () => import("@/features/turmites/index.jsx"),
    },
    {
        slug: "pendulum-wave",
        name: "Pendulum Wave",
        blurb: "Pendulums of slowly changing length that fall into snakes, splits and patterns before lining up again.",
        tags: ["Physics", "Toy"],
        status: "live",
        load: () => import("@/features/pendulum-wave/index.jsx"),
    },
    {
        slug: "gravity",
        name: "Gravity",
        blurb: "An n-body sandbox. Launch planets into orbit, watch binaries dance and let bodies collide and merge.",
        tags: ["Physics", "Sim", "In depth"],
        status: "live",
        load: () => import("@/features/gravity/index.jsx"),
    },
    {
        slug: "fluid",
        name: "Fluid",
        blurb: "A real fluid solver you stir with your cursor, with dials for viscosity, swirl and how long the dye lasts.",
        tags: ["Physics", "Sim", "In depth"],
        status: "live",
        load: () => import("@/features/fluid/index.jsx"),
    },
    {
        slug: "reaction-diffusion",
        name: "Reaction Diffusion",
        blurb: "Two chemicals, two numbers. Tune feed and kill to grow coral, dividing cells, fingerprints or worms.",
        tags: ["Pixels", "Sim", "In depth"],
        status: "live",
        load: () => import("@/features/reaction-diffusion/index.jsx"),
    },
    {
        slug: "life-lab",
        name: "Life Lab",
        blurb: "Conway's Life and seven other rule sets, with gliders, guns and spaceships to stamp down and a step button.",
        tags: ["Pixels", "Automata", "In depth"],
        status: "live",
        load: () => import("@/features/life-lab/index.jsx"),
    },
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
