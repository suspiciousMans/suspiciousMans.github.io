// Worker entry: owns the simulator so the page never stalls on a turn.
// Messages in:  { id?, op, ...args }. Replies to ops that carry an id come
// back as { id, result } or { id, error }; battle events are pushed as they
// happen.
import "./shim.js";
import { createBattle, randomPaste, importTeam, validate } from "./engine.js";

let battle = null;

const ops = {
    start({ format, team }) {
        battle?.destroy();
        battle = createBattle({ format, team, emit: (m) => postMessage(m) });
        return true;
    },
    choose({ choice }) {
        battle?.choose(choice);
    },
    forfeit() {
        battle?.forfeit();
    },
    random({ format }) {
        return randomPaste(format);
    },
    parse({ text }) {
        return importTeam(text);
    },
    validate({ format, text }) {
        const sets = importTeam(text);
        if (!sets.length) return ["Paste a team first."];
        return validate(format, sets);
    },
};

onmessage = (e) => {
    const { id, op, ...args } = e.data;
    try {
        const result = ops[op](args);
        if (id !== undefined) postMessage({ id, result });
    } catch (err) {
        if (id !== undefined) postMessage({ id, error: String(err && err.message) });
        else postMessage({ type: "error", message: String(err && err.message) });
    }
};
