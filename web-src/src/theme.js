import { useSyncExternalStore } from "react";

// Two color themes, switched from the nav. The active one lives on
// <html data-theme>, which global.css keys every color token off; index.html
// sets it before first paint from localStorage so there's no flash.
export const THEMES = {
    saffron: { label: "Saffron", bg: "#0a0833", ink: "#ffc53d" },
    ember: { label: "Ember", bg: "#140a06", ink: "#ffb068" },
};

const KEY = "theme";
const listeners = new Set();

export function getTheme() {
    const t = document.documentElement.dataset.theme;
    return THEMES[t] ? t : "saffron";
}

export function setTheme(theme) {
    if (!THEMES[theme]) return;
    document.documentElement.dataset.theme = theme;
    try {
        localStorage.setItem(KEY, theme);
    } catch {
        // private mode / blocked storage: the switch still works for this visit
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEMES[theme].bg);
    document.querySelector("music-widget")?.setAttribute("accent", THEMES[theme].ink);
    listeners.forEach((fn) => fn());
}

function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function useTheme() {
    return useSyncExternalStore(subscribe, getTheme);
}
