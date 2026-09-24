// Shared Pokédex data for the Team and Pokédex tabs (Gen 9 data, including
// Pokémon and moves that only exist in National Dex).
import { Dex } from "@pkmn/dex";

export const dex = Dex.forGen(9);
export const shown = (x) => x.exists && (!x.isNonstandard || x.isNonstandard === "Past");
export const SPECIES = dex.species.all().filter((s) => shown(s) && s.num > 0);
export const MOVES = dex.moves.all().filter((m) => shown(m) && !m.isMax && !m.isZ);
export const ITEMS = dex.items.all().filter(shown);
export const ABILITIES = dex.abilities.all().filter((a) => shown(a) && a.num > 0);
export const TYPES = dex.types.all().filter((t) => t.exists && t.name !== "Stellar").map((t) => t.name);
export const NATURES = dex.natures.all();

const learnCache = new Map();

// Every move a species can learn, including what its pre-evolutions and base
// forme learn, sorted by name.
export function learnable(species) {
    const sp = dex.species.get(species);
    if (!sp.exists) return Promise.resolve([]);
    if (learnCache.has(sp.id)) return learnCache.get(sp.id);
    const job = (async () => {
        const found = new Set();
        for (let cur = sp; cur && cur.exists; cur = cur.prevo ? dex.species.get(cur.prevo) : null) {
            for (const id of [cur.id, cur.changesFrom && dex.species.get(cur.changesFrom).id, dex.species.get(cur.baseSpecies).id]) {
                if (!id) continue;
                const ls = await dex.learnsets.get(id);
                Object.keys(ls?.learnset || {}).forEach((k) => found.add(k));
            }
        }
        return [...found].map((id) => dex.moves.get(id)).filter(shown).sort((a, b) => a.name.localeCompare(b.name));
    })();
    learnCache.set(sp.id, job);
    return job;
}

export const STAT_IDS = ["hp", "atk", "def", "spa", "spd", "spe"];
export const STAT_NAMES = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };

// The in-game stat formula.
export function calcStat(stat, base, iv, ev, level, nature) {
    const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
    if (stat === "hp") return base === 1 ? 1 : core + level + 10;
    const n = nature ? dex.natures.get(nature) : null;
    const mod = n && n.plus === stat ? 1.1 : n && n.minus === stat ? 0.9 : 1;
    return Math.floor((core + 5) * mod);
}
