import { useEffect, useMemo, useState } from "react";
import { Dex } from "@pkmn/dex";
import { sprite, icon, itemIcon } from "./look.js";
import { TypeChip, StatBars } from "./bits.jsx";

const dex = Dex.forGen(9);
const shown = (x) => x.exists && (!x.isNonstandard || x.isNonstandard === "Past");
const SPECIES = dex.species.all().filter((s) => shown(s) && s.num > 0);
const MOVES = dex.moves.all().filter((m) => shown(m) && !m.isMax && !m.isZ);
const ITEMS = dex.items.all().filter(shown);
const ABILITIES = dex.abilities.all().filter((a) => shown(a) && a.num > 0);
const TYPES = dex.types.all().filter((t) => t.exists && t.name !== "Stellar").map((t) => t.name);

const KINDS = [
    { id: "pokemon", label: "Pokémon" },
    { id: "moves", label: "Moves" },
    { id: "items", label: "Items" },
    { id: "abilities", label: "Abilities" },
];
const PAGE = 60;

function match(q, ...fields) {
    if (!q) return true;
    return fields.some((f) => f && f.toLowerCase().includes(q));
}

function MoveRow({ m }) {
    return (
        <div className="pk-row">
            <strong className="pk-row-name">{m.name}</strong>
            <TypeChip type={m.type} small />
            <span className="pk-row-cell">{m.category}</span>
            <span className="pk-row-cell">{m.basePower || "—"}</span>
            <span className="pk-row-cell">{m.accuracy === true ? "—" : m.accuracy + "%"}</span>
            <span className="pk-row-cell">{m.pp} PP</span>
            <span className="pk-row-desc">{m.shortDesc || m.desc}</span>
        </div>
    );
}

function SpeciesDetail({ s, onPick }) {
    const [shiny, setShiny] = useState(false);
    const [moves, setMoves] = useState(null);
    useEffect(() => {
        let live = true;
        setMoves(null);
        const load = async (sp) => {
            const found = new Set();
            // Formes inherit most moves from the base species and pre-evolutions.
            for (let cur = sp; cur; cur = cur.prevo ? dex.species.get(cur.prevo) : null) {
                for (const id of [cur.id, cur.changesFrom && dex.species.get(cur.changesFrom).id, dex.species.get(cur.baseSpecies).id]) {
                    if (!id) continue;
                    const ls = await dex.learnsets.get(id);
                    Object.keys(ls?.learnset || {}).forEach((k) => found.add(k));
                }
            }
            return [...found].map((id) => dex.moves.get(id)).filter(shown).sort((a, b) => a.name.localeCompare(b.name));
        };
        load(s).then((m) => live && setMoves(m));
        return () => {
            live = false;
        };
    }, [s]);
    const art = sprite(s.name, { style: "ani", shiny });
    const chain = [];
    let base = s;
    while (base.prevo) base = dex.species.get(base.prevo);
    const walk = (sp, depth) => {
        chain.push({ sp, depth });
        sp.evos.forEach((e) => walk(dex.species.get(e), depth + 1));
    };
    walk(base, 0);

    return (
        <div className="pk-detail">
            <div className="pk-detail-top">
                <div className="pk-detail-art">
                    <img src={art.url} width={art.w} height={art.h} alt={s.name} referrerPolicy="no-referrer" style={{ imageRendering: art.pixelated ? "pixelated" : "auto" }} />
                    <button type="button" className={"toy-tool" + (shiny ? " is-on" : "")} onClick={() => setShiny(!shiny)}>
                        Shiny
                    </button>
                </div>
                <div className="pk-detail-info">
                    <p className="label">
                        #{String(s.num).padStart(4, "0")} · {s.tier || "—"} · {s.weightkg} kg
                    </p>
                    <h3 className="pk-detail-name">{s.name}</h3>
                    <div className="pk-types">
                        {s.types.map((t) => (
                            <TypeChip key={t} type={t} />
                        ))}
                    </div>
                    <ul className="pk-abilities">
                        {Object.entries(s.abilities).map(([slot, name]) => (
                            <li key={slot}>
                                <strong>{name}</strong>
                                {slot === "H" && <span className="label"> Hidden</span>}
                                <span> {dex.abilities.get(name).shortDesc}</span>
                            </li>
                        ))}
                    </ul>
                    <StatBars stats={s.baseStats} />
                </div>
            </div>
            {chain.length > 1 && (
                <div className="pk-chain">
                    {chain.map(({ sp, depth }) => (
                        <button key={sp.id} type="button" className={"pk-chain-mon" + (sp.id === s.id ? " is-on" : "")} onClick={() => onPick(sp)} style={{ marginLeft: depth * 12 }}>
                            <span className="pk-icon" style={icon(sp.name)} />
                            {sp.name}
                        </button>
                    ))}
                </div>
            )}
            <h4 className="label">Moves it can learn {moves ? `(${moves.length})` : ""}</h4>
            <div className="pk-rows">{moves ? moves.map((m) => <MoveRow key={m.id} m={m} />) : <p className="label">Loading…</p>}</div>
        </div>
    );
}

