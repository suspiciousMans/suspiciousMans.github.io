import { useState, useLayoutEffect } from "react";
import { flushSync } from "react-dom";
import { Routes, Route, useLocation } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./routes/Home.jsx";
import Projects from "./routes/Projects.jsx";
import About from "./routes/About.jsx";
import HexColony from "./routes/HexColony.jsx";
import AutoCode from "./routes/AutoCode.jsx";
import Gooba from "./routes/Gooba.jsx";
import Logistica from "./routes/Logistica.jsx";
import Chat from "./routes/Chat.jsx";
import NotFound from "./routes/NotFound.jsx";
import PageMeta from "./components/PageMeta.jsx";

// key={pathname} forces each route's content to remount on navigation, which
// is what lets the route-transition animation replay per page — everything
// *outside* this Routes tree (nav, background, music player) stays mounted
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
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof document.startViewTransition === "function" && !reducedMotion) {
      document.startViewTransition(() => {
        flushSync(() => setDisplayLocation(location));
      });
    } else {
      setDisplayLocation(location);
    }
  }, [location, displayLocation]);

  return (
    <Layout>
      <div className="page-content" key={displayLocation.pathname}>
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
            path="/chat.html"
            element={
              <>
                <PageMeta
                  title="Chat — suspiciousMans"
                  description="A live public chatroom on suspiciousMans' site — say hi."
                  path="/chat.html"
                  image="/assets/img/og-default.png"
                />
                <Chat />
              </>
            }
          />
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
      </div>
    </Layout>
  );
}
