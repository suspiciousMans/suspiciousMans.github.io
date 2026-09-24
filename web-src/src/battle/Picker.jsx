import { useEffect, useMemo, useRef, useState } from "react";
import { icon, itemIcon } from "./look.js";
import { TypeChip } from "./bits.jsx";
import { SPECIES, ITEMS, TYPES, STAT_IDS, STAT_NAMES } from "./dexdata.js";

// A searchable pick list in an overlay, like Showdown's teambuilder lists.
// Enter picks the top row, Escape closes, and long lists grow as you scroll.
function Picker({ title, rows, search, sorts, filters, render, head, onPick, onClose, current }) {
    const [q, setQ] = useState("");
    const [sort, setSort] = useState(sorts?.[0]?.id || "");
    const [filter, setFilter] = useState("");
    const [limit, setLimit] = useState(120);
    const inputRef = useRef(null);
    const query = q.trim().toLowerCase();

    useEffect(() => {
        inputRef.current?.focus();
        const onKey = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    useEffect(() => setLimit(120), [q, sort, filter]);

    const list = useMemo(() => {
        let out = rows.filter((r) => (!query || search(r).toLowerCase().includes(query)) && (!filter || filters.test(r, filter)));
        const s = sorts?.find((x) => x.id === sort);
        if (s?.cmp) out = [...out].sort(s.cmp);
        // Exact and prefix matches first.
        if (query) {
            const rank = (r) => {
                const n = search(r).toLowerCase();
                return n.startsWith(query) ? 0 : 1;
            };
            out = [...out].sort((a, b) => rank(a) - rank(b));
        }
        // "No item" / "No move" stays on top.
        return [...out.filter((r) => r.id === ""), ...out.filter((r) => r.id !== "")];
    }, [rows, query, sort, filter, search, sorts, filters]);

    return (
        <div className="pk-picker-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="pk-picker" role="dialog" aria-label={title}>
                <div className="pk-picker-top">
                    <span className="label">{title}</span>
                    <button type="button" className="toy-tool pk-picker-close" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>
                <div className="pk-toolbar">
                    <input
                        ref={inputRef}
                        className="pk-input"
                        type="search"
                        placeholder="Search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && list[0] && onPick(list[0])}
                    />
                    {filters && (
                        <select className="pk-select" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={filters.label}>
                            <option value="">{filters.all}</option>
                            {filters.options.map((o) => (
                                <option key={o.value ?? o} value={o.value ?? o}>
                                    {o.label ?? o}
                                </option>
                            ))}
                        </select>
                    )}
                    {sorts && sorts.length > 1 && (
                        <select className="pk-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
                            {sorts.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    )}
                    <span className="label">{list.length}</span>
                </div>
                {head && <div className="pk-pick-row pk-pick-head">{head}</div>}
                <div
                    className="pk-picker-list"
                    onScroll={(e) => {
                        const el = e.currentTarget;
                        if (el.scrollTop + el.clientHeight > el.scrollHeight - 400 && limit < list.length) setLimit(limit + 120);
                    }}
                >
                    {list.slice(0, limit).map((r, i) => (
                        <button key={r.id || i} type="button" className={"pk-pick-row" + (current && r.id === current ? " is-on" : "")} onClick={() => onPick(r)}>
                            {render(r)}
                        </button>
                    ))}
                    {list.length === 0 && <p className="label pk-picker-empty">Nothing matches.</p>}
                </div>
            </div>
        </div>
    );
}

const statCols = (s) =>
    STAT_IDS.map((k) => (
        <span key={k} className="pk-pick-num">
            {s.baseStats[k]}
        </span>
    ));

const bst = (s) => STAT_IDS.reduce((a, k) => a + s.baseStats[k], 0);

export function SpeciesPicker({ onPick, onClose, current, allowPast }) {
    const rows = useMemo(() => SPECIES.filter((s) => allowPast || !s.isNonstandard), [allowPast]);
    const sorts = useMemo(
        () => [
            { id: "dex", label: "Dex order", cmp: (a, b) => a.num - b.num },
            { id: "name", label: "Name", cmp: (a, b) => a.name.localeCompare(b.name) },
            { id: "bst", label: "Base stat total", cmp: (a, b) => bst(b) - bst(a) },
            ...STAT_IDS.map((k) => ({ id: k, label: `Highest ${STAT_NAMES[k]}`, cmp: (a, b) => b.baseStats[k] - a.baseStats[k] })),
        ],
        []
    );
    const filters = useMemo(
        () => ({
            label: "Type",
            all: "Any type",
            options: TYPES,
            test: (s, t) => s.types.includes(t),
        }),
        []
    );
    return (
        <Picker
            title="Pick a Pokémon"
            rows={rows}
            current={current}
            search={(s) => s.name}
            sorts={sorts}
            filters={filters}
            onPick={onPick}
            onClose={onClose}
            head={
                <>
                    <span className="pk-pick-icon" />
                    <span className="pk-pick-name">Pokémon</span>
                    <span className="pk-pick-types">Types</span>
                    <span className="pk-pick-tier">Tier</span>
                    {STAT_IDS.map((k) => (
                        <span key={k} className="pk-pick-num">
                            {STAT_NAMES[k]}
                        </span>
                    ))}
                    <span className="pk-pick-num">BST</span>
                </>
            }
            render={(s) => (
                <>
                    <span className="pk-icon pk-pick-icon" style={icon(s.name)} />
                    <span className="pk-pick-name">{s.name}</span>
                    <span className="pk-pick-types">
                        {s.types.map((t) => (
                            <TypeChip key={t} type={t} small />
                        ))}
                    </span>
                    <span className="pk-pick-tier">{s.tier}</span>
                    {statCols(s)}
                    <span className="pk-pick-num is-strong">{bst(s)}</span>
                </>
            )}
        />
    );
}

// Items people actually use, shown first.
const POPULAR = ["Leftovers", "Choice Band", "Choice Specs", "Choice Scarf", "Life Orb", "Focus Sash", "Heavy-Duty Boots", "Assault Vest", "Rocky Helmet", "Booster Energy", "Eviolite", "Sitrus Berry", "Lum Berry", "Expert Belt", "Light Clay", "Black Sludge", "Air Balloon", "Weakness Policy", "Covert Cloak", "Loaded Dice", "Clear Amulet", "Mirror Herb", "Protective Pads", "Throat Spray", "White Herb", "Flame Orb", "Toxic Orb"];

export function ItemPicker({ onPick, onClose, current, allowPast }) {
    const rows = useMemo(() => {
        const pool = ITEMS.filter((i) => allowPast || !i.isNonstandard);
        const pop = POPULAR.map((n) => pool.find((i) => i.name === n)).filter(Boolean);
        const rest = pool.filter((i) => !POPULAR.includes(i.name)).sort((a, b) => a.name.localeCompare(b.name));
        return [{ id: "", name: "No item", shortDesc: "Hold nothing." }, ...pop, ...rest];
    }, [allowPast]);
    return (
        <Picker
            title="Pick an item"
            rows={rows}
            current={current}
            search={(i) => i.name + " " + (i.shortDesc || i.desc || "")}
            onPick={onPick}
            onClose={onClose}
            render={(i) => (
                <>
                    <span className="pk-item-icon pk-pick-icon-sm" style={i.id ? itemIcon(i.name) : undefined} />
                    <span className="pk-pick-name">{i.name}</span>
                    <span className="pk-pick-desc">{i.shortDesc || i.desc}</span>
                </>
            )}
        />
    );
}

export function MovePicker({ moves, onPick, onClose, current, loading }) {
    const sorts = useMemo(
        () => [
            { id: "name", label: "Name", cmp: (a, b) => a.name.localeCompare(b.name) },
            { id: "power", label: "Power", cmp: (a, b) => (b.basePower || 0) - (a.basePower || 0) },
            { id: "type", label: "Type", cmp: (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name) },
        ],
        []
    );
    const filters = useMemo(
        () => ({
            label: "Filter",
            all: "All moves",
            options: [
                { value: "Physical", label: "Physical" },
                { value: "Special", label: "Special" },
                { value: "Status", label: "Status" },
                ...TYPES.map((t) => ({ value: "type:" + t, label: t })),
            ],
            test: (m, f) => (f.startsWith("type:") ? m.type === f.slice(5) : m.category === f),
        }),
        []
    );
    const rows = useMemo(() => [{ id: "", name: "No move", type: "", category: "", shortDesc: "Leave this slot empty." }, ...moves], [moves]);
    return (
        <Picker
            title={loading ? "Loading moves…" : "Pick a move"}
            rows={rows}
            current={current}
            search={(m) => m.name + " " + (m.type || "")}
            sorts={sorts}
            filters={filters}
            onPick={onPick}
            onClose={onClose}
            head={
                <>
                    <span className="pk-pick-name">Move</span>
                    <span className="pk-pick-types">Type</span>
                    <span className="pk-pick-cat">Cat.</span>
                    <span className="pk-pick-num">Pow</span>
                    <span className="pk-pick-num">Acc</span>
                    <span className="pk-pick-num">PP</span>
                    <span className="pk-pick-desc">Effect</span>
                </>
            }
            render={(m) => (
                <>
                    <span className="pk-pick-name">{m.name}</span>
                    <span className="pk-pick-types">{m.type && <TypeChip type={m.type} small />}</span>
                    <span className="pk-pick-cat">{m.category}</span>
                    <span className="pk-pick-num">{m.id ? m.basePower || "—" : ""}</span>
                    <span className="pk-pick-num">{m.id ? (m.accuracy === true ? "—" : m.accuracy) : ""}</span>
                    <span className="pk-pick-num">{m.id ? m.pp : ""}</span>
                    <span className="pk-pick-desc">{m.shortDesc || m.desc}</span>
                </>
            )}
        />
    );
}
