import { useSyncExternalStore } from "react";
import { recolorArt } from "./recolor.js";

// Color themes, switched from the nav. The active one lives on
// <html data-theme>, which global.css keys every color token off; index.html
// sets it before first paint from localStorage so there's no flash.
//
// Saffron and Ember ship pre-rendered art. "custom" is the visitor's own
// four colors: the tokens go on <html style>, and the dithered art is
// recolored in the browser (recolor.js) and swapped in via --art-* URLs.
export const THEMES = {
    saffron: { label: "Saffron", bg: "#0a0833", ink: "#ffc53d", text: "#d4c49e", head: "#ffc53d" },
    ember: { label: "Ember", bg: "#140a06", ink: "#ffb068", text: "#d9956a", head: "#d9d9de" },
};

// Starting points offered in the custom panel. Saffron and Ember switch to
// their built-in themes; the rest are custom color sets.
export const PRESETS = [
    { id: "saffron", ...THEMES.saffron },
    { id: "ember", ...THEMES.ember },
    { label: "Indigo", bg: "#0a0833", ink: "#e6e1ff", text: "#aca6d9", head: "#d9d9de" },
    { label: "Phosphor", bg: "#04130c", ink: "#a8f5c4", text: "#6fcf97", head: "#a8f5c4" },
    { label: "Onyx", bg: "#0f0f0f", ink: "#e3d3d6", text: "#bcabae", head: "#e3d3d6" },
    { label: "Riso", bg: "#efe8da", ink: "#c8320f", text: "#4d4239", head: "#c8320f" },
];

const KEY = "theme";
const CUSTOM_KEY = "theme-custom";
const VARS_KEY = "theme-vars";
const listeners = new Set();

function store(key, value) {
    try {
        if (value == null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
    } catch {
        // private mode / blocked storage: the switch still works for this visit
    }
}

function load(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function emit() {
    listeners.forEach((fn) => fn());
}

function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function getTheme() {
    const t = document.documentElement.dataset.theme;
    return THEMES[t] || t === "custom" ? t : "saffron";
}

let custom = null;

export function getCustomColors() {
    if (!custom) {
        try {
            custom = JSON.parse(load(CUSTOM_KEY));
        } catch {
            custom = null;
        }
        if (!custom || !custom.bg) {
            const { bg, ink, text, head } = PRESETS[2];
            custom = { bg, ink, text, head };
        }
    }
    return custom;
}

// ---------- color math ----------

function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
    const x = rgb(a);
    const y = rgb(b);
    return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

function luminance(hex) {
    const [r, g, b] = rgb(hex).map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

// Every token global.css reads, derived from the four chosen colors.
function tokens({ bg, ink, text, head }) {
    const inkRgb = rgb(ink).join(", ");
    const textRgb = rgb(text).join(", ");
    return {
        "--bg": bg,
        "--bg-deep": mix(bg, ink, 0.035),
        "--bg-deeper": mix(bg, ink, 0.08),
        "--fg": ink,
        "--fg-rgb": inkRgb,
        "--fg-dim": text,
        "--fg-faint": `rgba(${textRgb}, 0.6)`,
        "--line": `rgba(${inkRgb}, 0.18)`,
        "--line-strong": `rgba(${inkRgb}, 0.45)`,
        "--accent": ink,
        "--head": head,
    };
}

// ---------- applying ----------

const TOKEN_NAMES = Object.keys(tokens(THEMES.saffron));
const ART_NAMES = [];

function clearInline() {
    const style = document.documentElement.style;
    for (const name of [...TOKEN_NAMES, ...ART_NAMES]) style.removeProperty(name);
}

function sideEffects(colors) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", colors.bg);
}

// Recolored art for the custom theme: { "hero-board.png": "blob:..." }.
let art = {};
let artFor = "";
let artJob = 0;

export function artUrl(file) {
    const t = getTheme();
    if (t !== "custom") return `/assets/img/theme/${t}/${file}`;
    return art[file] || `/assets/img/theme/saffron/${file}`;
}

async function refreshArt(colors) {
    const key = colors.bg + colors.ink;
    if (key === artFor) return;
    artFor = key;
    const job = ++artJob;
    const stale = art;
    art = { ...art };
    const done = await recolorArt(
        colors.bg,
        colors.ink,
        (file, url) => {
            art[file] = url;
            applyArtVars();
            emit();
        },
        () => job !== artJob
    );
    // Free every URL this run replaced (or, if a newer run took over, the
    // ones it made that aren't on screen); never one still in use.
    const inUse = new Set(Object.values(art));
    const unused = job === artJob ? Object.values(stale) : Object.values(done);
    unused.filter((u) => !inUse.has(u)).forEach(URL.revokeObjectURL);
}

function applyArtVars() {
    if (getTheme() !== "custom") return;
    const style = document.documentElement.style;
    for (const [file, url] of Object.entries(art)) {
        const name = "--art-" + file.replace(".png", "");
        if (!ART_NAMES.includes(name)) ART_NAMES.push(name);
        style.setProperty(name, `url("${url}")`);
    }
}

export function setTheme(theme) {
    if (!THEMES[theme] && theme !== "custom") return;
    document.documentElement.dataset.theme = theme;
    store(KEY, theme);
    clearInline();
    if (theme === "custom") {
        applyCustom(getCustomColors());
    } else {
        store(VARS_KEY, null);
        sideEffects(THEMES[theme]);
    }
    emit();
}

// Live update while a color picker is dragged: tokens change immediately,
// the art is recolored once the visitor settles (`commit`).
export function setCustomColors(colors, { commit = true } = {}) {
    const { bg, ink, text, head } = { ...getCustomColors(), ...colors };
    custom = { bg, ink, text, head };
    if (commit) store(CUSTOM_KEY, JSON.stringify(custom));
    if (getTheme() !== "custom") {
        document.documentElement.dataset.theme = "custom";
        store(KEY, "custom");
    }
    applyCustom(custom, commit);
    emit();
}

function applyCustom(colors, commit = true) {
    const style = document.documentElement.style;
    const vars = tokens(colors);
    for (const [name, value] of Object.entries(vars)) style.setProperty(name, value);
    applyArtVars();
    sideEffects(colors);
    if (commit) {
        store(VARS_KEY, JSON.stringify(vars));
        refreshArt(colors);
    }
}

// Called once at startup: index.html already applied the saved tokens, this
// brings back the recolored art.
export function initTheme() {
    if (getTheme() === "custom") applyCustom(getCustomColors());
}

export function useTheme() {
    return useSyncExternalStore(subscribe, getTheme);
}

// Changes whenever colors or recolored art change, for components that
// render either.
let version = 0;
subscribe(() => version++);
export function useThemeVersion() {
    return useSyncExternalStore(subscribe, () => version);
}
