(function () {
    "use strict";

    // music-widget.js defers its own mount to DOMContentLoaded whenever the
    // document is still parsing when it runs — which it always is here,
    // since both script tags are plain blocking scripts near the end of
    // <body>. Mirroring that same readyState check (rather than just
    // querying immediately) keeps this script's init reliably ordered after
    // the widget actually exists: same-phase listeners fire in registration
    // order, and this file's script tag comes after the widget's.
    function whenReady(fn) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", fn);
        } else {
            fn();
        }
    }

    whenReady(function () {
        var blobs = Array.prototype.slice.call(document.querySelectorAll(".audio-bg .blob"));
        var widget = document.querySelector("music-widget");
        if (!blobs.length || !widget || !widget.engine) return;

        // Deliberately does NOT use the Web Audio API (AnalyserNode etc.).
        // Getting real frequency data requires routing the widget's <audio>
        // element through an AudioContext via createMediaElementSource,
        // which permanently replaces the element's normal audio output with
        // whatever that graph produces — any mistake or edge case in wiring
        // it (autoplay-policy timing, a thrown error mid-setup, browser
        // quirks) risks silencing playback outright. It also wouldn't have
        // produced real data anyway: the bundled placeholder tracks are
        // cross-origin without CORS headers, so browsers zero out analyser
        // reads from them regardless. Driven purely off the widget's public
        // play/pause/timeupdate events instead — can't affect playback.
        var isPlaying = false;
        var t = 0;

        widget.engine.on("play", function () {
            isPlaying = true;
        });
        widget.engine.on("pause", function () {
            isPlaying = false;
        });

        function level() {
            return isPlaying ? 0.35 + 0.25 * Math.sin(t * 2.2) : 0;
        }

        function frame() {
            t += 0.016;
            var lvl = level();
            blobs.forEach(function (blob, i) {
                var phase = t * (0.6 + i * 0.15) + i * 2.1;
                var scale = 0.55 + lvl * (0.9 + 0.3 * Math.sin(phase));
                var dx = Math.sin(phase * 0.5) * 3;
                var dy = Math.cos(phase * 0.5) * 3;
                blob.style.transform = "scale(" + scale.toFixed(3) + ") translate(" + dx.toFixed(2) + "%, " + dy.toFixed(2) + "%)";
                blob.style.opacity = (0.14 + lvl * 0.28 + (isPlaying ? 0.06 : 0)).toFixed(3);
            });
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    });
})();
