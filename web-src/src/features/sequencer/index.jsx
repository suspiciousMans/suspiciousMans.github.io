import { useState } from "react";
import useToy from "../useToy.js";
import { ToyPanel, ToySlider, ToySelect, ToyButtons } from "../ToyPanel.jsx";
import ToyTools from "../ToyTools.jsx";

// A sixteen-step sequencer with a tiny synth built from Web Audio: eight
// notes of a scale on top, then hi-hat, snare and kick made from noise and
// a falling sine. Notes are scheduled a little ahead on the audio clock,
// so the beat stays tight even when the screen stutters.
const STEPS = 16;
const NOTES = 8;
const DRUMS = ["hat", "snare", "kick"];
const ROWS = NOTES + DRUMS.length;
const NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

export const SCALES = {
    pentatonic: { label: "Major pentatonic", steps: [0, 2, 4, 7, 9] },
    minorpent: { label: "Minor pentatonic", steps: [0, 3, 5, 7, 10] },
    major: { label: "Major", steps: [0, 2, 4, 5, 7, 9, 11] },
    dorian: { label: "Dorian", steps: [0, 2, 3, 5, 7, 9, 10] },
    blues: { label: "Blues", steps: [0, 3, 5, 6, 7, 10] },
    whole: { label: "Whole tone", steps: [0, 2, 4, 6, 8, 10] },
};

// Row 0 is the highest note.
function noteFor(row, scale, root) {
    const k = NOTES - 1 - row;
    const s = SCALES[scale].steps;
    return root + 12 * Math.floor(k / s.length) + s[k % s.length];
}

function demo() {
    const g = Array.from({ length: ROWS }, () => new Uint8Array(STEPS));
    const tune = [
        [0, 2],
        [3, 4],
        [6, 3],
        [8, 5],
        [10, 4],
        [11, 3],
        [12, 2],
        [14, 0],
    ];
    for (const [s, n] of tune) g[NOTES - 1 - n][s] = 1;
    for (let s = 0; s < STEPS; s += 2) g[NOTES][s] = 1;
    g[NOTES + 1][4] = g[NOTES + 1][12] = 1;
    for (const s of [0, 7, 8, 10]) g[NOTES + 2][s] = 1;
    return g;
}

