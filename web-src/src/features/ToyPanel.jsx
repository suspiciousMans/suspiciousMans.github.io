import { useState } from "react";

// The control panel the deeper toys pin to the stage's top-right corner:
// sliders, pickers, button rows and read-outs. It folds away behind a
// "Controls" toggle, and starts folded on narrow screens so the toy has room.
export function ToyPanel({ children }) {
    const [open, setOpen] = useState(() => window.matchMedia("(min-width: 720px)").matches);
    return (
        <div className={"toy-panel" + (open ? " is-open" : "")}>
            <button type="button" className="toy-panel-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
                Controls <span aria-hidden="true">{open ? "−" : "+"}</span>
            </button>
            {open && <div className="toy-panel-body">{children}</div>}
        </div>
    );
}

export function ToySlider({ label, value, min, max, step = 1, onChange, format = (v) => v }) {
    return (
        <label className="toy-field">
            <span className="toy-field-head">
                <span>{label}</span>
                <output>{format(value)}</output>
            </span>
            <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        </label>
    );
}

export function ToySelect({ label, value, options, onChange }) {
    return (
        <label className="toy-field">
            <span className="toy-field-head">
                <span>{label}</span>
            </span>
            <select value={value} onChange={(e) => onChange(e.target.value)}>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

// items: [{ id, label, onClick, active }]
export function ToyButtons({ items }) {
    return (
        <div className="toy-buttons">
            {items.map((b) => (
                <button
                    key={b.id}
                    type="button"
                    className={"toy-tool" + (b.active ? " is-on" : "")}
                    aria-pressed={b.active === undefined ? undefined : b.active}
                    onClick={b.onClick}
                >
                    {b.label}
                </button>
            ))}
        </div>
    );
}

export function ToyReadout({ items }) {
    return (
        <dl className="toy-readout">
            {items.map(([k, v]) => (
                <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                </div>
            ))}
        </dl>
    );
}

export function ToyNote({ children }) {
    return <p className="toy-note">{children}</p>;
}
