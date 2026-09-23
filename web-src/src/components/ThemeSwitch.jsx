import { useEffect, useRef, useState } from "react";
import {
    THEMES,
    PRESETS,
    contrast,
    getCustomColors,
    setCustomColors,
    setTheme,
    useTheme,
    useThemeVersion,
} from "../theme.js";

const FIELDS = [
    { key: "bg", label: "Background" },
    { key: "ink", label: "Accent" },
    { key: "text", label: "Body text" },
    { key: "head", label: "Headings" },
];

// Saffron / Ember swatches plus a Custom button that opens a small panel of
// color pickers and presets.
export default function ThemeSwitch() {
    const theme = useTheme();
    useThemeVersion();
    const [open, setOpen] = useState(false);
    const root = useRef(null);
    const colors = getCustomColors();

    useEffect(() => {
        if (!open) return;
        function onDown(e) {
            if (!root.current?.contains(e.target)) setOpen(false);
        }
        function onKey(e) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("pointerdown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    // Colors update live while a picker is dragged; the art is recolored and
    // the choice saved once it stops changing.
    const commitTimer = useRef(0);
    function pick(key, value) {
        setCustomColors({ [key]: value }, { commit: false });
        clearTimeout(commitTimer.current);
        commitTimer.current = setTimeout(() => setCustomColors({}), 350);
    }
    useEffect(() => () => clearTimeout(commitTimer.current), []);

    function pickPreset(p) {
        if (p.id) setTheme(p.id);
        else setCustomColors({ bg: p.bg, ink: p.ink, text: p.text, head: p.head });
    }

    const lowContrast = contrast(colors.bg, colors.ink) < 3 || contrast(colors.bg, colors.text) < 4.5;

    return (
        <div className="theme-switch-wrap" ref={root}>
            <div className="theme-switch" role="group" aria-label="Color theme">
                {Object.entries(THEMES).map(([id, t]) => (
                    <button
                        key={id}
                        type="button"
                        className={"theme-swatch theme-swatch-" + id}
                        aria-label={t.label + " theme"}
                        aria-pressed={theme === id}
                        title={t.label}
                        onClick={() => setTheme(id)}
                    >
                        <span aria-hidden="true" />
                    </button>
                ))}
                <button
                    type="button"
                    className="theme-swatch theme-swatch-custom"
                    aria-label="Custom colors"
                    aria-pressed={theme === "custom"}
                    aria-expanded={open}
                    aria-controls="theme-panel"
                    title="Custom colors"
                    onClick={() => {
                        if (theme !== "custom") setTheme("custom");
                        setOpen((v) => !v);
                    }}
                >
                    <span
                        aria-hidden="true"
                        style={{
                            background: `linear-gradient(90deg, ${colors.ink} 50%, ${colors.head} 50%)`,
                            boxShadow: `inset 0 -6px 0 ${colors.bg}, 0 0 0 1px ${colors.text}`,
                        }}
                    />
                </button>
            </div>

            {open && (
                <div className="theme-panel" id="theme-panel" role="dialog" aria-label="Custom colors">
                    <div className="theme-panel-head">
                        <span className="label">Your colors</span>
                        <button type="button" className="theme-panel-close" aria-label="Close" onClick={() => setOpen(false)}>
                            ×
                        </button>
                    </div>

                    <div className="theme-fields">
                        {FIELDS.map((f) => (
                            <label key={f.key} className="theme-field">
                                <input
                                    type="color"
                                    value={colors[f.key]}
                                    onChange={(e) => pick(f.key, e.target.value)}
                                />
                                <span>{f.label}</span>
                                <code>{colors[f.key]}</code>
                            </label>
                        ))}
                    </div>

                    {lowContrast && <p className="theme-warn">Low contrast: text may be hard to read.</p>}

                    <span className="label">Start from</span>
                    <div className="theme-presets">
                        {PRESETS.map((p) => (
                            <button
                                key={p.label}
                                type="button"
                                className="theme-preset"
                                onClick={() => pickPreset(p)}
                                style={{ background: p.bg, color: p.ink, borderColor: p.ink }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
