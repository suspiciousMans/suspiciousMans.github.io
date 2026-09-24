import { useCallback, useEffect, useRef, useState } from "react";
import { send, listen } from "./client.js";
import { sprite, icon, SPRITE_STYLES, STATUS_LABEL, STAT_LABEL, TYPE_COLORS } from "./look.js";
import { TypeChip } from "./bits.jsx";

export const RANDOM_FORMATS = [9, 8, 7, 6, 5, 4, 3, 2, 1].map((g) => ({ value: `gen${g}randombattle`, label: `Random Battle · Gen ${g}` }));
export const TEAM_FORMATS = [
    { value: "gen9ou", label: "Your team · Gen 9 OU" },
    { value: "gen9ubers", label: "Your team · Gen 9 Ubers" },
    { value: "gen9anythinggoes", label: "Your team · Gen 9 Anything Goes" },
    { value: "gen9nationaldex", label: "Your team · National Dex" },
    { value: "gen9customgame", label: "Your team · Custom (no rules)" },
];

const SPEEDS = [
    { value: 1, label: "1×" },
    { value: 2, label: "2×" },
    { value: 0, label: "Skip" },
];

// How long to hold each replayed line, before the speed setting.
function beat(step) {
    if (step.kind === "move") return 700;
    if (step.kind === "switch" || step.kind === "drag" || step.kind === "faint") return 650;
    if (step.kind === "-damage" || step.kind === "-heal") return 550;
    if (step.kind === "turn") return 250;
    return step.text ? 380 : 0;
}

function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function pct(hp, max) {
    return max ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0;
}

