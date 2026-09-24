import { useMemo, useState } from "react";
import { Generations, calculate, Pokemon, Move, Field } from "@smogon/calc";
import { sprite } from "./look.js";
import { TypeChip } from "./bits.jsx";

// A damage calculator on Smogon's own formula (@smogon/calc), the same one
// the CPU uses to pick its moves.
const GENS = [9, 8, 7, 6, 5, 4, 3, 2, 1];
const STATS = ["hp", "atk", "def", "spa", "spd", "spe"];
const STAT_NAME = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };
const WEATHERS = ["", "Sun", "Rain", "Sand", "Snow", "Hail", "Harsh Sunshine", "Heavy Rain", "Strong Winds"];
const TERRAINS = ["", "Electric", "Grassy", "Psychic", "Misty"];
const STATUSES = [
    ["", "Healthy"],
    ["brn", "Burned"],
    ["par", "Paralyzed"],
    ["psn", "Poisoned"],
    ["tox", "Badly poisoned"],
    ["slp", "Asleep"],
    ["frz", "Frozen"],
];

function blank(species, moves) {
    return {
        species,
        level: 100,
        nature: "Serious",
        ability: "",
        item: "",
        tera: "",
        status: "",
        hp: 100,
        evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        moves,
        crit: false,
        screens: false,
    };
}

function fromSet(set) {
    const s = blank(set.species, [...(set.moves || []), "", "", "", ""].slice(0, 4));
    return {
        ...s,
        level: set.level || 100,
        nature: set.nature || "Serious",
        ability: set.ability || "",
        item: set.item || "",
        evs: { ...s.evs, ...(set.evs || {}) },
    };
}

function build(gen, side) {
    const opts = {
        level: Number(side.level) || 100,
        nature: side.nature,
        evs: side.evs,
        boosts: side.boosts,
        status: side.status,
    };
    if (side.ability) opts.ability = side.ability;
    if (side.item && gen.num > 1) opts.item = side.item;
    if (side.tera && gen.num === 9) opts.teraType = side.tera;
    const full = new Pokemon(gen, side.species, opts);
    return new Pokemon(gen, side.species, { ...opts, curHP: Math.max(1, Math.round((full.maxHP() * side.hp) / 100)) });
}

function List({ id, items }) {
    return (
        <datalist id={id}>
            {items.map((n) => (
                <option key={n} value={n} />
            ))}
        </datalist>
    );
}

