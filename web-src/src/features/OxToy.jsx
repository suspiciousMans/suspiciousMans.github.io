import { useEffect, useRef, useState } from "react";
import { loadOxidized, runOx } from "./oxidized.js";

// The shell for the editable toys: an Oxidized code editor on the left and
// the toy itself on the right. On phones the editor becomes an overlay you
// open with the "Code" button. `status` is { kind, text }, where kind is
// "ok", "running", "error", "panic", "timeout" or "internal".
export default function OxToy({ code, onCode, examples, example, onExample, onRun, status, printed = [], children }) {
    const [open, setOpen] = useState(false);
    return (
        <div className={"ox-toy" + (open ? " is-coding" : "")}>
            <div className="ox-pane">
                <div className="ox-head">
                    <select className="ox-examples" value={example} onChange={(e) => onExample(e.target.value)} aria-label="Examples">
                        {examples.map((x) => (
                            <option key={x.id} value={x.id}>
                                {x.label}
                            </option>
                        ))}
                        {example === "edited" && <option value="edited">Your edit</option>}
                    </select>
                    <button type="button" className="toy-tool ox-run" onClick={onRun} title="Run (Ctrl+Enter)">
                        Run
                    </button>
                    <button type="button" className="toy-tool ox-close" onClick={() => setOpen(false)}>
                        Done
                    </button>
                </div>
                <OxCode value={code} onChange={onCode} onRun={onRun} />
                <div className={"ox-status ox-" + status.kind} role="status">
                    {status.text}
                </div>
                {printed.length > 0 && (
                    <pre className="ox-console" aria-label="Printed output">
                        {printed.slice(0, 8).join("\n") + (printed.length > 8 ? `\n… ${printed.length - 8} more lines` : "")}
                    </pre>
                )}
            </div>
            <div className="ox-view">
                {children}
                <button type="button" className="toy-tool ox-open" onClick={() => setOpen(true)}>
                    Edit code
                </button>
            </div>
        </div>
    );
}

// A textarea with the highlighted code drawn underneath it, so typing is
// plain and native while the colours come from Oxidized's own highlighter.
function OxCode({ value, onChange, onRun }) {
    const [hl, setHl] = useState(null);
    const under = useRef(null);

    useEffect(() => {
        let live = true;
        loadOxidized()
            .then((ox) => live && setHl(() => ox.highlight))
            .catch(() => {});
        return () => {
            live = false;
        };
    }, []);

    function onKeyDown(e) {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onRun();
        } else if (e.key === "Tab" && !e.shiftKey) {
            // Indent instead of leaving the editor.
            e.preventDefault();
            const t = e.target;
            const { selectionStart: a, selectionEnd: b } = t;
            onChange(value.slice(0, a) + "    " + value.slice(b));
            requestAnimationFrame(() => (t.selectionStart = t.selectionEnd = a + 4));
        }
    }

    function onScroll(e) {
        if (!under.current) return;
        under.current.scrollTop = e.target.scrollTop;
        under.current.scrollLeft = e.target.scrollLeft;
    }

    return (
        <div className="ox-code">
            <pre ref={under} className="ox-code-under" aria-hidden="true" dangerouslySetInnerHTML={{ __html: (hl ? hl(value) : escape(value)) + "\n" }} />
            <textarea
                className="ox-code-input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                onScroll={onScroll}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                aria-label="Oxidized code"
            />
        </div>
    );
}

function escape(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Runs `compile` a moment after the code stops changing, and once at the
// start. Returns a function that runs it straight away.
export function useAutoRun(code, compile, delay = 700) {
    const first = useRef(true);
    const latest = useRef(compile);
    latest.current = compile;
    useEffect(() => {
        const t = setTimeout(() => latest.current(code), first.current ? 0 : delay);
        first.current = false;
        return () => clearTimeout(t);
    }, [code, delay]);
    return () => latest.current(code);
}

// Describe a failed run for the status line.
export function describe(result) {
    const label = { error: "Error", panic: "Panicked", timeout: "Stopped", internal: "Couldn't run" }[result.kind] || "Error";
    return { kind: result.kind, text: `${label}: ${result.message}` };
}

// runOx, but a run that's been overtaken by a newer one resolves to null, so
// a slow old run can't overwrite the result of the code on screen now.
export function useLatestRun() {
    const n = useRef(0);
    const cancel = useRef(null);
    return async (source, opts = {}) => {
        const id = ++n.current;
        cancel.current?.();
        const result = await runOx(source, { ...opts, onStart: (stop) => (cancel.current = stop) });
        return id === n.current ? result : null;
    };
}
