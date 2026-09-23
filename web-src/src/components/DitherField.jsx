import { useEffect, useRef } from "react";
import { useThemeVersion } from "../theme.js";

// The animated pixel-dot background: slowly drifting layers of value noise,
// dithered into 3px dots of the theme's ink color. It runs
// as a tiny WebGL fragment shader on a canvas one texel per dot, scaled up
// with pixelated rendering, so it costs next to nothing per frame. It also
// drifts with the page scroll, slower than the content above it.
//
// Without WebGL the static dithered image in global.css (body::before) stays.
// With reduced motion the field is drawn once and only follows the scroll.
const DOT = 3;
const FPS = 30;

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

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

// Interleaved gradient noise as the dither threshold: fixed per dot, so the
// field doesn't shimmer, and its diagonal grain reads like the original's
// error diffusion instead of a rigid Bayer grid.
float ign(vec2 a) { return fract(52.9829189 * fract(dot(floor(a), vec2(0.06711056, 0.00583715)))); }

void main() {
    vec2 c = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y + scroll);
    // Three layers drifting in different directions, like the original
    // texture's 60 / 20 / 7 dot scales.
    float n = 0.55 * noise(c / 60.0 + vec2(t * 0.040, t * 0.024))
            + 0.30 * noise(c / 20.0 + vec2(-t * 0.090, t * 0.060) + 17.0)
            + 0.15 * noise(c / 7.0 + vec2(t * 0.160, -t * 0.120) + 41.0);
    float g = clamp((n - 0.35) * 1.4, 0.0, 1.0) * 0.4 + 0.015;
    if (g > ign(vec2(gl_FragCoord.x, c.y))) gl_FragColor = vec4(ink, 1.0);
    else gl_FragColor = vec4(0.0);
}
`;

function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
}

function inkColor() {
    const hex = getComputedStyle(document.documentElement).getPropertyValue("--fg").trim();
    const n = parseInt(hex.replace("#", ""), 16);
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return [1, 0.77, 0.24];
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export default function DitherField() {
    const canvasRef = useRef(null);
    const inkRef = useRef(null);
    const version = useThemeVersion();

    useEffect(() => {
        inkRef.current = inkColor();
        inkRef.current.dirty = true;
    }, [version]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false });
        if (!gl) return;
        const vs = compile(gl, gl.VERTEX_SHADER, VERT);
        const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) return;
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
        gl.useProgram(prog);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
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

        document.documentElement.classList.add("field-live");

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const start = performance.now();
        let raf = 0;
        let last = 0;
        let stillTime = 20;

        function resize() {
            canvas.width = Math.ceil(window.innerWidth / DOT);
            canvas.height = Math.ceil(window.innerHeight / DOT);
            gl.viewport(0, 0, canvas.width, canvas.height);
        }

        function draw(time) {
            const ink = inkRef.current || inkColor();
            gl.uniform2f(u.res, canvas.width, canvas.height);
            gl.uniform1f(u.t, time);
            // The field scrolls at a third of the page's speed.
            gl.uniform1f(u.scroll, Math.round(window.scrollY / DOT / 3));
            gl.uniform3f(u.ink, ink[0], ink[1], ink[2]);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }

        function frame(now) {
            raf = requestAnimationFrame(frame);
            if (now - last < 1000 / FPS) return;
            last = now;
            draw((now - start) / 1000 + 20);
        }

        function onScroll() {
            if (reduced) draw(stillTime);
        }

        function onVisibility() {
            cancelAnimationFrame(raf);
            if (!document.hidden && !reduced) raf = requestAnimationFrame(frame);
        }

        function onResize() {
            resize();
            draw(reduced ? stillTime : (performance.now() - start) / 1000 + 20);
        }

        resize();
        draw(stillTime);
        if (!reduced) raf = requestAnimationFrame(frame);
        window.addEventListener("resize", onResize);
        window.addEventListener("scroll", onScroll, { passive: true });
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
            window.removeEventListener("scroll", onScroll);
            document.removeEventListener("visibilitychange", onVisibility);
            document.documentElement.classList.remove("field-live");
        };
    }, []);

    return <canvas ref={canvasRef} className="dither-field" aria-hidden="true" />;
}
