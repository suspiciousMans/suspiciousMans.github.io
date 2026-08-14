import { useEffect } from "react";

// Mounts exactly once for the whole app lifetime (Layout never remounts
// this component on navigation), so the <music-widget> element — and the
// <audio> element inside it — persists across every route change instead
// of being torn down and recreated the way a full page load used to reset
// it. That persistence is the actual reason this became a component
// instead of staying a page-by-page <script> tag.
export default function MusicPlayer() {
    useEffect(() => {
        if (document.querySelector("music-widget")) return;

        const script = document.createElement("script");
        script.src = "/assets/music/music-widget.js";
        script.dataset.playlist = "/assets/music/playlist.json";
        script.dataset.position = "bottom-right";
        script.dataset.accent = "#01c887";
        document.body.appendChild(script);

        script.addEventListener("load", () => {
            // The widget's own auto-mount only runs once its script has
            // loaded, so autostart setup has to wait for the same thing.
            waitForWidget(setUpAutostart);
        });

        return () => {
            // Never actually unmounts in practice (this component has no
            // conditional rendering path), but avoid leaking the listener
            // if that ever changes.
        };
    }, []);

    return null;
}

function waitForWidget(cb, attempts = 0) {
    const widget = document.querySelector("music-widget");
    if (widget && widget.engine) {
        cb(widget);
    } else if (attempts < 100) {
        setTimeout(() => waitForWidget(cb, attempts + 1), 100);
    }
}

function setUpAutostart(widget) {
    const engine = widget.engine;

    // The widget writes raw browser/loading error text into its #hint
    // element from more than one code path (an engine "error" event on a
    // rejected play() — e.g. every blocked autoplay attempt — and
    // separately, directly, if the playlist fetch itself fails). Hidden
    // unconditionally instead of pattern-matched: nothing written there is
    // ever shown, regardless of cause or wording.
    if (widget.shadowRoot) {
        const hideHint = document.createElement("style");
        hideHint.textContent = "#hint { display: none !important; }";
        widget.shadowRoot.appendChild(hideHint);
    }

    let attempted = false;
    function attemptPlay() {
        attempted = true;
        engine.play();
    }

    if (engine.getState().track) {
        attemptPlay();
    } else {
        const off = engine.on("trackchange", (payload) => {
            if (payload.track && !attempted) attemptPlay();
            off();
        });
    }

    // Browsers block unmuted autoplay without a prior user gesture on most
    // first visits — the attempt above only succeeds for sessions a
    // browser already trusts. Arm a one-time fallback so playback starts
    // on the very first interaction anywhere on the page instead of
    // requiring visitors to find and click the player's own button.
    ["click", "keydown", "touchstart"].forEach((evt) => {
        document.addEventListener(evt, attemptPlay, { once: true, passive: true });
    });
}
