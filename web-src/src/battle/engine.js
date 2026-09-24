// One battle against the CPU, driven by Pokémon Showdown's own simulator
// (@pkmn/sim). The player's view is rebuilt from the same protocol the real
// client reads (@pkmn/client), and every line is turned into Showdown's own
// battle text (@pkmn/view). Runs inside a worker (engine.worker.js); kept free
// of worker globals so it can also be driven from Node for testing.
import { BattleStreams, Teams, TeamValidator, Dex as SimDex } from "@pkmn/sim";
import { TeamGenerators } from "@pkmn/randoms";
import { Generations } from "@pkmn/data";
import { Battle as ClientBattle } from "@pkmn/client";
import { Protocol } from "@pkmn/protocol";
import { LogFormatter } from "@pkmn/view";
import { chooseFor } from "./ai.js";

Teams.setGeneratorFactory(TeamGenerators);
// The sim's own Dex satisfies @pkmn/data, so the worker ships one copy of the data.
const gens = new Generations(SimDex);

// Lines worth pausing on when the page replays a turn.
const BEATS = new Set(["move", "switch", "drag", "replace", "-damage", "-heal", "faint", "-crit", "-supereffective", "-resisted", "-immune", "-miss", "-status", "-boost", "-unboost", "-terastallize", "-mega", "detailschange", "-formechange", "win", "tie", "-weather", "-fieldstart", "-sidestart", "cant"]);

function monView(p) {
    if (!p) return null;
    return {
        ident: p.originalIdent || p.ident,
        name: p.name,
        species: p.speciesForme,
        level: p.level,
        shiny: p.shiny,
        gender: p.gender,
        hp: p.hp,
        maxhp: p.maxhp,
        status: p.status || "",
        fainted: p.fainted,
        boosts: { ...p.boosts },
        volatiles: Object.keys(p.volatiles),
        types: safe(() => p.types, []),
        tera: p.terastallized || "",
        item: p.item || "",
        ability: p.ability || p.baseAbility || "",
        moves: p.moveSlots.map((m) => m.name),
    };
}

function safe(f, d) {
    try {
        return f();
    } catch (e) {
        return d;
    }
}

function sideView(side) {
    return {
        name: side.name,
        total: side.totalPokemon || side.team.length,
        active: monView(side.active[0]),
        team: side.team.map(monView),
        conditions: Object.keys(side.sideConditions),
    };
}

// Moves in a request only carry names; the page wants type, power and how
// well each would land on the foe that is out right now.
function annotateRequest(req, dex, foe) {
    if (!req || !req.active) return req;
    for (const act of req.active) {
        const decorate = (m) => {
            const move = dex.moves.get(m.id || m.move);
            m.type = move.type;
            m.category = move.category;
            m.basePower = move.basePower;
            m.accuracy = move.accuracy;
            m.desc = move.shortDesc || move.desc || "";
            m.priority = move.priority;
            if (foe && move.category !== "Status") {
                const types = foe.types.length ? foe.types : ["???"];
                if (!dex.getImmunity(move.type, types)) m.eff = 0;
                else m.eff = 2 ** dex.getEffectiveness(move.type, types);
            }
        };
        act.moves.forEach(decorate);
        if (act.maxMoves?.maxMoves) act.maxMoves.maxMoves.forEach(decorate);
        if (act.canZMove) act.canZMove.forEach((z) => z && decorate({ ...z, id: z.move }));
    }
    return req;
}

export function validate(format, sets) {
    const problems = TeamValidator.get(format).validateTeam(sets);
    return problems && problems.length ? problems : null;
}

export function randomTeam(format) {
    return Teams.generate(format);
}

// Random sets carry ids ("dragontail"); pretty names read better in a paste.
export function randomPaste(format) {
    const dex = SimDex.forFormat(format);
    const sets = randomTeam(format).map((s) => ({
        ...s,
        moves: s.moves.map((m) => dex.moves.get(m).name),
        item: s.item ? dex.items.get(s.item).name : s.item,
        ability: s.ability ? dex.abilities.get(s.ability).name : s.ability,
    }));
    return exportTeam(sets);
}

export function importTeam(text) {
    const t = Teams.import(text);
    return t || [];
}

export function exportTeam(sets) {
    return Teams.export(sets);
}