function create({ canvas, ctx, ink, wake }) {
    let w = 0;
    let h = 0;
    let grid = demo();
    let playing = false;
    let ac = null;
    let out = null;
    let echo = null;
    let noise = null;
    let step = 0;
    let nextAt = 0;
    let queue = []; // [step, time] scheduled but maybe not heard yet
    let shown = -1;
    let flash = new Float32Array(ROWS);
    let paint = null;
    const opts = { bpm: 108, scale: "pentatonic", root: 57, wave: "triangle", echo: 0.3, swing: 0.1 };
    let layout = null;
    let mono = "monospace";

    function audio() {
        if (ac) return ac.state === "suspended" ? ac.resume() : null;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
        const comp = ac.createDynamicsCompressor();
        comp.connect(ac.destination);
        out = ac.createGain();
        out.gain.value = 0.5;
        out.connect(comp);
        const delay = ac.createDelay(1);
        const fb = ac.createGain();
        const wet = ac.createGain();
        delay.delayTime.value = (60 / opts.bpm) * 0.75;
        fb.gain.value = 0.35;
        wet.gain.value = opts.echo;
        delay.connect(fb).connect(delay);
        delay.connect(wet).connect(out);
        echo = { delay, wet };
        noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return null;
    }

    function tone(midi, t) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        const f = ac.createBiquadFilter();
        o.type = opts.wave;
        o.frequency.value = 440 * 2 ** ((midi - 69) / 12);
        f.type = "lowpass";
        f.frequency.setValueAtTime(3000, t);
        f.frequency.exponentialRampToValueAtTime(600, t + 0.3);
        const peak = opts.wave === "sine" || opts.wave === "triangle" ? 0.35 : 0.14;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        o.connect(f).connect(g);
        g.connect(out);
        g.connect(echo.delay);
        o.start(t);
        o.stop(t + 0.5);
    }

    function hiss(t, hp, len, vol) {
        const s = ac.createBufferSource();
        s.buffer = noise;
        const f = ac.createBiquadFilter();
        f.type = "highpass";
        f.frequency.value = hp;
        const g = ac.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + len);
        s.connect(f).connect(g).connect(out);
        s.start(t, Math.random() * 0.5);
        s.stop(t + len + 0.02);
    }

    function drum(kind, t) {
        if (kind === "hat") hiss(t, 7000, 0.05, 0.25);
        else if (kind === "snare") {
            hiss(t, 1200, 0.16, 0.5);
            const o = ac.createOscillator();
            const g = ac.createGain();
            o.type = "triangle";
            o.frequency.value = 190;
            g.gain.setValueAtTime(0.4, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            o.connect(g).connect(out);
            o.start(t);
            o.stop(t + 0.1);
        } else {
            const o = ac.createOscillator();
            const g = ac.createGain();
            o.frequency.setValueAtTime(150, t);
            o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
            g.gain.setValueAtTime(1, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            o.connect(g).connect(out);
            o.start(t);
            o.stop(t + 0.4);
        }
    }

    function play(r, t) {
        if (r < NOTES) tone(noteFor(r, opts.scale, opts.root), t);
        else drum(DRUMS[r - NOTES], t);
    }

    function schedule() {
        const sixteenth = 60 / opts.bpm / 4;
        while (nextAt < ac.currentTime + 0.12) {
            // Swing pushes every other sixteenth a little late.
            const t = nextAt + (step % 2 ? opts.swing * sixteenth : 0);
            for (let r = 0; r < ROWS; r++) if (grid[r][step]) play(r, t);
            queue.push([step, t]);
            nextAt += sixteenth;
            step = (step + 1) % STEPS;
        }
    }

    function measure() {
        const labelW = w < 480 ? 30 : 44;
        const top = 52;
        const bottom = 30;
        const gap = 3;
        const cw = (w - labelW - 16) / STEPS;
        const rh = Math.min(cw * 1.2, (h - top - bottom) / (ROWS + 0.5));
        const size = Math.min(cw, rh);
        const gw = size * STEPS;
        const x0 = labelW + (w - labelW - 16 - gw) / 2 + 4;
        const y0 = top + (h - top - bottom - size * (ROWS + 0.5)) / 2;
        const rowY = (r) => y0 + r * size + (r >= NOTES ? size * 0.5 : 0);
        layout = { x0, y0, size, gap, labelW, rowY };
    }

    function cellAt(p) {
        const { x0, size, rowY } = layout;
        const s = Math.floor((p.x - x0) / size);
        if (s < 0 || s >= STEPS) return null;
        for (let r = 0; r < ROWS; r++) {
            const y = rowY(r);
            if (p.y >= y && p.y < y + size) return [r, s];
        }
        return null;
    }

    function label(r) {
        if (r >= NOTES) return DRUMS[r - NOTES];
        const m = noteFor(r, opts.scale, opts.root);
        return NAMES[m % 12] + (Math.floor(m / 12) - 1);
    }

    function draw(dt) {
        const rgb = ink();
        ctx.clearRect(0, 0, w, h);
        const { x0, size, gap, rowY } = layout;
        for (let r = 0; r < ROWS; r++) flash[r] = Math.max(0, flash[r] - dt * 4);
        if (playing && ac) {
            while (queue.length && queue[0][1] <= ac.currentTime) {
                shown = queue.shift()[0];
                for (let r = 0; r < ROWS; r++) if (grid[r][shown]) flash[r] = 1;
            }
        }
        if (shown >= 0) {
            ctx.fillStyle = `rgba(${rgb},0.1)`;
            ctx.fillRect(x0 + shown * size, rowY(0) - 4, size, rowY(ROWS - 1) + size - rowY(0) + 8);
        }
        ctx.font = `${Math.max(9, Math.min(12, size * 0.4))}px ${mono}`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "right";
        for (let r = 0; r < ROWS; r++) {
            const y = rowY(r);
            ctx.fillStyle = `rgba(${rgb},${0.45 + flash[r] * 0.55})`;
            ctx.fillText(label(r), x0 - 6, y + size / 2);
            for (let s = 0; s < STEPS; s++) {
                const x = x0 + s * size;
                const on = grid[r][s];
                const hot = on && s === shown && playing;
                if (on) {
                    ctx.fillStyle = `rgb(${rgb})`;
                    const pad = hot ? gap / 2 : gap;
                    ctx.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
                } else {
                    ctx.strokeStyle = `rgba(${rgb},${s % 4 === 0 ? 0.35 : 0.18})`;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + gap + 0.5, y + gap + 0.5, size - gap * 2 - 1, size - gap * 2 - 1);
                }
            }
        }
    }

    function stopAll() {
        playing = false;
        queue = [];
        shown = -1;
    }

    return {
        resize(nw, nh) {
            w = nw;
            h = nh;
            mono = getComputedStyle(canvas).getPropertyValue("--font-mono").trim() || mono;
            measure();
        },
        frame(t, dt) {
            if (playing && ac) schedule();
            draw(dt);
        },
        down(p) {
            const c = cellAt(p);
            if (!c) return;
            const [r, s] = c;
            const on = grid[r][s] ? 0 : 1;
            grid[r][s] = on;
            paint = { on, last: r * STEPS + s };
            // Let people hear a note as they place it.
            if (on) {
                audio();
                if (ac && out) play(r, ac.currentTime + 0.01);
                flash[r] = 1;
            }
        },
        move(p) {
            if (!paint || !p.down) return;
            const c = cellAt(p);
            if (!c) return;
            const [r, s] = c;
            if (r * STEPS + s === paint.last) return;
            paint.last = r * STEPS + s;
            grid[r][s] = paint.on;
        },
        up() {
            paint = null;
        },
        running: () => playing,
        toggle() {
            if (playing) {
                stopAll();
            } else {
                audio();
                if (!ac) return false;
                playing = true;
                step = 0;
                nextAt = ac.currentTime + 0.05;
            }
            wake();
            return playing;
        },
        set(key, v) {
            opts[key] = v;
            if (echo && key === "echo") echo.wet.gain.value = v;
            if (echo && key === "bpm") echo.delay.delayTime.value = (60 / v) * 0.75;
            wake();
        },
        clear() {
            grid = Array.from({ length: ROWS }, () => new Uint8Array(STEPS));
            wake();
        },
        demo() {
            grid = demo();
            wake();
        },
        random() {
            grid = Array.from({ length: ROWS }, () => new Uint8Array(STEPS));
            for (let s = 0; s < STEPS; s++) {
                if (Math.random() < 0.55) grid[Math.floor(Math.random() * NOTES)][s] = 1;
                if (s % 2 === 0 && Math.random() < 0.8) grid[NOTES][s] = 1;
                if (s % 8 === 4) grid[NOTES + 1][s] = 1;
                if (s % 4 === 0 || Math.random() < 0.12) grid[NOTES + 2][s] = 1;
            }
            wake();
        },
        destroy() {
            ac?.close();
        },
    };
}

