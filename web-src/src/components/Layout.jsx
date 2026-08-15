import AudioBackground from "./AudioBackground.jsx";
import CursorSpotlight from "./CursorSpotlight.jsx";
import Nav from "./Nav.jsx";
import Footer from "./Footer.jsx";
import MusicPlayer from "./MusicPlayer.jsx";
import HexColonyPersistent from "./HexColonyPersistent.jsx";

// Everything here mounts exactly once for the whole session — React Router
// only ever swaps out the routed page content inside <App>, never this
// shell — so the background animation and the music player's actual
// <audio> element are never torn down and recreated on navigation. That
// persistence (no restart-on-click) is the concrete thing the SPA rewrite
// buys over the old plain-HTML site, where every navigation was a full
// page reload.
export default function Layout({ children }) {
    return (
        <>
            <AudioBackground />
            <CursorSpotlight />
            <Nav />
            <main>{children}</main>
            <HexColonyPersistent />
            <Footer />
            <MusicPlayer />
        </>
    );
}
