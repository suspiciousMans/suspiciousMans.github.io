import Nav from "./Nav.jsx";
import Footer from "./Footer.jsx";
import MusicPlayer from "./MusicPlayer.jsx";
import HexColonyPersistent from "./HexColonyPersistent.jsx";

// Everything here mounts exactly once for the whole session — React Router
// only ever swaps out the routed page content inside <App>, never this
// shell — so the music player's <audio> element and the Hex Colony game
// loop are never torn down and recreated on navigation.
export default function Layout({ children }) {
    return (
        <>
            <Nav />
            <main>{children}</main>
            <HexColonyPersistent />
            <Footer />
            <MusicPlayer />
        </>
    );
}