// Showdown's text markup: **bold**, ||exact||rounded|| HP detail, [ability].
function LogLine({ text }) {
    if (text.startsWith("== ")) return <div className="pk-log-turn">{text.replace(/==/g, "").trim()}</div>;
    const clean = text.replace(/\|\|([^|]*)\|\|([^|]*)\|\|/g, "$2");
    const parts = clean.split(/(\*\*[^*]+\*\*)/g);
    const cls = clean.startsWith("[") ? "pk-log-line is-ability" : clean.startsWith("(") ? "pk-log-line is-dim" : "pk-log-line";
    return (
        <div className={cls}>
            {parts.map((p, i) => (p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}
        </div>
    );
}

function HpBar({ hp, max, exact }) {
    const p = pct(hp, max);
    return (
        <div className="pk-hp">
            <div className="pk-hp-track">
                <div className={"pk-hp-fill" + (p <= 20 ? " is-low" : p <= 50 ? " is-mid" : "")} style={{ width: p + "%" }} />
            </div>
            <span className="pk-hp-num">{exact ? `${hp}/${max}` : `${Math.ceil(p)}%`}</span>
        </div>
    );
}

function Boosts({ boosts }) {
    const list = Object.entries(boosts || {}).filter(([, v]) => v);
    if (!list.length) return null;
    return (
        <div className="pk-boosts">
            {list.map(([k, v]) => (
                <span key={k} className={"pk-boost" + (v < 0 ? " is-neg" : "")}>
                    {v > 0 ? "+" : ""}
                    {v} {STAT_LABEL[k] || k}
                </span>
            ))}
        </div>
    );
}

function TeamDots({ side, onRight }) {
    const slots = Array.from({ length: Math.max(side.total || 0, side.team.length) }, (_, i) => side.team[i] || null);
    return (
        <div className={"pk-dots" + (onRight ? " is-right" : "")}>
            {slots.map((m, i) => (
                <span key={i} className={"pk-dot" + (m?.fainted ? " is-out" : "") + (!m ? " is-unknown" : "")} title={m ? m.species : "Not seen yet"} style={m ? icon(m.species) : undefined} />
            ))}
        </div>
    );
}

function MonCard({ mon, side, exact }) {
    if (!mon) return <div className={"pk-card is-" + side} />;
    return (
        <div className={"pk-card is-" + side}>
            <div className="pk-card-head">
                <span className="pk-card-name">{mon.name}</span>
                <span className="pk-card-lv">L{mon.level}</span>
                {mon.status && <span className={"pk-status is-" + mon.status}>{STATUS_LABEL[mon.status] || mon.status}</span>}
                {mon.tera && <TypeChip type={mon.tera} small tera />}
            </div>
            <HpBar hp={mon.hp} max={mon.maxhp} exact={exact} />
            <Boosts boosts={mon.boosts} />
        </div>
    );
}

// Short sprite motions, played with the Web Animations API so the GIF
// itself never reloads.
const MOTION = {
    lunge: (dir) => [{ transform: "translate(0,0)" }, { transform: `translate(${dir * 28}px, ${-dir * 14}px)` }, { transform: "translate(0,0)" }],
    hit: () => [{ opacity: 1 }, { opacity: 0.2, transform: "translateX(-6px)" }, { opacity: 1, transform: "translateX(6px)" }, { opacity: 0.2 }, { opacity: 1, transform: "none" }],
    enter: (dir) => [{ opacity: 0, transform: `translateX(${-dir * 40}px) scale(0.6)` }, { opacity: 1, transform: "none" }],
};

function Sprite({ mon, style, back, fx }) {
    const ref = useRef(null);
    useEffect(() => {
        if (!fx || !ref.current || !ref.current.animate) return;
        ref.current.animate(MOTION[fx.kind](back ? 1 : -1), { duration: fx.kind === "enter" ? 380 : 420, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
    }, [fx, back]);
    return <img ref={ref} className="pk-sprite" alt={mon.species} {...spriteProps(mon, style, back)} />;
}

function Field({ snap, fx, style }) {
    const p1 = snap.p1.active;
    const p2 = snap.p2.active;
    const cond = [snap.weather, snap.terrain, ...snap.pseudo].filter(Boolean);
    return (
        <div className="pk-field">
            <div className="pk-field-conds label">
                {cond.length ? cond.join(" · ") + " · " : ""}Turn {snap.turn || 0}
            </div>
            <div className="pk-foe">
                <MonCard mon={p2} side="foe" />
                <TeamDots side={snap.p2} onRight />
                {snap.p2.conditions.length > 0 && <div className="pk-side-conds label">{snap.p2.conditions.join(" · ")}</div>}
            </div>
            <div className="pk-mine">
                <MonCard mon={p1} side="mine" exact />
                <TeamDots side={snap.p1} />
                {snap.p1.conditions.length > 0 && <div className="pk-side-conds label">{snap.p1.conditions.join(" · ")}</div>}
            </div>
            <div className="pk-spot is-foe">
                {p2 && !p2.fainted && <Sprite key={p2.ident} mon={p2} style={style} fx={fx?.who === "p2" ? fx : null} />}
                <div className="pk-ground" />
            </div>
            <div className="pk-spot is-mine">
                {p1 && !p1.fainted && <Sprite key={p1.ident} mon={p1} style={style} back fx={fx?.who === "p1" ? fx : null} />}
                <div className="pk-ground" />
            </div>
        </div>
    );
}

function spriteProps(mon, style, back) {
    const s = sprite(mon.species, { style, back, shiny: mon.shiny });
    const scale = back ? 1.5 : 1.25;
    return {
        src: s.url,
        width: Math.round(s.w * scale),
        height: Math.round(s.h * scale),
        style: { imageRendering: s.pixelated ? "pixelated" : "auto" },
        referrerPolicy: "no-referrer",
    };
}

function effLabel(eff) {
    if (eff === undefined) return null;
    if (eff === 0) return "No effect";
    if (eff >= 4) return "4× super";
    if (eff >= 2) return "Super";
    if (eff <= 0.25) return "¼ resisted";
    if (eff < 1) return "Resisted";
    return null;
}

function Controls({ request, onChoose, busy }) {
    const [gimmick, setGimmick] = useState("");
    useEffect(() => setGimmick(""), [request]);
    if (!request) return null;
    const side = request.side.pokemon;

    if (request.teamPreview) {
        return (
            <div className="pk-controls">
                <div className="pk-controls-head label">Pick your lead</div>
                <div className="pk-switches">
                    {side.map((p, i) => (
                        <button key={p.ident} type="button" className="pk-switch" disabled={busy} onClick={() => onChoose(`team ${i + 1}`)}>
                            <span className="pk-icon" style={icon(p.details.split(",")[0])} />
                            <span>{p.ident.split(": ")[1]}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    const act = request.active?.[0];
    const force = request.forceSwitch?.[0];
    const trapped = act && (act.trapped || act.maybeTrapped);
    const gimmicks = [];
    if (act && !force) {
        if (act.canTerastallize) gimmicks.push({ id: "terastallize", label: `Tera ${act.canTerastallize}` });
        if (act.canMegaEvo) gimmicks.push({ id: "mega", label: "Mega Evolve" });
        if (act.canUltraBurst) gimmicks.push({ id: "ultra", label: "Ultra Burst" });
        if (act.canDynamax) gimmicks.push({ id: "dynamax", label: act.canGigantamax ? "Gigantamax" : "Dynamax" });
        if (act.canZMove) gimmicks.push({ id: "zmove", label: "Z-Move" });
    }
    let moves = act ? act.moves : [];
    if (gimmick === "dynamax" && act.maxMoves) moves = act.maxMoves.maxMoves.map((m, i) => ({ ...m, move: nameOf(m.move), pp: act.moves[i].pp, maxpp: act.moves[i].maxpp }));
    if (gimmick === "zmove" && act.canZMove) moves = act.moves.map((m, i) => (act.canZMove[i] ? { ...m, ...act.canZMove[i], move: act.canZMove[i].move } : { ...m, disabled: true }));

    return (
        <div className="pk-controls">
            {!force && act && (
                <>
                    <div className="pk-controls-head label">
                        <span>Attack</span>
                        {gimmicks.map((g) => (
                            <label key={g.id} className={"pk-gimmick" + (gimmick === g.id ? " is-on" : "")}>
                                <input type="checkbox" checked={gimmick === g.id} onChange={(e) => setGimmick(e.target.checked ? g.id : "")} />
                                {g.label}
                            </label>
                        ))}
                    </div>
                    <div className="pk-moves">
                        {moves.map((m, i) => {
                            const eff = effLabel(m.eff);
                            const off = busy || m.disabled || (m.pp !== undefined && m.pp <= 0);
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    className="pk-move"
                                    disabled={off}
                                    title={m.desc}
                                    style={{ "--type": TYPE_COLORS[m.type] || TYPE_COLORS["???"] }}
                                    onClick={() => onChoose(`move ${i + 1}${gimmick ? " " + gimmick : ""}`)}
                                >
                                    <span className="pk-move-name">{m.move}</span>
                                    <span className="pk-move-meta">
                                        <TypeChip type={m.type} small />
                                        <span>{m.category === "Status" ? "Status" : m.basePower ? `${m.basePower} BP` : m.category}</span>
                                        {m.pp !== undefined && (
                                            <span className="pk-pp">
                                                {m.pp}/{m.maxpp}
                                            </span>
                                        )}
                                    </span>
                                    {eff && <span className={"pk-eff" + (m.eff > 1 ? " is-up" : " is-down")}>{eff}</span>}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
            <div className="pk-controls-head label">{force ? "Send in a Pokémon" : trapped ? "You can't switch out" : "Switch"}</div>
            <div className="pk-switches">
                {side.map((p, i) => {
                    const [hp, max] = p.condition.split(" ")[0].split("/").map(Number);
                    const fainted = p.condition.endsWith(" fnt");
                    const species = p.details.split(",")[0];
                    return (
                        <button
                            key={p.ident}
                            type="button"
                            className={"pk-switch" + (p.active ? " is-active" : "")}
                            disabled={busy || p.active || fainted || (trapped && !force) || (act && !force && act.trapped)}
                            onClick={() => onChoose(`switch ${i + 1}`)}
                            title={`${species} · ${p.item || "no item"} · ${p.ability || p.baseAbility}\n${p.moves.join(", ")}`}
                        >
                            <span className="pk-icon" style={icon(species)} />
                            <span className="pk-switch-name">{p.ident.split(": ")[1]}</span>
                            <span className="pk-switch-hp">
                                <span style={{ width: (fainted ? 0 : pct(hp, max)) + "%" }} />
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function nameOf(id) {
    return id.replace(/^max/, "Max ").replace(/^gmax/, "G-Max ").replace(/([a-z])([A-Z])/g, "$1 $2");
}

const EMPTY_SNAP = {
    turn: 0,
    weather: "",
    terrain: "",
    pseudo: [],
    p1: { name: "You", total: 6, active: null, team: [], conditions: [] },
    p2: { name: "CPU", total: 6, active: null, team: [], conditions: [] },
};

export default function BattleTab({ team, format, setFormat, startSignal, onEditTeam }) {
    const [snap, setSnap] = useState(EMPTY_SNAP);
    const [log, setLog] = useState([]);
    const [request, setRequest] = useState(null);
    const [busy, setBusy] = useState(false);
    const [ended, setEnded] = useState(null);
    const [error, setError] = useState("");
    const [fx, setFx] = useState(null);
    const [started, setStarted] = useState(false);
    const [speed, setSpeed] = useState(() => (reducedMotion() ? 0 : 1));
    const [style, setStyle] = useState(() => {
        try {
            return localStorage.getItem("pk-sprites") || "gen5ani";
        } catch (e) {
            return "gen5ani";
        }
    });
    const queue = useRef([]);
    const playing = useRef(false);
    const speedRef = useRef(speed);
    speedRef.current = speed;
    const logRef = useRef(null);
    const fxKey = useRef(0);

    const play = useCallback(() => {
        if (playing.current) return;
        playing.current = true;
        const next = () => {
            const item = queue.current.shift();
            if (!item) {
                playing.current = false;
                return;
            }
            if (item.final) {
                setSnap(item.final.snap);
                if (item.final.request) setRequest(item.final.request);
                if (item.final.ended) setEnded(item.final.ended);
                setBusy(!item.final.request && !item.final.ended);
                return next();
            }
            const s = item.step;
            setSnap(s.snap);
            if (s.text) setLog((l) => [...l, s.text]);
            let kind = null;
            let who = s.who;
            if (s.kind === "move") kind = "lunge";
            else if (s.kind === "-damage") kind = "hit";
            else if (s.kind === "switch" || s.kind === "drag") kind = "enter";
            if (kind && who) setFx({ who, kind, key: ++fxKey.current });
            const wait = speedRef.current ? beat(s) / speedRef.current : 0;
            if (wait) setTimeout(next, wait);
            else next();
        };
        next();
    }, []);

    useEffect(
        () =>
            listen((m) => {
                if (m.type === "steps") {
                    for (const step of m.steps) queue.current.push({ step });
                    queue.current.push({ final: m });
                    play();
                } else if (m.type === "choice-error") {
                    setError(m.message.replace(/^\[[^\]]+\]\s*/, ""));
                    setBusy(false);
                } else if (m.type === "error") {
                    setError(m.message);
                    setBusy(false);
                }
            }),
        [play]
    );

    useEffect(() => {
        const el = logRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [log]);

    useEffect(() => {
        try {
            localStorage.setItem("pk-sprites", style);
        } catch (e) {}
    }, [style]);

    const mine = !format.includes("random");
    const lastRandom = useRef("gen9randombattle");
    const lastOwn = useRef("gen9ou");
    if (mine) lastOwn.current = format;
    else lastRandom.current = format;

    // "Battle with this team" in the Team tab starts right away.
    const startRef = useRef(null);
    startRef.current = start;
    useEffect(() => {
        if (startSignal) startRef.current();
    }, [startSignal]);

    function start() {
        const needsTeam = mine;
        if (needsTeam && !team.length) {
            setError("You don't have a team yet. Build or paste one in the Team tab, or pick Random team.");
            return;
        }
        queue.current = [];
        setLog([]);
        setSnap(EMPTY_SNAP);
        setRequest(null);
        setEnded(null);
        setError("");
        setBusy(true);
        setStarted(true);
        send("start", { format, team: needsTeam ? team : null });
    }

    function choose(choice) {
        setError("");
        setBusy(true);
        setRequest(null);
        send("choose", { choice });
    }

    return (
        <div className="pk-battle">
            <div className="pk-toolbar">
                <div className="toy-buttons" role="group" aria-label="Team">
                    <button type="button" className={"toy-tool" + (!mine ? " is-on" : "")} onClick={() => mine && setFormat(lastRandom.current)}>
                        Random team
                    </button>
                    <button type="button" className={"toy-tool" + (mine ? " is-on" : "")} onClick={() => !mine && setFormat(lastOwn.current)}>
                        My team{team.length ? ` (${team.length})` : ""}
                    </button>
                </div>
                <select className="pk-select" value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Format">
                    {(mine ? TEAM_FORMATS : RANDOM_FORMATS).map((f) => (
                        <option key={f.value} value={f.value}>
                            {f.label.replace("Your team · ", "")}
                        </option>
                    ))}
                </select>
                <button type="button" className="btn btn-primary btn-sm" onClick={start}>
                    {started ? "New battle" : "Start battle"}
                </button>
                {started && !ended && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => send("forfeit")}>
                        Forfeit
                    </button>
                )}
                <div className="pk-toolbar-end">
                    <div className="toy-buttons" role="group" aria-label="Sprites">
                        {SPRITE_STYLES.map((s) => (
                            <button key={s.value} type="button" className={"toy-tool" + (style === s.value ? " is-on" : "")} onClick={() => setStyle(s.value)}>
                                {s.label}
                            </button>
                        ))}
                    </div>
                    <div className="toy-buttons" role="group" aria-label="Speed">
                        {SPEEDS.map((s) => (
                            <button key={s.value} type="button" className={"toy-tool" + (speed === s.value ? " is-on" : "")} onClick={() => setSpeed(s.value)}>
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {mine && (
                <div className="pk-myteam">
                    {team.length ? (
                        team.map((s, i) => <span key={i} className="pk-icon" title={s.name || s.species} style={icon(s.species)} />)
                    ) : (
                        <span className="label">No team yet.</span>
                    )}
                    <button type="button" className="btn btn-outline btn-sm" onClick={onEditTeam}>
                        {team.length ? "Edit team" : "Build a team"}
                    </button>
                </div>
            )}
            <div className="pk-arena">
                <div className="pk-stage">
                    <Field snap={snap} fx={fx} style={style} />
                    {!started && (
                        <div className="pk-overlay">
                            <p className="pk-overlay-title">Pick a format and start a battle.</p>
                            <p className="label">You against the CPU, on Pokémon Showdown's own engine.</p>
                        </div>
                    )}
                    {ended && (
                        <div className="pk-overlay">
                            <p className="pk-overlay-title">{ended.winner === "You" ? "You won." : ended.winner ? "The CPU won." : "It's a tie."}</p>
                            <button type="button" className="btn btn-primary btn-sm" onClick={start}>
                                Play again
                            </button>
                        </div>
                    )}
                </div>
                <div className="pk-log" ref={logRef} aria-live="polite">
                    {log.length === 0 && <div className="pk-log-line is-dim">The battle log shows up here.</div>}
                    {log.map((t, i) => (
                        <LogLine key={i} text={t} />
                    ))}
                </div>
            </div>
            {error && <p className="pk-error">{error}</p>}
            <Controls request={request} onChoose={choose} busy={busy} />
            {busy && started && !ended && !request && <p className="pk-waiting label">Waiting for the CPU…</p>}
        </div>
    );
}
