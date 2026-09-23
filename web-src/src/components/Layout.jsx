import Nav from "./Nav.jsx";
import DitherField from "./DitherField.jsx";
import Footer from "./Footer.jsx";
import HexColonyPersistent from "./HexColonyPersistent.jsx";

// Everything here mounts exactly once for the whole session — React Router
// only ever swaps out the routed page content inside <App>, never this
// shell — so the Hex Colony game loop is never torn down and recreated on
// navigation.
export default function Layout({ children }) {
    return (
        <>
            <DitherField />
            <Nav />
            <main>{children}</main>
            <HexColonyPersistent />
            <Footer />
        </>
    );
}
