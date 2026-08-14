import TypewriterTitle from "../components/TypewriterTitle.jsx";

// The world cards below link out with plain <a> tags, not <Link> — a full
// navigation, exiting the SPA. That's intentional and matches the existing
// (non-React) behavior: autocode/ is a separate, enormous (~23MB) prebuilt
// Vite/PixiJS/Monaco/Pyodide bundle built by another process entirely, not
// something to route into client-side. Only this lightweight landing page
// is a real React route.
export default function AutoCode() {
    return (
        <>
            <section className="hero" style={{ paddingBottom: "24px" }}>
                <div className="wrap">
                    <span className="eyebrow">Play in browser</span>
                    <TypewriterTitle segments={[{ text: "Auto" }, { text: "Code", accent: true }]} />
                    <p className="lede">
                        Write real JavaScript or Python and watch it run — plant and harvest crops, pilot a mining ship,
                        run a shop, and automate a factory. Every script runs live in your browser, no install, no
                        account.
                    </p>
                    <div className="hero-actions">
                        <a className="btn btn-primary" href="/autocode/game.html">
                            Play the full game
                        </a>
                    </div>
                </div>
            </section>

            <section style={{ paddingTop: 0 }}>
                <div className="wrap">
                    <div className="section-head">
                        <span className="eyebrow">One game, four worlds</span>
                        <h2>All of it, in one place</h2>
                        <p>
                            Farm, Space, Store, and Factory share one save — credits earned selling ore in the Store buy
                            ship upgrades in Space, and every crew eats what the Farm grows. The full game above puts all
                            four behind one set of tabs, so the whole loop runs without leaving the page.
                        </p>
                    </div>
                    <div className="section-head" style={{ marginTop: "36px" }}>
                        <span className="eyebrow">Or one world at a time</span>
                        <h2>Play each world on its own</h2>
                    </div>
                    <div className="grid">
                        <div className="card">
                            <div className="card-media">
                                <img
                                    src="/assets/img/autocode-preview.png"
                                    alt="AutoCode Farm world screenshot showing a script editor and a growing wheat plot"
                                    loading="lazy"
                                />
                            </div>
                            <h3>Farm</h3>
                            <div className="tags">
                                <span className="tag tag-accent">JavaScript</span>
                                <span className="tag">Python</span>
                            </div>
                            <p>The starting world. Plant, water, and harvest crops with a script that runs once — or every tick, once it's watching the world change.</p>
                            <div className="card-links">
                                <a href="/autocode/index.html">Play in browser</a>
                            </div>
                        </div>

                        <div className="card">
                            <h3>Space</h3>
                            <div className="tags">
                                <span className="tag tag-accent">JavaScript</span>
                            </div>
                            <p>Automate a mining ship: navigate an asteroid field, mine ore, and manage cargo and fuel under your own logic.</p>
                            <div className="card-links">
                                <a href="/autocode/space.html">Play in browser</a>
                            </div>
                        </div>

                        <div className="card">
                            <h3>Store</h3>
                            <div className="tags">
                                <span className="tag tag-accent">JavaScript</span>
                            </div>
                            <p>Run a shop with a script: price goods, restock shelves, and react to a market that moves on its own.</p>
                            <div className="card-links">
                                <a href="/autocode/store.html">Play in browser</a>
                            </div>
                        </div>

                        <div className="card">
                            <h3>Factory</h3>
                            <div className="tags">
                                <span className="tag tag-accent">JavaScript</span>
                            </div>
                            <p>Chain machines into a production line and keep it running — the most involved automation puzzle of the four worlds.</p>
                            <div className="card-links">
                                <a href="/autocode/factory.html">Play in browser</a>
                            </div>
                        </div>
                    </div>

                    <p style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "14px", marginTop: "26px" }}>
                        Source on{" "}
                        <a href="https://github.com/suspiciousMans/AutoCode" target="_blank" rel="noopener noreferrer">
                            GitHub
                        </a>
                    </p>
                </div>
            </section>
        </>
    );
}
