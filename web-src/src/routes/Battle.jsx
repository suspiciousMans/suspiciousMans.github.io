import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Team } from "@pkmn/sets";
import Title from "../components/Title.jsx";
import BattleTab from "../battle/BattleTab.jsx";
import "../battle/battle.css";

// The builder, Pokédex and calc carry their own data sets, so they load on first open.
const TeamTab = lazy(() => import("../battle/TeamTab.jsx"));
const DexTab = lazy(() => import("../battle/DexTab.jsx"));
const CalcTab = lazy(() => import("../battle/CalcTab.jsx"));

const TABS = [
    { id: "battle", label: "Battle" },
    { id: "team", label: "Team" },
    { id: "dex", label: "Pokédex" },
    { id: "calc", label: "Damage calc" },
];

function stored(key, fallback) {
    try {
        return localStorage.getItem(key) ?? fallback;
    } catch (e) {
        return fallback;
    }
}

export default function Battle() {
    const [tab, setTab] = useState("battle");
    const [startSignal, setStartSignal] = useState(0);
    const [format, setFormat] = useState(() => stored("pk-format", stored("pk-team", "") ? "gen9ou" : "gen9randombattle"));
    const [text, setText] = useState(() => stored("pk-team", ""));
    const team = useMemo(() => {
        try {
            return (Team.import(text)?.team || []).filter((p) => p.species);
        } catch (e) {
            return [];
        }
    }, [text]);

    useEffect(() => {
        try {
            localStorage.setItem("pk-team", text);
            localStorage.setItem("pk-format", format);
        } catch (e) {}
    }, [text, format]);

    return (
        <>
            <section className="hero hero-left hero-tight">
                <div className="wrap">
                    <span className="label eyebrow">Play it in browser</span>
                    <Title segments={[{ text: "Battle " }, { text: "sim", accent: true }]} />
                    <p className="lede">
                        Pokémon battles against the computer, running on Pokémon Showdown's own simulator. Every move, ability and item
                        works the way it does there, from Gen 1 to Gen 9. Bring your own team or roll a random one.
                    </p>
                </div>
            </section>
            <section className="section-flush">
                <div className="wrap wrap-wide">
                    <div className="pk-tabs" role="tablist">
                        {TABS.map((t) => (
                            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={"pk-tab" + (tab === t.id ? " is-on" : "")} onClick={() => setTab(t.id)}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div className="pk-shell">
                        <div hidden={tab !== "battle"}>
                            <BattleTab team={team} format={format} setFormat={setFormat} startSignal={startSignal} onEditTeam={() => setTab("team")} />
                        </div>
                        <Suspense fallback={<p className="label pk-loading">Loading…</p>}>
                            {tab === "team" && <TeamTab text={text} setText={setText} format={format} setFormat={setFormat} onBattle={() => {
                                        setTab("battle");
                                        setStartSignal((n) => n + 1);
                                    }} />}
                            {tab === "dex" && <DexTab />}
                            {tab === "calc" && <CalcTab team={team} />}
                        </Suspense>
                    </div>
                    <p className="source-note label">
                        Engine: <a href="https://github.com/smogon/pokemon-showdown" target="_blank" rel="noopener noreferrer">Pokémon Showdown</a> via{" "}
                        <a href="https://github.com/pkmn/ps" target="_blank" rel="noopener noreferrer">pkmn</a> and{" "}
                        <a href="https://github.com/smogon/damage-calc" target="_blank" rel="noopener noreferrer">Smogon's damage calc</a> (MIT). Sprites from Pokémon Showdown.
                        Pokémon is © Nintendo, Game Freak and Creatures; this is a non-commercial fan page.
                    </p>
                </div>
            </section>
        </>
    );
}