export function createBattle({ format, team, emit }) {
    const simFormat = SimDex.formats.get(format);
    const random = !!simFormat.team;
    const gen = simFormat.gen || 9;
    const dex = SimDex.forGen(gen);

    let p1Team = team;
    let p2Team;
    if (random) {
        p1Team = randomTeam(format);
        p2Team = randomTeam(format);
    } else {
        // The CPU brings a random set from the same generation, at full level.
        p2Team = randomTeam(`gen${gen}randombattle`).map((s) => ({ ...s, level: simFormat.ruleTable?.defaultLevel || 100 }));
    }

    const stream = new BattleStreams.BattleStream();
    const ps = BattleStreams.getPlayerStreams(stream);
    const client = new ClientBattle(gens);
    const formatter = new LogFormatter("p1", client);
    let closed = false;

    function snapshot() {
        return {
            turn: client.turn,
            weather: client.field.weather || "",
            terrain: client.field.terrain || "",
            pseudo: Object.keys(client.field.pseudoWeather),
            p1: sideView(client.p1),
            p2: sideView(client.p2),
        };
    }

    (async () => {
        // A request arrives in its own chunk, sometimes before the log it
        // belongs to and sometimes after (team preview). The sim writes both
        // in the same tick, so gather everything and flush once it settles.
        let pending = null;
        let steps = [];
        let ended = null;
        let flushTimer = 0;
        const flush = () => {
            flushTimer = 0;
            const request = pending;
            pending = null;
            const foe = client.p2.active[0] ? monView(client.p2.active[0]) : null;
            const req = request && !request.wait && !ended ? annotateRequest(request, dex, foe) : null;
            if (req || steps.length || ended) emit({ type: "steps", steps, request: req, snap: snapshot(), ended });
            if (ended) closed = true;
            steps = [];
        };
        for await (const chunk of ps.p1) {
            for (const line of chunk.split("\n")) {
                if (!line) continue;
                const { args, kwArgs } = Protocol.parseBattleLine(line);
                if (args[0] === "error") {
                    emit({ type: "choice-error", message: args[1] || "" });
                    continue;
                }
                if (args[0] === "request") {
                    if (args[1]) pending = JSON.parse(args[1]);
                    continue;
                }
                let text = "";
                try {
                    text = formatter.formatText(args, kwArgs) || "";
                } catch (e) {
                    text = "";
                }
                try {
                    client.add(args, kwArgs);
                } catch (e) {
                    // A line the tracker can't follow shouldn't stop the battle.
                }
                if (args[0] === "win") ended = { winner: args[1] };
                if (args[0] === "tie") ended = { winner: "" };
                const kind = args[0];
                if (text.trim() || BEATS.has(kind)) {
                    const who = typeof args[1] === "string" && /^p[12]/.test(args[1]) ? args[1].slice(0, 2) : "";
                    const target = typeof args[3] === "string" && /^p[12]/.test(args[3]) ? args[3].slice(0, 2) : "";
                    steps.push({ kind, who, target, move: kind === "move" ? args[2] : "", text: text.trim(), snap: snapshot() });
                }
            }
            if (!flushTimer) flushTimer = setTimeout(flush, 0);
        }
    })().catch((e) => emit({ type: "error", message: String(e && e.message) }));

    (async () => {
        for await (const chunk of ps.p2) {
            for (const line of chunk.split("\n")) {
                if (!line.startsWith("|request|")) continue;
                const req = JSON.parse(line.slice(9));
                if (req.wait) continue;
                // Let the sim finish emitting the turn before answering.
                setTimeout(() => {
                    if (closed) return;
                    let choice;
                    try {
                        choice = chooseFor(stream.battle, "p2", req);
                    } catch (e) {
                        choice = "default";
                    }
                    if (choice) ps.p2.write(choice);
                }, 0);
            }
        }
    })();

    const spec = { formatid: format };
    ps.omniscient.write(
        `>start ${JSON.stringify(spec)}\n` +
            `>player p1 ${JSON.stringify({ name: "You", team: Teams.pack(p1Team) })}\n` +
            `>player p2 ${JSON.stringify({ name: "CPU", team: Teams.pack(p2Team) })}`
    );

    return {
        choose(choice) {
            if (!closed) ps.p1.write(choice);
        },
        forfeit() {
            if (!closed) ps.omniscient.write(">forcelose p1");
        },
        destroy() {
            closed = true;
            stream.destroy?.();
        },
    };
}
