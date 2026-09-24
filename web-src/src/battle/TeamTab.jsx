import { useEffect, useMemo, useRef, useState } from "react";
import { Team } from "@pkmn/sets";
import { call } from "./client.js";
import { icon, itemIcon, sprite } from "./look.js";
import { TypeChip } from "./bits.jsx";
import { RANDOM_FORMATS, TEAM_FORMATS } from "./BattleTab.jsx";
import { SpeciesPicker, ItemPicker, MovePicker } from "./Picker.jsx";
import { dex, MOVES, TYPES, NATURES, STAT_IDS, STAT_NAMES, learnable, calcStat } from "./dexdata.js";

const ZERO = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const PERFECT = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

// One-click spreads. Each sets EVs, a nature to match and, where it matters, IVs.
const PRESETS = [
    { id: "phys-fast", label: "Fast physical", evs: { atk: 252, spd: 4, spe: 252 }, nature: "Jolly" },
    { id: "phys-strong", label: "Strong physical", evs: { atk: 252, spd: 4, spe: 252 }, nature: "Adamant" },
    { id: "spec-fast", label: "Fast special", evs: { spa: 252, spd: 4, spe: 252 }, nature: "Timid", ivs: { atk: 0 } },
    { id: "spec-strong", label: "Strong special", evs: { spa: 252, spd: 4, spe: 252 }, nature: "Modest", ivs: { atk: 0 } },
    { id: "bulky-phys", label: "Bulky physical", evs: { hp: 252, atk: 252, spd: 4 }, nature: "Adamant" },
    { id: "bulky-spec", label: "Bulky special", evs: { hp: 252, spa: 252, spd: 4 }, nature: "Modest", ivs: { atk: 0 } },
    { id: "wall-phys", label: "Physical wall", evs: { hp: 252, def: 252, spd: 4 }, nature: "Impish" },
    { id: "wall-spec", label: "Special wall", evs: { hp: 252, def: 4, spd: 252 }, nature: "Careful" },
    { id: "wall-mixed", label: "Mixed wall", evs: { hp: 252, def: 128, spd: 128 }, nature: "Bold", ivs: { atk: 0 } },
    { id: "tr-phys", label: "Trick Room physical", evs: { hp: 252, atk: 252, def: 4 }, nature: "Brave", ivs: { spe: 0 } },
    { id: "tr-spec", label: "Trick Room special", evs: { hp: 252, spa: 252, def: 4 }, nature: "Quiet", ivs: { atk: 0, spe: 0 } },
    { id: "even", label: "Even spread", evs: { hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 }, nature: "Serious" },
];

const IV_PRESETS = [
    { id: "max", label: "All 31", ivs: {} },
    { id: "noatk", label: "0 Atk", ivs: { atk: 0 } },
    { id: "nospe", label: "0 Spe", ivs: { spe: 0 } },
    { id: "trspec", label: "0 Atk + 0 Spe", ivs: { atk: 0, spe: 0 } },
];

function parse(text) {
    try {
        return Team.import(text)?.team || [];
    } catch (e) {
        return [];
    }
}

function exportSets(sets) {
    const real = sets.filter((s) => s.species);
    return real.length ? new Team(real).export().trim() : "";
}

function natureLabel(n) {
    if (!n.plus) return `${n.name} (neutral)`;
    return `${n.name} (+${STAT_NAMES[n.plus]}, −${STAT_NAMES[n.minus]})`;
}

// Abilities nobody picks on purpose (or that most formats ban).
const AVOID = new Set(["Sand Veil", "Snow Cloak", "Moody", "Run Away", "Honey Gather", "Illuminate", "Ball Fetch", "Klutz", "Stall", "Slow Start", "Truant", "Defeatist"]);

// A reasonable starting spread for a freshly picked Pokémon.
function defaultsFor(species) {
    const sp = dex.species.get(species);
    const b = sp.baseStats;
    const physical = b.atk >= b.spa;
    const bulky = b.hp + b.def + b.spd > (b.atk + b.spa + b.spe) * 1.25;
    const preset = PRESETS.find((p) => p.id === (bulky ? (physical ? "bulky-phys" : "bulky-spec") : physical ? "phys-fast" : "spec-fast"));
    return {
        ability: Object.values(sp.abilities).find((a) => !AVOID.has(a)) || sp.abilities[0],
        teraType: sp.types[0],
        evs: { ...ZERO, ...preset.evs },
        ivs: { ...PERFECT, ...(preset.ivs || {}) },
        nature: preset.nature,
    };
}

