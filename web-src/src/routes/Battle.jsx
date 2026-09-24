import { lazy, Suspense, useEffect, useState } from "react";
import Title from "../components/Title.jsx";
import BattleTab from "../battle/BattleTab.jsx";
import TeamTab from "../battle/TeamTab.jsx";
import { call } from "../battle/client.js";
import "../battle/battle.css";

// The Pokédex and calc carry their own data sets, so they load on first open.
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
    const [format, setFormat] = useState(() => stored("pk-format", "gen9randombattle"));
    const [text, setText] = useState(() => stored("pk-team", ""));
    const [team, setTeam] = useState([]);

    useEffect(() => {
        try {
            localStorage.setItem("pk-team", text);
            localStorage.setItem("pk-format", format);
        } catch (e) {}
    }, [text, format]);

    // Parse the paste in the engine worker (it has Showdown's importer).
    useEffect(() => {
        let live = true;
        const t = setTimeout(() => {
            call("parse", { text })
                .then((sets) => live && setTeam(sets || []))
                .catch(() => live && setTeam([]));
        }, 250);
        return () => {
            live = false;
            clearTimeout(t);
        };
    }, [text]);

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
                            <BattleTab team={team} format={format} setFormat={setFormat} />
                        </div>
                        {tab === "team" && <TeamTab text={text} setText={setText} team={team} format={format} setFormat={setFormat} onBattle={() => setTab("battle")} />}
                        <Suspense fallback={<p className="label pk-loading">Loading…</p>}>
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
