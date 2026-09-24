import { useState } from "react";
import { call } from "./client.js";
import { icon, itemIcon } from "./look.js";
import { TypeChip } from "./bits.jsx";
import { RANDOM_FORMATS, TEAM_FORMATS } from "./BattleTab.jsx";

// Team editing happens in Showdown's own paste format, so a team copied out
// of the real teambuilder drops straight in, and the export goes back out.
export default function TeamTab({ text, setText, team, format, setFormat, onBattle }) {
    const [gen, setGen] = useState("gen9randombattle");
    const [problems, setProblems] = useState(null);
    const [checking, setChecking] = useState(false);
    const [copied, setCopied] = useState(false);
    const teamFormat = format.includes("random") ? "gen9ou" : format;

    async function roll() {
        const t = await call("random", { format: gen });
        setText(t.trim());
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

    return (
        <div className="pk-team">
            <div className="pk-team-edit">
                <div className="pk-toolbar">
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
                    <button type="button" className="btn btn-outline btn-sm" onClick={copy} disabled={!text}>
                        {copied ? "Copied" : "Copy"}
                    </button>
                </div>
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
                <div className="pk-toolbar">
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
                        disabled={!team.length}
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
            </div>
            <div className="pk-team-list">
                {team.length === 0 && <p className="label">Your team shows up here as you type.</p>}
                {team.map((s, i) => (
                    <article className="pk-set" key={i}>
                        <div className="pk-set-head">
                            <span className="pk-icon" style={icon(s.species)} />
                            <strong>{s.name && s.name !== s.species ? `${s.name} (${s.species})` : s.species}</strong>
                            {s.level && s.level !== 100 ? <span className="label">L{s.level}</span> : null}
                        </div>
                        <div className="pk-set-meta">
                            {s.item && (
                                <span className="pk-set-item">
                                    <span className="pk-item-icon" style={itemIcon(s.item)} />
                                    {s.item}
                                </span>
                            )}
                            {s.ability && <span>{s.ability}</span>}
                            {s.teraType && <TypeChip type={s.teraType} small tera />}
                        </div>
                        <ul className="pk-set-moves">
                            {(s.moves || []).map((m) => (
                                <li key={m}>{m}</li>
                            ))}
                        </ul>
                    </article>
                ))}
            </div>
        </div>
    );
}
