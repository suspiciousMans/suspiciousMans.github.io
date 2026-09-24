// Picks four sensible moves from a learnset: strong same-type attacks, one
// for coverage, then a useful status move. Shared by the team builder and the
// engine, which fills in moves for any Pokémon that has none.
const GOOD_STATUS = new Set([
    "swordsdance", "nastyplot", "dragondance", "calmmind", "bulkup", "quiverdance", "shellsmash", "shiftgear",
    "recover", "roost", "slackoff", "softboiled", "moonlight", "synthesis", "morningsun", "shoreup", "wish",
    "stealthrock", "spikes", "toxicspikes", "stickyweb", "toxic", "willowisp", "thunderwave", "spore", "sleeppowder",
    "protect", "substitute", "leechseed", "defog", "rapidspin", "haze", "trick", "encore", "taunt", "partingshot",
]);
const AVOID = new Set(["explosion", "selfdestruct", "memento", "finalgambit", "healingwish", "lunardance", "mistyexplosion", "focuspunch", "lastresort", "dreameater", "synchronoise", "belch", "steelbeam", "mindblown", "struggle"]);

function usable(m) {
    return m.exists !== false && !m.isZ && !m.isMax && !AVOID.has(m.id) && !m.ohko && !m.flags?.charge && !m.flags?.recharge && (m.accuracy === true || m.accuracy >= 70);
}

function score(m) {
    const power = m.basePower || 60;
    const acc = m.accuracy === true ? 100 : m.accuracy;
    const hits = Array.isArray(m.multihit) ? m.multihit[1] * 0.7 : m.multihit || 1;
    return power * hits * (acc / 100) + (m.priority > 0 ? 10 : 0);
}

// Pick one of the best few, leaning hard toward the best, so rerolls vary
// without handing out weak moves.
function pickTop(list, n, rand) {
    const top = list.slice(0, n);
    return top.length ? top[Math.floor(rand() ** 3 * top.length)] : null;
}

export function randomMoves(pool, types, stats, rand = Math.random) {
    const moves = pool.filter(usable);
    const physical = (stats?.atk || 0) >= (stats?.spa || 0);
    const cat = physical ? "Physical" : "Special";
    const attacks = moves.filter((m) => m.category === cat && m.basePower > 0).sort((a, b) => score(b) - score(a));
    const chosen = [];
    const take = (m) => m && !chosen.some((c) => c.id === m.id) && chosen.push(m);

    for (const t of types) take(pickTop(attacks.filter((m) => m.type === t), 2, rand));
    const covered = new Set(chosen.map((m) => m.type));
    // Coverage: another type, not Normal (it hits nothing super effectively).
    const other = attacks.filter((m) => !covered.has(m.type) && !types.includes(m.type));
    take(pickTop(other.filter((m) => m.type !== "Normal").length ? other.filter((m) => m.type !== "Normal") : other, 4, rand));

    const status = moves.filter((m) => GOOD_STATUS.has(m.id));
    while (chosen.length < 4 && status.length && rand() < 0.8) {
        const m = status.splice(Math.floor(rand() * status.length), 1)[0];
        take(m);
        if (chosen.length >= 4 || chosen.filter((c) => c.category === "Status").length >= 1) break;
    }
    // Still short: more attacks, then anything left.
    for (const m of attacks) if (chosen.length < 4 && !chosen.some((c) => c.type === m.type)) take(m);
    for (const m of [...attacks, ...moves]) if (chosen.length < 4) take(m);
    return chosen.slice(0, 4).map((m) => m.name);
}
