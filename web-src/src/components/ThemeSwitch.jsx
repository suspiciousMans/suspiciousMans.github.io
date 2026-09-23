import { THEMES, setTheme, useTheme } from "../theme.js";

// Two-swatch toggle between the Saffron and Ember color themes.
export default function ThemeSwitch() {
    const theme = useTheme();
    return (
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
        </div>
    );
}
