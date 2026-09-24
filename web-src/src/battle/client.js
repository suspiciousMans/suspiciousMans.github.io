// Page-side handle on the engine worker: one shared worker, promise-based
// calls for team tools, and a listener list for battle events.
let worker = null;
let seq = 0;
const waiting = new Map();
const listeners = new Set();

function get() {
    if (worker) return worker;
    worker = new Worker(new URL("./engine.worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
        const m = e.data;
        if (m.id !== undefined && waiting.has(m.id)) {
            const { resolve, reject } = waiting.get(m.id);
            waiting.delete(m.id);
            m.error ? reject(new Error(m.error)) : resolve(m.result);
            return;
        }
        listeners.forEach((f) => f(m));
    };
    return worker;
}

export function call(op, args = {}) {
    const id = ++seq;
    return new Promise((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        get().postMessage({ id, op, ...args });
    });
}

export function send(op, args = {}) {
    get().postMessage({ op, ...args });
}

export function listen(f) {
    get();
    listeners.add(f);
    return () => listeners.delete(f);
}
