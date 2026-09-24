// The sim's random-battle rules read Node's `global`; workers only have globalThis.
globalThis.global = globalThis;
