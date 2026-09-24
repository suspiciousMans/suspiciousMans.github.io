// The CPU opponent. It sees the whole battle (it is the computer, after all),
// scores every legal move with @smogon/calc's damage formula plus a few rules
// of thumb for status moves, and switches out of matchups it is losing.
import { calculate, Pokemon, Move, Field, Generations } from "@smogon/calc";

const WEATHER = {
    sunnyday: "Sun",
    raindance: "Rain",
    sandstorm: "Sand",
    hail: "Hail",
    snow: "Snow",
    snowscape: "Snow",
    desolateland: "Harsh Sunshine",
    primordialsea: "Heavy Rain",
    deltastream: "Strong Winds",
};
const TERRAIN = {
    electricterrain: "Electric",
    grassyterrain: "Grassy",
    psychicterrain: "Psychic",
    mistyterrain: "Misty",
};

function calcMon(gen, p, tera) {
    const opts = {
        level: p.level,
        nature: p.set.nature || undefined,
        evs: p.set.evs,
        ivs: p.set.ivs,
        boosts: { ...p.boosts },
        curHP: p.hp,
        status: p.status || "",
    };
    if (gen.num > 1 && p.item) opts.item = p.getItem().name;
    if (gen.num > 2 && p.ability) opts.ability = p.getAbility().name;
    const teraType = tera || p.terastallized;
    if (teraType) opts.teraType = teraType;
    return new Pokemon(gen, p.species.name, opts);
}

function calcField(battle) {
    const w = battle.field.weather;
    const t = battle.field.terrain;
    return new Field({
        gameType: "Singles",
        weather: WEATHER[w] || undefined,
        terrain: TERRAIN[t] || undefined,
    });
}

// Fraction of the defender's current HP this move takes on average (0..~).
function damageShare(battle, attacker, defender, moveName, tera) {
    const gen = Generations.get(battle.gen);
    try {
        const a = calcMon(gen, attacker, tera);
        const d = calcMon(gen, defender);
        const m = new Move(gen, moveName, { useMax: !!attacker.volatiles.dynamax });
        const res = calculate(gen, a, d, m, calcField(battle));
        const [lo, hi] = res.range();
        return (lo + hi) / 2 / Math.max(1, defender.hp);
    } catch (e) {
        // Unknown to the calc (rare forms, odd moves): fall back to type maths.
        const move = battle.dex.moves.get(moveName);
        if (move.category === "Status") return 0;
        if (!battle.dex.getImmunity(move.type, defender)) return 0;
        const eff = 2 ** battle.dex.getEffectiveness(move.type, defender);
        const stab = attacker.getTypes().includes(move.type) ? 1.5 : 1;
        return ((move.basePower || 60) * eff * stab) / 400;
    }
}

function bestDamage(battle, attacker, defender) {
    let best = 0;
    for (const slot of attacker.moveSlots) {
        if (slot.pp <= 0 || slot.disabled) continue;
        best = Math.max(best, damageShare(battle, attacker, defender, slot.move));
    }
    return best;
}

function statusScore(battle, me, foe, move) {
    const myHp = me.hp / me.maxhp;
    if (move.status) return foe.status ? 0 : 0.3;
    if (move.volatileStatus === "confusion") return foe.volatiles.confusion ? 0 : 0.15;
    if (move.heal || move.flags?.heal) return myHp < 0.5 ? 0.6 : myHp < 0.75 ? 0.2 : 0;
    if (move.self?.boosts || (move.boosts && move.target === "self")) {
        const boosts = move.self?.boosts || move.boosts;
        const already = Object.keys(boosts).some((k) => (me.boosts[k] || 0) >= 2);
        return myHp > 0.7 && !already ? 0.35 : 0.05;
    }
    if (move.sideCondition) {
        const side = move.target === "foeSide" ? foe.side : me.side;
        return side.sideConditions[move.sideCondition] ? 0 : 0.25;
    }
    if (move.weather) return battle.field.weather === move.weather ? 0 : 0.15;
    if (move.id === "protect" || move.id === "detect") return me.volatiles.stall ? 0 : 0.1;
    return 0.1;
}

// Best bench member to bring in against `foe`: hits hard, takes little.
function bestSwitch(battle, side, request, foe) {
    let best = null;
    request.side.pokemon.forEach((info, i) => {
        if (info.active || info.condition.endsWith(" fnt")) return;
        // The request lists the team in the same order the sim keeps it.
        const mon = side.pokemon[i];
        if (!mon || mon.fainted) return;
        const deal = foe ? bestDamage(battle, mon, foe) : 0;
        const take = foe ? bestDamage(battle, foe, mon) * (foe.hp / Math.max(1, mon.hp)) : 0;
        const score = deal - take + Math.random() * 0.05;
        if (!best || score > best.score) best = { index: i + 1, score };
    });
    return best;
}

export function chooseFor(battle, sideId, request) {
    if (request.wait) return null;
    if (request.teamPreview) return "default";
    const side = battle[sideId];
    const foeSide = side.foe;
    const foe = foeSide.active[0] && !foeSide.active[0].fainted ? foeSide.active[0] : null;

    if (request.forceSwitch) {
        const pick = bestSwitch(battle, side, request, foe);
        return pick ? `switch ${pick.index}` : "default";
    }

    const me = side.active[0];
    const act = request.active[0];
    const legal = act.moves.map((m, i) => ({ ...m, slot: i + 1 })).filter((m) => !m.disabled && (m.pp === undefined || m.pp > 0));
    if (!legal.length || !foe) return "default";

    const scored = legal.map((m) => {
        const move = battle.dex.moves.get(m.id);
        let score;
        if (move.category === "Status") score = statusScore(battle, me, foe, move);
        else {
            score = Math.min(1.2, damageShare(battle, me, foe, m.move));
            if (score >= 1 && move.priority > 0) score += 0.3;
            score *= (move.accuracy === true ? 100 : move.accuracy) / 100;
        }
        return { ...m, move, score: score * (0.85 + Math.random() * 0.15) };
    });
    scored.sort((a, b) => b.score - a.score);
    let top = scored[0];

    // Losing the matchup badly: try a switch, now and then.
    if (!act.trapped && !act.maybeTrapped && top.score < 0.2 && Math.random() < 0.6) {
        const pick = bestSwitch(battle, side, request, foe);
        if (pick && pick.score > 0.3) return `switch ${pick.index}`;
    }

    let extra = "";
    if (act.canMegaEvo) extra = " mega";
    else if (act.canUltraBurst) extra = " ultra";
    else if (act.canTerastallize && top.move.category !== "Status") {
        const withTera = damageShare(battle, me, foe, top.move.name, act.canTerastallize);
        const without = damageShare(battle, me, foe, top.move.name);
        const alive = side.pokemon.filter((p) => !p.fainted).length;
        if (withTera > without * 1.3 || (alive <= 2 && withTera >= without)) extra = " terastallize";
    } else if (act.canDynamax && side.pokemon.filter((p) => !p.fainted).length <= 3) extra = " dynamax";
    return `move ${top.slot}${extra}`;
}
