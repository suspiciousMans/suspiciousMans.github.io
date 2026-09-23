// Dithered, pre-rendered 3D shapes (24-frame sprite strips in
// /assets/img/theme/<theme>/sp-*.png) floating over the home page. The big
// ones hang off the sides and slide out as they scroll through view; the
// small ones drift with the page scroll. All motion is CSS (global.css,
// "shapes"), so this is static markup and costs nothing per frame in JS.
//
// Positions come from a 1440 x 4500 desktop layout: `top` is a share of the
// page height, `off` is how far past the edge a big shape hangs (scaled down
// with the shape on small screens), `x` places the small ones across the page.
// Small ones in the middle of the page (`mid`) sit out on phones, where they
// would land on top of the text.
const BIG = [
    { shape: "hex", side: "l", off: -360, top: 18, fl: "", sp: "sp-slow" },
    { shape: "torus", side: "r", off: -320, top: 39.5, fl: "fl-2", sp: "" },
    { shape: "ico", side: "l", off: -290, top: 54.5, fl: "fl-3", sp: "sp-rev" },
    { shape: "octa", side: "r", off: -240, top: 63.5, fl: "", sp: "" },
    { shape: "cube", side: "l", off: -130, top: 77.8, fl: "fl-2", sp: "sp-rev" },
    { shape: "hex", side: "r", off: -370, top: 87.8, fl: "fl-3", sp: "sp-rev sp-slow" },
];

const SMALL = [
    { shape: "cube", x: 44, mid: true, top: 0.9, drift: "sc-lead", fl: "fl-3", sp: "" },
    { shape: "octa", x: 6, top: 29.3, drift: "sc-lag", fl: "fl-2", sp: "sp-rev" },
    { shape: "ico", x: 90, top: 26.2, drift: "sc-swing", fl: "", sp: "sp-slow" },
    { shape: "cube", x: 47, mid: true, top: 48.9, drift: "sc-lag", fl: "fl-3", sp: "sp-rev" },
    { shape: "torus", x: 3, top: 67.8, drift: "sc-lead", fl: "fl-2", sp: "" },
    { shape: "octa", x: 92, top: 77.3, drift: "sc-swing", fl: "fl-3", sp: "" },
    { shape: "ico", x: 39, mid: true, top: 92.9, drift: "sc-lag", fl: "", sp: "sp-rev" },
];

export default function Shapes() {
    return (
        <div className="shapes" aria-hidden="true">
            {BIG.map((s, i) => (
                <div
                    key={"b" + i}
                    className={"shape-big in-" + s.side}
                    style={{ top: s.top + "%", [s.side === "l" ? "left" : "right"]: `calc(${s.off}px * var(--k))` }}
                >
                    <div className={"fl " + s.fl}>
                        <div className={`sp sp-${s.shape} ${s.sp}`} />
                    </div>
                </div>
            ))}
            {SMALL.map((s, i) => (
                <div key={"s" + i} className={"shape-small " + s.drift + (s.mid ? " shape-mid" : "")} style={{ top: s.top + "%", left: s.x + "%" }}>
                    <div className={"fl " + s.fl}>
                        <div className={`sp sp-${s.shape} ${s.sp}`} />
                    </div>
                </div>
            ))}
        </div>
    );
}