function SideForm({ title, side, set, gen, lists, team }) {
    const species = gen.species.get(toId(side.species));
    const abilities = species ? Object.values(species.abilities || {}) : [];
    const art = species ? sprite(species.name, { style: "gen5ani" }) : null;
    const up = (patch) => set({ ...side, ...patch });
    return (
        <fieldset className="pk-calc-side">
            <legend className="label">{title}</legend>
            <div className="pk-calc-head">
                {art && <img src={art.url} width={art.w} height={art.h} alt="" referrerPolicy="no-referrer" style={{ imageRendering: "pixelated" }} />}
                <div className="pk-calc-head-fields">
                    <input className="pk-input" list="pk-species" value={side.species} onChange={(e) => up({ species: e.target.value })} aria-label={`${title} Pokémon`} />
                    <div className="pk-types">{species && species.types.map((t) => <TypeChip key={t} type={t} small />)}</div>
                    {team.length > 0 && (
                        <select className="pk-select" value="" onChange={(e) => e.target.value !== "" && set(fromSet(team[e.target.value]))} aria-label="Load from your team">
                            <option value="">Load from your team…</option>
                            {team.map((s, i) => (
                                <option key={i} value={i}>
                                    {s.species}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>
            <div className="pk-calc-grid">
                <label>
                    <span>Level</span>
                    <input className="pk-input" type="number" min="1" max="100" value={side.level} onChange={(e) => up({ level: e.target.value })} />
                </label>
                <label>
                    <span>Nature</span>
                    <select className="pk-select" value={side.nature} onChange={(e) => up({ nature: e.target.value })}>
                        {lists.natures.map((n) => (
                            <option key={n}>{n}</option>
                        ))}
                    </select>
                </label>
                {gen.num > 2 && (
                    <label>
                        <span>Ability</span>
                        <input className="pk-input" list={"pk-abil-" + title} value={side.ability} placeholder={abilities[0] || ""} onChange={(e) => up({ ability: e.target.value })} />
                        <List id={"pk-abil-" + title} items={[...new Set([...abilities, ...lists.abilities])]} />
                    </label>
                )}
                {gen.num > 1 && (
                    <label>
                        <span>Item</span>
                        <input className="pk-input" list="pk-items" value={side.item} onChange={(e) => up({ item: e.target.value })} />
                    </label>
                )}
                {gen.num === 9 && (
                    <label>
                        <span>Tera</span>
                        <select className="pk-select" value={side.tera} onChange={(e) => up({ tera: e.target.value })}>
                            <option value="">Off</option>
                            {lists.types.map((t) => (
                                <option key={t}>{t}</option>
                            ))}
                        </select>
                    </label>
                )}
                <label>
                    <span>Status</span>
                    <select className="pk-select" value={side.status} onChange={(e) => up({ status: e.target.value })}>
                        {STATUSES.map(([v, l]) => (
                            <option key={v} value={v}>
                                {l}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    <span>HP %</span>
                    <input className="pk-input" type="number" min="1" max="100" value={side.hp} onChange={(e) => up({ hp: Number(e.target.value) })} />
                </label>
            </div>
            <table className="pk-calc-stats">
                <thead>
                    <tr>
                        <th />
                        {STATS.map((k) => (
                            <th key={k}>{STAT_NAME[k]}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <th>EVs</th>
                        {STATS.map((k) => (
                            <td key={k}>
                                <input
                                    className="pk-input"
                                    type="number"
                                    min="0"
                                    max="252"
                                    step="4"
                                    value={side.evs[k]}
                                    onChange={(e) => up({ evs: { ...side.evs, [k]: Math.max(0, Math.min(252, Number(e.target.value))) } })}
                                    aria-label={`${STAT_NAME[k]} EVs`}
                                />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <th>Boost</th>
                        <td />
                        {STATS.slice(1).map((k) => (
                            <td key={k}>
                                <select className="pk-select" value={side.boosts[k]} onChange={(e) => up({ boosts: { ...side.boosts, [k]: Number(e.target.value) } })} aria-label={`${STAT_NAME[k]} boost`}>
                                    {[6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6].map((b) => (
                                        <option key={b} value={b}>
                                            {b > 0 ? "+" + b : b}
                                        </option>
                                    ))}
                                </select>
                            </td>
                        ))}
                    </tr>
                </tbody>
            </table>
            <div className="pk-calc-moves">
                {side.moves.map((m, i) => (
                    <input
                        key={i}
                        className="pk-input"
                        list="pk-moves"
                        value={m}
                        placeholder={`Move ${i + 1}`}
                        onChange={(e) => up({ moves: side.moves.map((x, j) => (j === i ? e.target.value : x)) })}
                    />
                ))}
            </div>
            <div className="pk-calc-flags">
                <label className="pk-check">
                    <input type="checkbox" checked={side.crit} onChange={(e) => up({ crit: e.target.checked })} /> Critical hits
                </label>
                <label className="pk-check">
                    <input type="checkbox" checked={side.screens} onChange={(e) => up({ screens: e.target.checked })} /> Reflect + Light Screen up
                </label>
            </div>
        </fieldset>
    );
}

function toId(s) {
    return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function Results({ gen, from, to, field, label }) {
    const rows = [];
    let err = "";
    try {
        const a = build(gen, from);
        const d = build(gen, to);
        for (const name of from.moves) {
            if (!name || !gen.moves.get(toId(name))) continue;
            const move = new Move(gen, name, { isCrit: from.crit });
            if (move.category === "Status") continue;
            const res = calculate(gen, a, d, move, field);
            const [lo, hi] = res.range();
            const hp = d.maxHP();
            let desc = "";
            try {
                desc = res.desc();
            } catch (e) {
                desc = move.category === "Status" ? "Status move: no damage." : "No damage.";
            }
            rows.push({ name: move.name, type: move.type, lo: (lo / hp) * 100, hi: (hi / hp) * 100, desc });
        }
    } catch (e) {
        err = "Pick a real Pokémon on both sides.";
    }
    return (
        <div className="pk-calc-results">
            <h4 className="label">{label}</h4>
            {err && <p className="label">{err}</p>}
            {rows.map((r, i) => (
                <div key={i} className="pk-calc-row">
                    <div className="pk-calc-row-head">
                        <strong>{r.name}</strong>
                        <TypeChip type={r.type} small />
                        <span className="pk-calc-pct">
                            {r.lo.toFixed(1)} – {r.hi.toFixed(1)}%
                        </span>
                    </div>
                    <div className="pk-calc-bar">
                        <span className="is-max" style={{ width: Math.min(100, r.hi) + "%" }} />
                        <span className="is-min" style={{ width: Math.min(100, r.lo) + "%" }} />
                    </div>
                    <p className="pk-calc-desc">{r.desc}</p>
                </div>
            ))}
        </div>
    );
}

export default function CalcTab({ team }) {
    const [genNum, setGenNum] = useState(9);
    const [left, setLeft] = useState(() => (team[0] ? fromSet(team[0]) : { ...blank("Garchomp", ["Earthquake", "Outrage", "Stone Edge", "Swords Dance"]), nature: "Jolly", evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 } }));
    const [right, setRight] = useState(() => ({ ...blank("Gholdengo", ["Make It Rain", "Shadow Ball", "Recover", "Nasty Plot"]), nature: "Timid", evs: { hp: 0, atk: 0, def: 4, spa: 252, spd: 0, spe: 252 } }));
    const [weather, setWeather] = useState("");
    const [terrain, setTerrain] = useState("");
    const gen = Generations.get(genNum);

    const lists = useMemo(
        () => ({
            species: [...gen.species].map((s) => s.name).sort(),
            items: [...gen.items].map((i) => i.name).sort(),
            abilities: [...gen.abilities].map((a) => a.name).sort(),
            moves: [...gen.moves].map((m) => m.name).filter((n) => n !== "(No Move)").sort(),
            natures: [...gen.natures].map((n) => n.name).sort(),
            types: [...gen.types].map((t) => t.name).filter((t) => t !== "???").sort(),
        }),
        [gen]
    );

    const fieldFor = (defender) =>
        new Field({
            gameType: "Singles",
            weather: weather || undefined,
            terrain: terrain || undefined,
            defenderSide: { isReflect: defender.screens, isLightScreen: defender.screens },
        });

    return (
        <div className="pk-calc">
            <div className="pk-toolbar">
                <select className="pk-select" value={genNum} onChange={(e) => setGenNum(Number(e.target.value))} aria-label="Generation">
                    {GENS.map((g) => (
                        <option key={g} value={g}>
                            Gen {g}
                        </option>
                    ))}
                </select>
                {genNum > 1 && (
                    <select className="pk-select" value={weather} onChange={(e) => setWeather(e.target.value)} aria-label="Weather">
                        {WEATHERS.map((w) => (
                            <option key={w} value={w}>
                                {w || "No weather"}
                            </option>
                        ))}
                    </select>
                )}
                {genNum > 5 && (
                    <select className="pk-select" value={terrain} onChange={(e) => setTerrain(e.target.value)} aria-label="Terrain">
                        {TERRAINS.map((t) => (
                            <option key={t} value={t}>
                                {t ? t + " Terrain" : "No terrain"}
                            </option>
                        ))}
                    </select>
                )}
                <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                        setLeft(right);
                        setRight(left);
                    }}
                >
                    Swap sides
                </button>
            </div>
            <List id="pk-species" items={lists.species} />
            <List id="pk-items" items={lists.items} />
            <List id="pk-moves" items={lists.moves} />
            <div className="pk-calc-cols">
                <SideForm title="Left" side={left} set={setLeft} gen={gen} lists={lists} team={team} />
                <SideForm title="Right" side={right} set={setRight} gen={gen} lists={lists} team={team} />
            </div>
            <div className="pk-calc-cols">
                <Results gen={gen} from={left} to={right} field={fieldFor(right)} label={`${left.species} attacking`} />
                <Results gen={gen} from={right} to={left} field={fieldFor(left)} label={`${right.species} attacking`} />
            </div>
        </div>
    );
}
