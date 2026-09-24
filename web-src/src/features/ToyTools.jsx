// The small button row and hint that sit on top of a toy's canvas.
// `tools` is [{ id, label, active, onClick }].
export default function ToyTools({ tools, hint }) {
    return (
        <>
            <div className="toy-tools">
                {tools.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        className={"toy-tool" + (t.active ? " is-on" : "")}
                        aria-pressed={t.active === undefined ? undefined : t.active}
                        onClick={t.onClick}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            {hint && <p className="toy-hint label">{hint}</p>}
        </>
    );
}