function SetEditor({ set, update, allowAll }) {
    const [picking, setPicking] = useState(null);
    const [moves, setMoves] = useState(null);
    const sp = dex.species.get(set.species);
    const level = set.level || 100;
    const evs = { ...ZERO, ...(set.evs || {}) };
    const ivs = { ...PERFECT, ...(set.ivs || {}) };
    const used = STAT_IDS.reduce((a, k) => a + evs[k], 0);
    const art = sprite(sp.name, { style: "gen5ani", shiny: !!set.shiny });

    useEffect(() => {
        let live = true;
        setMoves(null);
        if (allowAll) setMoves(MOVES);
        else learnable(sp.name).then((m) => live && setMoves(m.length ? m : MOVES));
        return () => {
            live = false;
        };
    }, [sp.name, allowAll]);

    function setEv(k, v) {
        const others = used - evs[k];
        const val = Math.max(0, Math.min(252, v, 510 - others));
        update({ evs: { ...evs, [k]: val } });
    }

    function applyPreset(p) {
        update({ evs: { ...ZERO, ...p.evs }, nature: p.nature, ivs: { ...PERFECT, ...(p.ivs || {}) } });
    }

    const moveSlots = [0, 1, 2, 3].map((i) => (set.moves || [])[i] || "");
    const genders = sp.gender ? [] : ["", "M", "F"];

    return (
        <div className="pk-editor">
            <div className="pk-editor-top">
                <div className="pk-editor-art">
                    <img src={art.url} width={art.w * 1.5} height={art.h * 1.5} alt={sp.name} referrerPolicy="no-referrer" style={{ imageRendering: "pixelated" }} />
                </div>
                <div className="pk-editor-fields">
                    <div className="pk-field-row">
                        <label className="pk-lab is-wide">
                            <span>Pokémon</span>
                            <button type="button" className="pk-pickbtn" onClick={() => setPicking("species")}>
                                <span className="pk-icon" style={icon(sp.name)} />
                                <span>{sp.name}</span>
                                <span className="pk-types">
                                    {sp.types.map((t) => (
                                        <TypeChip key={t} type={t} small />
                                    ))}
                                </span>
                            </button>
                        </label>
                        <label className="pk-lab is-wide">
                            <span>Item</span>
                            <button type="button" className="pk-pickbtn" onClick={() => setPicking("item")}>
                                {set.item ? <span className="pk-item-icon" style={itemIcon(set.item)} /> : null}
                                <span>{set.item || "No item"}</span>
                            </button>
                        </label>
                    </div>
                    <div className="pk-field-row">
                        <label className="pk-lab">
                            <span>Nickname</span>
                            <input className="pk-input" value={set.name || ""} placeholder={sp.baseSpecies} onChange={(e) => update({ name: e.target.value })} />
                        </label>
                        <label className="pk-lab is-narrow">
                            <span>Level</span>
                            <input className="pk-input" type="number" min="1" max="100" value={level} onChange={(e) => update({ level: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })} />
                        </label>
                        <label className="pk-lab">
                            <span>Ability</span>
                            <select className="pk-select" value={set.ability || ""} onChange={(e) => update({ ability: e.target.value })}>
                                {[...new Set([...Object.values(sp.abilities), set.ability].filter(Boolean))].map((a) => (
                                    <option key={a} value={a}>
                                        {a}
                                        {sp.abilities.H === a ? " (H)" : ""}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="pk-lab">
                            <span>Tera type</span>
                            <select className="pk-select" value={set.teraType || sp.types[0]} onChange={(e) => update({ teraType: e.target.value })}>
                                {[...TYPES, "Stellar"].map((t) => (
                                    <option key={t}>{t}</option>
                                ))}
                            </select>
                        </label>
                        {genders.length > 0 && (
                            <label className="pk-lab is-narrow">
                                <span>Gender</span>
                                <select className="pk-select" value={set.gender || ""} onChange={(e) => update({ gender: e.target.value })}>
                                    <option value="">Any</option>
                                    <option value="M">Male</option>
                                    <option value="F">Female</option>
                                </select>
                            </label>
                        )}
                        <label className="pk-check pk-lab-check">
                            <input type="checkbox" checked={!!set.shiny} onChange={(e) => update({ shiny: e.target.checked })} /> Shiny
                        </label>
                    </div>
                    {set.ability && <p className="pk-hint">{dex.abilities.get(set.ability).shortDesc}</p>}
                    {set.item && <p className="pk-hint">{dex.items.get(set.item).shortDesc}</p>}
                </div>
            </div>

            <h4 className="label pk-editor-h">Moves</h4>
            <div className="pk-move-slots">
                {moveSlots.map((m, i) => {
                    const mv = m ? dex.moves.get(m) : null;
                    return (
                        <button key={i} type="button" className="pk-pickbtn pk-move-slot" onClick={() => setPicking("move" + i)}>
                            {mv ? (
                                <>
                                    <span className="pk-move-slot-name">{mv.name}</span>
                                    <TypeChip type={mv.type} small />
                                    <span className="pk-move-slot-meta">
                                        {mv.category}
                                        {mv.basePower ? ` · ${mv.basePower}` : ""}
                                    </span>
                                </>
                            ) : (
                                <span className="pk-move-slot-empty">+ Move {i + 1}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            <h4 className="label pk-editor-h">Stats</h4>
            <div className="pk-presets">
                {PRESETS.map((p) => (
                    <button key={p.id} type="button" className="pk-preset" onClick={() => applyPreset(p)} title={`${Object.entries(p.evs).map(([k, v]) => `${v} ${STAT_NAMES[k]}`).join(" / ")} · ${p.nature}`}>
                        {p.label}
                    </button>
                ))}
            </div>
            <div className="pk-toolbar pk-stat-tools">
                <label className="pk-lab">
                    <span>Nature</span>
                    <select className="pk-select" value={set.nature || "Serious"} onChange={(e) => update({ nature: e.target.value })}>
                        {NATURES.map((n) => (
                            <option key={n.name} value={n.name}>
                                {natureLabel(n)}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="pk-lab">
                    <span>IVs</span>
                    <select className="pk-select" value="" onChange={(e) => e.target.value && update({ ivs: { ...PERFECT, ...IV_PRESETS.find((p) => p.id === e.target.value).ivs } })}>
                        <option value="">Set IVs…</option>
                        {IV_PRESETS.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.label}
                            </option>
                        ))}
                    </select>
                </label>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => update({ evs: { ...ZERO } })}>
                    Clear EVs
                </button>
                <span className={"label pk-ev-left" + (used > 508 ? " is-full" : "")}>{510 - used} EVs left</span>
            </div>
            <div className="pk-stat-table">
                <div className="pk-stat-row pk-stat-headrow label">
                    <span>Stat</span>
                    <span>Base</span>
                    <span>EVs</span>
                    <span />
                    <span>IV</span>
                    <span>Total</span>
                </div>
                {STAT_IDS.map((k) => {
                    const n = dex.natures.get(set.nature || "Serious");
                    const mark = n.plus === k ? "+" : n.minus === k ? "−" : "";
                    const total = calcStat(k, sp.baseStats[k], ivs[k], evs[k], level, set.nature);
                    return (
                        <div key={k} className="pk-stat-row">
                            <span className={"pk-stat-name" + (mark === "+" ? " is-up" : mark === "−" ? " is-down" : "")}>
                                {STAT_NAMES[k]}
                                {mark}
                            </span>
                            <span className="pk-stat-base">
                                <span className="pk-stat-base-num">{sp.baseStats[k]}</span>
                                <span className="pk-stat-bar">
                                    <span style={{ width: Math.min(100, (sp.baseStats[k] / 180) * 100) + "%" }} />
                                </span>
                            </span>
                            <input type="range" min="0" max="252" step="4" value={evs[k]} onChange={(e) => setEv(k, Number(e.target.value))} aria-label={`${STAT_NAMES[k]} EVs`} />
                            <input className="pk-input pk-num" type="number" min="0" max="252" value={evs[k]} onChange={(e) => setEv(k, Number(e.target.value) || 0)} aria-label={`${STAT_NAMES[k]} EVs value`} />
                            <input
                                className="pk-input pk-num"
                                type="number"
                                min="0"
                                max="31"
                                value={ivs[k]}
                                onChange={(e) => update({ ivs: { ...ivs, [k]: Math.max(0, Math.min(31, Number(e.target.value) || 0)) } })}
                                aria-label={`${STAT_NAMES[k]} IV`}
                            />
                            <span className="pk-stat-total">{total}</span>
                        </div>
                    );
                })}
            </div>

            {picking === "species" && (
                <SpeciesPicker
                    allowPast={allowAll}
                    current={sp.id}
                    onClose={() => setPicking(null)}
                    onPick={(s) => {
                        const keep = dex.species.get(set.species).baseSpecies === s.baseSpecies;
                        update(keep ? { species: s.name } : { species: s.name, ...defaultsFor(s.name), moves: [], item: set.item });
                        setPicking(null);
                    }}
                />
            )}
            {picking === "item" && (
                <ItemPicker
                    allowPast={allowAll}
                    current={dex.items.get(set.item || "").id}
                    onClose={() => setPicking(null)}
                    onPick={(i) => {
                        update({ item: i.id ? i.name : "" });
                        setPicking(null);
                    }}
                />
            )}
            {picking?.startsWith("move") && (
                <MovePicker
                    moves={moves || []}
                    loading={!moves}
                    current={dex.moves.get(moveSlots[Number(picking.slice(4))] || "").id}
                    onClose={() => setPicking(null)}
                    onPick={(m) => {
                        const i = Number(picking.slice(4));
                        const next = [...moveSlots];
                        // Picking a move already in another slot swaps them.
                        const dup = next.findIndex((x, j) => j !== i && m.id && dex.moves.get(x).id === m.id);
                        if (dup >= 0) next[dup] = next[i];
                        next[i] = m.id ? m.name : "";
                        update({ moves: next.filter(Boolean) });
                        setPicking(null);
                    }}
                />
            )}
        </div>
    );
}

export default function TeamTab({ text, setText, format, setFormat, onBattle }) {
    const [mode, setMode] = useState("build");
    const [sets, setSets] = useState(() => parse(text));
    const [sel, setSel] = useState(0);
    const [adding, setAdding] = useState(false);
    const [gen, setGen] = useState("gen9randombattle");
    const [problems, setProblems] = useState(null);
    const [checking, setChecking] = useState(false);
    const [copied, setCopied] = useState(false);
    const exported = useRef(text);
    const teamFormat = format.includes("random") ? "gen9ou" : format;
    const allowAll = teamFormat.includes("nationaldex") || teamFormat.includes("customgame");

    // Pastes and rolls come in as text; edits in the builder go out as text.
    useEffect(() => {
        if (text === exported.current) return;
        exported.current = text;
        setSets(parse(text));
    }, [text]);

    function commit(next) {
        setSets(next);
        const t = exportSets(next);
        exported.current = t;
        setText(t);
        setProblems(null);
    }

    const current = sets[sel];

    async function roll() {
        setText((await call("random", { format: gen })).trim());
        setSel(0);
        setProblems(null);
    }

    async function check() {
        setChecking(true);
        try {
            setProblems((await call("validate", { format: teamFormat, text })) || []);
        } catch (e) {
            setProblems([e.message]);
        }
        setChecking(false);
    }

    async function copy() {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch (e) {}
    }

    const slots = useMemo(() => Array.from({ length: 6 }, (_, i) => sets[i] || null), [sets]);

    return (
        <div className="pk-team">
            <div className="pk-toolbar">
                <div className="toy-buttons" role="tablist">
                    <button type="button" className={"toy-tool" + (mode === "build" ? " is-on" : "")} onClick={() => setMode("build")}>
                        Builder
                    </button>
                    <button type="button" className={"toy-tool" + (mode === "paste" ? " is-on" : "")} onClick={() => setMode("paste")}>
                        Import / export
                    </button>
                </div>
                <select className="pk-select" value={gen} onChange={(e) => setGen(e.target.value)} aria-label="Random team generation">
                    {RANDOM_FORMATS.map((f) => (
                        <option key={f.value} value={f.value}>
                            {f.label.replace("Random Battle", "Random team")}
                        </option>
                    ))}
                </select>
                <button type="button" className="btn btn-outline btn-sm" onClick={roll}>
                    Roll a team
                </button>
                <button type="button" className="btn btn-outline btn-sm" disabled={!sets.length} onClick={() => commit([])}>
                    Clear
                </button>
            </div>

            {mode === "paste" ? (
                <div className="pk-paste-wrap">
                    <textarea
                        className="pk-paste"
                        value={text}
                        spellCheck={false}
                        onChange={(e) => {
                            setText(e.target.value);
                            setProblems(null);
                        }}
                        placeholder={"Paste a team in Showdown format, e.g.\n\nGarchomp @ Rocky Helmet\nAbility: Rough Skin\nTera Type: Steel\nEVs: 252 HP / 4 Def / 252 Spe\nJolly Nature\n- Earthquake\n- Dragon Tail\n- Stealth Rock\n- Spikes"}
                    />
                    <button type="button" className="btn btn-outline btn-sm" onClick={copy} disabled={!text}>
                        {copied ? "Copied" : "Copy team"}
                    </button>
                </div>
            ) : (
                <div className="pk-builder">
                    <div className="pk-slots">
                        {slots.map((s, i) =>
                            s ? (
                                <div key={i} className={"pk-slot" + (i === sel ? " is-on" : "")}>
                                    <button type="button" className="pk-slot-main" onClick={() => setSel(i)}>
                                        <span className="pk-icon" style={icon(s.species)} />
                                        <span className="pk-slot-text">
                                            <strong>{s.name || s.species}</strong>
                                            <span>{s.item || "No item"}</span>
                                        </span>
                                    </button>
                                    <div className="pk-slot-actions">
                                        {i > 0 && (
                                            <button
                                                type="button"
                                                className="toy-tool"
                                                title="Move up"
                                                aria-label="Move up"
                                                onClick={() => {
                                                    const next = [...sets];
                                                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                                                    commit(next);
                                                    setSel(i - 1);
                                                }}
                                            >
                                                ↑
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className="toy-tool"
                                            title="Remove"
                                            aria-label="Remove"
                                            onClick={() => {
                                                commit(sets.filter((_, j) => j !== i));
                                                setSel(Math.max(0, Math.min(sel, sets.length - 2)));
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                i === sets.length && (
                                    <button key={i} type="button" className="pk-slot pk-slot-add" onClick={() => setAdding(true)}>
                                        + Add Pokémon
                                    </button>
                                )
                            )
                        )}
                        <p className="label pk-slots-note">The first Pokémon leads.</p>
                    </div>
                    <div className="pk-builder-main">
                        {current ? (
                            <SetEditor key={sel} set={current} allowAll={allowAll} update={(patch) => commit(sets.map((s, j) => (j === sel ? { ...s, ...patch } : s)))} />
                        ) : (
                            <div className="pk-builder-empty">
                                <p className="pk-overlay-title">Build a team.</p>
                                <p className="label">Add up to six Pokémon, roll a random team, or paste one in.</p>
                                <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
                                    Add a Pokémon
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="pk-toolbar pk-team-foot">
                <select className="pk-select" value={teamFormat} onChange={(e) => setFormat(e.target.value)} aria-label="Format">
                    {TEAM_FORMATS.map((f) => (
                        <option key={f.value} value={f.value}>
                            {f.label.replace("Your team · ", "")}
                        </option>
                    ))}
                </select>
                <button type="button" className="btn btn-outline btn-sm" onClick={check} disabled={!text || checking}>
                    {checking ? "Checking…" : "Check legality"}
                </button>
                <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!sets.length}
                    onClick={() => {
                        setFormat(teamFormat);
                        onBattle();
                    }}
                >
                    Battle with this team
                </button>
            </div>
            {problems && (
                <div className={"pk-problems" + (problems.length ? "" : " is-ok")}>
                    {problems.length ? problems.map((p, i) => <p key={i}>{p}</p>) : <p>Legal in this format.</p>}
                </div>
            )}

            {adding && (
                <SpeciesPicker
                    allowPast={allowAll}
                    onClose={() => setAdding(false)}
                    onPick={(s) => {
                        const next = [...sets, { name: "", species: s.name, item: "", moves: [], level: 100, ...defaultsFor(s.name) }].slice(0, 6);
                        commit(next);
                        setSel(next.length - 1);
                        setAdding(false);
                    }}
                />
            )}
        </div>
    );
}
