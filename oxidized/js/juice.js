// Decorative flourishes, kept separate from lang.js (the language runtime)
// and playground.js (the editor): nothing here affects either one.
(function () {
    "use strict";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---------- syntax-highlight static code blocks ----------
    document.querySelectorAll("[data-ox]").forEach((el) => {
        el.innerHTML = window.Oxidized.highlight(el.textContent);
    });

    // ---------- nav hides on scroll down, returns on scroll up ----------
    const nav = document.querySelector(".ox-nav");
    if (nav) {
        let lastY = window.scrollY;
        window.addEventListener(
            "scroll",
            () => {
                const y = window.scrollY;
                if (Math.abs(y - lastY) < 6) return;
                nav.classList.toggle("is-hidden", y > lastY && y > 120);
                lastY = y;
            },
            { passive: true }
        );
        // An in-page link jumps down; keep the nav visible for it.
        nav.addEventListener("focusin", () => nav.classList.remove("is-hidden"));
    }

    // ---------- moving pixel-dot field ----------
    // The same field as the main site: drifting layers of value noise,
    // dithered into 3px dots of the ink color by a tiny WebGL shader, one
    // texel per dot. It drifts with the scroll at a third of the page's
    // speed. Without WebGL the plain background stays; with reduced motion
    // it's drawn once and only follows the scroll.
    const canvas = document.querySelector(".ox-field");
    const gl = canvas && canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false });
    if (!gl) return;

    const DOT = 3;
    const FPS = 30;
    const VERT = "attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }";
    const FRAG = `
precision mediump float;
uniform vec2 res;
uniform float t;
uniform float scroll;
uniform vec3 ink;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float ign(vec2 a) { return fract(52.9829189 * fract(dot(floor(a), vec2(0.06711056, 0.00583715)))); }

void main() {
    vec2 c = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y + scroll);
    float n = 0.55 * noise(c / 60.0 + vec2(t * 0.040, t * 0.024))
            + 0.30 * noise(c / 20.0 + vec2(-t * 0.090, t * 0.060) + 17.0)
            + 0.15 * noise(c / 7.0 + vec2(t * 0.160, -t * 0.120) + 41.0);
    float g = clamp((n - 0.35) * 1.4, 0.0, 1.0) * 0.4 + 0.015;
    if (g > ign(vec2(gl_FragCoord.x, c.y))) gl_FragColor = vec4(ink, 1.0);
    else gl_FragColor = vec4(0.0);
}`;

    function compile(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = {
        res: gl.getUniformLocation(prog, "res"),
        t: gl.getUniformLocation(prog, "t"),
        scroll: gl.getUniformLocation(prog, "scroll"),
        ink: gl.getUniformLocation(prog, "ink"),
    };

    const rgb = getComputedStyle(document.documentElement).getPropertyValue("--fg-rgb").split(",").map((n) => Number(n) / 255);
    const ink = rgb.length === 3 && rgb.every((n) => n >= 0 && n <= 1) ? rgb : [1, 0.42, 0.1];
    const start = performance.now();
    const still = 20;
    let raf = 0;
    let last = 0;

    function resize() {
        canvas.width = Math.ceil(window.innerWidth / DOT);
        canvas.height = Math.ceil(window.innerHeight / DOT);
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function draw(time) {
        gl.uniform2f(u.res, canvas.width, canvas.height);
        gl.uniform1f(u.t, time);
        gl.uniform1f(u.scroll, Math.round(window.scrollY / DOT / 3));
        gl.uniform3f(u.ink, ink[0], ink[1], ink[2]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    const now = () => (reducedMotion ? still : (performance.now() - start) / 1000 + still);

    function frame(ts) {
        raf = requestAnimationFrame(frame);
        if (ts - last < 1000 / FPS) return;
        last = ts;
        draw(now());
    }

    resize();
    draw(still);
    if (!reducedMotion) raf = requestAnimationFrame(frame);
    window.addEventListener("resize", () => {
        resize();
        draw(now());
    });
    window.addEventListener("scroll", () => reducedMotion && draw(still), { passive: true });
    document.addEventListener("visibilitychange", () => {
        cancelAnimationFrame(raf);
        if (!document.hidden && !reducedMotion) raf = requestAnimationFrame(frame);
    });
})();