export default function DexTab() {
    const [kind, setKind] = useState("pokemon");
    const [q, setQ] = useState("");
    const [type, setType] = useState("");
    const [limit, setLimit] = useState(PAGE);
    const [picked, setPicked] = useState(null);
    const query = q.trim().toLowerCase();

    useEffect(() => setLimit(PAGE), [kind, q, type]);

    const list = useMemo(() => {
        if (kind === "pokemon") return SPECIES.filter((s) => match(query, s.name) && (!type || s.types.includes(type)));
        if (kind === "moves") return MOVES.filter((m) => match(query, m.name, m.shortDesc) && (!type || m.type === type));
        if (kind === "items") return ITEMS.filter((i) => match(query, i.name, i.shortDesc || i.desc));
        return ABILITIES.filter((a) => match(query, a.name, a.shortDesc));
    }, [kind, query, type]);

    return (
        <div className="pk-dex">
            <div className="pk-toolbar">
                <div className="toy-buttons" role="tablist">
                    {KINDS.map((k) => (
                        <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} className={"toy-tool" + (kind === k.id ? " is-on" : "")} onClick={() => setKind(k.id)}>
                            {k.label}
                        </button>
                    ))}
                </div>
                <input className="pk-input" type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
                {(kind === "pokemon" || kind === "moves") && (
                    <select className="pk-select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
                        <option value="">Any type</option>
                        {TYPES.map((t) => (
                            <option key={t}>{t}</option>
                        ))}
                    </select>
                )}
                <span className="label">{list.length} found</span>
            </div>

            {kind === "pokemon" && picked && <SpeciesDetail s={picked} onPick={setPicked} />}

            {kind === "pokemon" && (
                <div className="pk-grid">
                    {list.slice(0, limit).map((s) => (
                        <button key={s.id} type="button" className={"pk-tile" + (picked?.id === s.id ? " is-on" : "")} onClick={() => setPicked(s)}>
                            <span className="pk-icon" style={icon(s.name)} />
                            <span className="pk-tile-name">{s.name}</span>
                            <span className="pk-tile-types">
                                {s.types.map((t) => (
                                    <TypeChip key={t} type={t} small />
                                ))}
                            </span>
                        </button>
                    ))}
                </div>
            )}
            {kind === "moves" && (
                <div className="pk-rows">
                    {list.slice(0, limit).map((m) => (
                        <MoveRow key={m.id} m={m} />
                    ))}
                </div>
            )}
            {kind === "items" && (
                <div className="pk-rows">
                    {list.slice(0, limit).map((i) => (
                        <div className="pk-row" key={i.id}>
                            <span className="pk-item-icon" style={itemIcon(i.name)} />
                            <strong className="pk-row-name">{i.name}</strong>
                            <span className="pk-row-desc">{i.shortDesc || i.desc}</span>
                        </div>
                    ))}
                </div>
            )}
            {kind === "abilities" && (
                <div className="pk-rows">
                    {list.slice(0, limit).map((a) => (
                        <div className="pk-row" key={a.id}>
                            <strong className="pk-row-name">{a.name}</strong>
                            <span className="pk-row-desc">{a.shortDesc || a.desc}</span>
                        </div>
                    ))}
                </div>
            )}
            {list.length > limit && (
                <button type="button" className="btn btn-outline btn-sm pk-more" onClick={() => setLimit(limit + PAGE * 2)}>
                    Show more
                </button>
            )}
        </div>
    );
}
