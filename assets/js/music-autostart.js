(function () {
    "use strict";

    // See audio-reactive.js for why this mirrors music-widget.js's own
    // readyState check rather than querying immediately.
    function whenReady(fn) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", fn);
        } else {
            fn();
        }
    }

    whenReady(function () {
        var widget = document.querySelector("music-widget");
        if (!widget || !widget.engine) return;
        var engine = widget.engine;

        // engine.play() swallows the promise rejection itself and emits it
        // as a public "error" event instead, which the widget renders as
        // raw browser error text ("NotAllowedError: play() failed...") in
        // its hint area — expected and harmless every time an autoplay
        // attempt gets blocked, but ugly to actually show a visitor. Only
        // that specific, autoplay-policy failure gets swallowed here;
        // anything else (e.g. a genuinely broken track) still shows.
        engine.on("error", function (payload) {
            if (/notallowederror/i.test(payload.message || "")) {
                var hint = widget.shadowRoot && widget.shadowRoot.querySelector("#hint");
                if (hint) hint.textContent = "";
            }
        });

        var attempted = false;
        function attemptPlay() {
            attempted = true;
            engine.play();
        }

        // The playlist loads asynchronously (widget fetches playlist.json
        // then calls engine.load()); trackchange fires once a real track is
        // ready, which is the earliest point audio.play() can do anything.
        // If load() already resolved before this listener attaches,
        // getState() already reflects a loaded track, so attempt right away.
        if (engine.getState().track) {
            attemptPlay();
        } else {
            var off = engine.on("trackchange", function (payload) {
                if (payload.track && !attempted) attemptPlay();
                off();
            });
        }

        // Browsers block unmuted autoplay without a prior user gesture on
        // most first visits — the attempt above only succeeds for sessions
        // a browser already trusts (e.g. returning visitors with high media
        // engagement on this site). Arm a one-time fallback so playback
        // starts on the very first interaction anywhere on the page instead
        // of requiring visitors to find and click the player's own button.
        // Re-calling engine.play() when already playing is a harmless no-op.
        ["click", "keydown", "touchstart"].forEach(function (evt) {
            document.addEventListener(evt, attemptPlay, { once: true, passive: true });
        });
    });
})();