export default function Sequencer() {
    const { canvasRef, toyRef } = useToy(create);
    const [s, setS] = useState({ bpm: 108, scale: "pentatonic", root: 57, wave: "triangle", echo: 0.3, swing: 0.1 });
    const [playing, setPlaying] = useState(false);
    const toy = () => toyRef.current;
    const set = (key) => (v) => {
        setS((o) => ({ ...o, [key]: v }));
        toy()?.set(key, v);
    };
    const toggle = () => setPlaying(!!toy()?.toggle());

    return (
        <>
            <canvas ref={canvasRef} className="fill-canvas" />
            <ToyPanel>
                <ToySlider label="Tempo" value={s.bpm} min={60} max={180} onChange={set("bpm")} format={(v) => v + " bpm"} />
                <ToySelect label="Scale" value={s.scale} options={Object.entries(SCALES).map(([value, x]) => ({ value, label: x.label }))} onChange={set("scale")} />
                <ToySelect
                    label="Key"
                    value={String(s.root)}
                    options={[48, 50, 52, 53, 55, 57, 59].map((m) => ({ value: String(m), label: NAMES[m % 12] }))}
                    onChange={(v) => set("root")(Number(v))}
                />
                <ToySelect
                    label="Sound"
                    value={s.wave}
                    options={[
                        { value: "triangle", label: "Soft (triangle)" },
                        { value: "sine", label: "Pure (sine)" },
                        { value: "square", label: "Chip (square)" },
                        { value: "sawtooth", label: "Buzzy (saw)" },
                    ]}
                    onChange={set("wave")}
                />
                <ToySlider label="Echo" value={s.echo} min={0} max={0.8} step={0.05} onChange={set("echo")} format={(v) => (v ? Math.round(v * 100) + "%" : "off")} />
                <ToySlider label="Swing" value={s.swing} min={0} max={0.5} step={0.05} onChange={set("swing")} format={(v) => Math.round(v * 100) + "%"} />
                <ToyButtons items={[{ id: "demo", label: "Demo tune", onClick: () => toy()?.demo() }]} />
            </ToyPanel>
            <ToyTools
                tools={[
                    { id: "play", label: playing ? "Stop" : "Play", active: playing, onClick: toggle },
                    { id: "random", label: "Random", onClick: () => toy()?.random() },
                    { id: "clear", label: "Clear", onClick: () => toy()?.clear() },
                ]}
                hint="Tap squares to add notes · drag to paint · sound on"
            />
        </>
    );
}
