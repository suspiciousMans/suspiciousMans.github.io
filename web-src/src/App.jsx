import { useState, useLayoutEffect, lazy, Suspense } from "react";
import { flushSync } from "react-dom";
import { Routes, Route, useLocation } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./routes/Home.jsx";
import HexColony from "./routes/HexColony.jsx";
import NotFound from "./routes/NotFound.jsx";
import PageMeta from "./components/PageMeta.jsx";

// Home ships in the main bundle; every other route is its own chunk so new
// pages and Lab features never grow the first load.
// Each lazy route remembers its module once loaded, so after preload() the
// route renders synchronously. That matters because route swaps run inside
// flushSync + startViewTransition: a still-suspending React.lazy would make
// the transition snapshot the empty Suspense fallback instead of the page.
const loaded = {};
const loaders = {};
function lazyRoute(key, factory) {
  loaders[key] = () => factory().then((m) => (loaded[key] = m.default));
  const Lazy = lazy(() => loaders[key]().then((C) => ({ default: C })));
  return function LazyRoute(props) {
    const Comp = loaded[key];
    return Comp ? <Comp {...props} /> : <Lazy {...props} />;
  };
}

const Projects = lazyRoute("/projects.html", () => import("./routes/Projects.jsx"));
const About = lazyRoute("/about.html", () => import("./routes/About.jsx"));
const AutoCode = lazyRoute("/autocode.html", () => import("./routes/AutoCode.jsx"));
const Gooba = lazyRoute("/gooba.html", () => import("./routes/Gooba.jsx"));
const Logistica = lazyRoute("/logistica.html", () => import("./routes/Logistica.jsx"));
const Dreamscape = lazyRoute("/dreamscape.html", () => import("./routes/Dreamscape.jsx"));
const Battle = lazyRoute("/battle.html", () => import("./routes/Battle.jsx"));
const Lab = lazyRoute("/lab.html", () => import("./routes/Lab.jsx"));
const LabFeature = lazyRoute("/lab/", () => import("./routes/LabFeature.jsx"));

function preload(pathname) {
  const key = pathname.startsWith("/lab/") ? "/lab/" : pathname;
  return loaders[key] && !loaded[key] ? loaders[key]().catch(() => {}) : Promise.resolve();
}

// key={pathname} forces each route's content to remount on navigation, which
// is what lets the route-transition animation replay per page — everything
// *outside* this Routes tree (nav, background) stays mounted
// the whole time, which is the actual "seamless" part.
//
// Route changes render through `displayLocation`, one tick behind the real
// router `location`, so the DOM swap can be wrapped in
// document.startViewTransition() (browsers that support it get a real
// cross-fade/slide between old and new page content, scoped to just the
// .page-content element via its view-transition-name in global.css —
// see main.jsx for the unsupported-browser fallback flag).
export default function App() {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);

  useLayoutEffect(() => {
    if (location.pathname === displayLocation.pathname) return;
    let cancelled = false;
    // A plain multi-page site starts every navigation at the top; without
    // this an SPA silently carries over the last page's scroll offset.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    preload(location.pathname).then(() => {
      if (cancelled) return;
      if (typeof document.startViewTransition === "function" && !reducedMotion) {
        document.startViewTransition(() => {
          flushSync(() => setDisplayLocation(location));
          window.scrollTo(0, 0);
        });
      } else {
        setDisplayLocation(location);
        window.scrollTo(0, 0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [location, displayLocation]);

  return (
    <Layout>
      <div className="page-content" key={displayLocation.pathname}>
        <Suspense fallback={<div className="route-loading" />}>
        <Routes location={displayLocation}>
          <Route
            path="/"
            element={
              <>
                <PageMeta
                  title="suspiciousMans — home"
                  description="Personal site of suspiciousMans: Rust projects, a homemade game engine, and the playable web build of Hex Colony."
                  path="/"
                  image="/assets/img/og-default.png"
                />
                <Home />
              </>
            }
          />
          <Route
            path="/projects.html"
            element={
              <>
                <PageMeta
                  title="Projects — suspiciousMans"
                  description="Rust projects by suspiciousMans, including Hex Colony and the jame-engine game engine."
                  path="/projects.html"
                  image="/assets/img/og-default.png"
                />
                <Projects />
              </>
            }
          />
          <Route
            path="/about.html"
            element={
              <>
                <PageMeta
                  title="About — suspiciousMans"
                  description="About suspiciousMans: Rust developer, game builder, occasional web designer."
                  path="/about.html"
                  image="/assets/img/og-default.png"
                />
                <About />
              </>
            }
          />
          <Route
            path="/hex-colony.html"
            element={
              <>
                <PageMeta
                  title="Hex Colony — suspiciousMans"
                  description="Play Hex Colony, a turn-based pixel-art hex colony builder written in Rust, straight in your browser via WebAssembly."
                  path="/hex-colony.html"
                  image="/assets/img/hex-colony-preview.png"
                />
                <HexColony />
              </>
            }
          />
          <Route
            path="/autocode.html"
            element={
              <>
                <PageMeta
                  title="AutoCode — suspiciousMans"
                  description="Play AutoCode: write JavaScript or Python scripts to automate a farm, a spaceship, a store, and a factory, straight in your browser."
                  path="/autocode.html"
                  image="/assets/img/autocode-preview.png"
                />
                <AutoCode />
              </>
            }
          />
          <Route
            path="/gooba.html"
            element={
              <>
                <PageMeta
                  title="Gooba — suspiciousMans"
                  description="Gooba: a retro dithering studio. Drop in a photo, GIF, or video and turn it into crunchy pixel art, animated or still, entirely in your browser."
                  path="/gooba.html"
                  image="/assets/img/og-default.png"
                />
                <Gooba />
              </>
            }
          />
          <Route
            path="/logistica.html"
            element={
              <>
                <PageMeta
                  title="Logistica — suspiciousMans"
                  description="Logistica: a gate-level logic simulator and microprocessor-building sandbox, running entirely in the browser via WebAssembly."
                  path="/logistica.html"
                  image="/assets/img/og-default.png"
                  noindex
                />
                <Logistica />
              </>
            }
          />
          <Route
            path="/dreamscape.html"
            element={
              <>
                <PageMeta
                  title="Dreamscape — suspiciousMans"
                  description="Play Dreamscape, a PS2-style dream-escape roguelike in Rust, in your browser. Sink through procedurally generated dreams, pick upgrades, and try to wake up."
                  path="/dreamscape.html"
                  image="/assets/img/dreamscape-preview.jpg"
                />
                <Dreamscape />
              </>
            }
          />
          <Route
            path="/battle.html"
            element={
              <>
                <PageMeta
                  title="Battle sim — suspiciousMans"
                  description="Pokémon battles against the computer on Pokémon Showdown's own simulator, with a team builder, Pokédex and damage calculator."
                  path="/battle.html"
                  image="/assets/img/og-default.png"
                />
                <Battle />
              </>
            }
          />
          <Route
            path="/lab.html"
            element={
              <>
                <PageMeta
                  title="Lab — suspiciousMans"
                  description="Small interactive experiments by suspiciousMans, running right in the browser."
                  path="/lab.html"
                  image="/assets/img/og-default.png"
                />
                <Lab />
              </>
            }
          />
          <Route path="/lab/:slug" element={<LabFeature />} />
          <Route
            path="*"
            element={
              <>
                <PageMeta title="404 — suspiciousMans" description="This page doesn't exist. Suspicious." path={displayLocation.pathname} noindex />
                <NotFound />
              </>
            }
          />
        </Routes>
        </Suspense>
      </div>
    </Layout>
  );
}
