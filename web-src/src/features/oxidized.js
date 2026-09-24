// Runs Oxidized code for the Lab's editable toys, with the same browser port
// of the language that powers /oxidized (oxidized/js/lang.js), so a rule
// written here behaves as it does in the playground and with `oxidized run`.
//
// Programs run in a throwaway Web Worker: a runaway loop gets stopped after
// a few seconds instead of freezing the page. The toys wrap the person's
// functions in a generated `fn main()` that calls them and prints each
// answer on a line starting with "@", and read those lines back.
const OX_VERSION = "1";
const langUrl = () => `${location.origin}/oxidized/js/lang.js?v=${OX_VERSION}`;

let loading = null;

// The main thread only needs lang.js for syntax highlighting.
export function loadOxidized() {
    if (window.Oxidized) return Promise.resolve(window.Oxidized);
    if (!loading) {
        loading = new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = langUrl();
            s.onload = () => resolve(window.Oxidized);
            s.onerror = () => {
                loading = null;
                reject(new Error("couldn't load the Oxidized runtime"));
            };
            document.head.appendChild(s);
        });
    }
    return loading;
}

let workerUrl = null;

function makeWorker() {
    if (!workerUrl) {
        const code = `importScripts(${JSON.stringify(langUrl())});
onmessage = function (e) {
    var out = [];
    try {
        Oxidized.runOxidized(e.data, function (line) {
            out.push(line);
            if (out.length > 400000) throw new Oxidized.OxPanic("too much output");
        });
        postMessage({ ok: true, out: out });
    } catch (err) {
        var kind = err instanceof Oxidized.OxPanic ? "panic" : err instanceof Oxidized.OxError ? "error" : "internal";
        postMessage({ ok: false, kind: kind, message: String((err && err.message) || err), out: out });
    }
};`;
        workerUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    }
    return new Worker(workerUrl);
}

// Resolves to { ok, out } or { ok: false, kind, message, out }; never rejects.
// `onStart` receives a function that cancels the run.
export function runOx(source, { timeout = 5000, onStart } = {}) {
    return new Promise((resolve) => {
        let worker;
        try {
            worker = makeWorker();
        } catch {
            resolve({ ok: false, kind: "internal", message: "couldn't start the Oxidized runner", out: [] });
            return;
        }
        const done = (result) => {
            clearTimeout(timer);
            worker.terminate();
            resolve(result);
        };
        const timer = setTimeout(
            () => done({ ok: false, kind: "timeout", message: `still running after ${timeout / 1000}s, so it was stopped. Is there a loop that never ends?`, out: [] }),
            timeout
        );
        worker.onmessage = (e) => done(e.data);
        // Lets the caller stop a run it no longer needs.
        onStart?.(() => done({ ok: false, kind: "cancelled", message: "replaced by a newer run", out: [] }));
        worker.onerror = (e) => {
            e.preventDefault?.();
            done({ ok: false, kind: "internal", message: e.message || "the Oxidized runner failed to load", out: [] });
        };
        worker.postMessage(source);
    });
}

// Split a run's output into the toy's "@" answer lines and anything the
// person printed themselves.
export function splitOutput(out) {
    const data = [];
    const printed = [];
    for (const line of out) (line.startsWith("@") ? data : printed).push(line);
    return { data, printed };
}

// "3", "3.0", "true" → a number; anything else → NaN.
export function toNumber(s) {
    if (s === "true") return 1;
    if (s === "false") return 0;
    return /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(s) ? Number(s) : NaN;
}

// The toys write `fn main()` themselves.
export function checkSource(code, needs) {
    if (/\bfn\s+main\s*\(/.test(code)) return "Leave out `fn main()`: this toy writes its own main that calls your function.";
    for (const name of needs) {
        if (!new RegExp(`\\bfn\\s+${name}\\s*\\(`).test(code)) return `Define \`fn ${name}(…)\`: that's the function this toy calls.`;
    }
    return null;
}
