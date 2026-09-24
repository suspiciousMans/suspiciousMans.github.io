import { TYPE_COLORS } from "./look.js";

export function TypeChip({ type, small, tera }) {
    if (!type) return null;
    return (
        <span className={"pk-type" + (small ? " is-small" : "") + (tera ? " is-tera" : "")} style={{ "--type": TYPE_COLORS[type] || TYPE_COLORS["???"] }}>
            {tera ? "Tera " : ""}
            {type}
        </span>
    );
}

export function StatBars({ stats }) {
    const names = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    return (
        <dl className="pk-stats">
            {Object.entries(names).map(([k, label]) => (
                <div key={k}>
                    <dt>{label}</dt>
                    <dd>
                        <span className="pk-stat-num">{stats[k]}</span>
                        <span className="pk-stat-bar">
                            <span style={{ width: Math.min(100, (stats[k] / 200) * 100) + "%" }} />
                        </span>
                    </dd>
                </div>
            ))}
            <div className="pk-stats-total">
                <dt>Total</dt>
                <dd>{total}</dd>
            </div>
        </dl>
    );
}
