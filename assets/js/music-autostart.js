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
