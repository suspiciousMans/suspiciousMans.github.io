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
        if (!blobs.length || !widget) return;

        var audioCtx = null;
        var analyser = null;
        var freqData = null;
        var isPlaying = false;
        var t = 0;

        // The widget's PlayerEngine keeps a single reusable HTMLAudioElement
        // (never inserted into the DOM) and marks it `private` in
        // TypeScript — which doesn't survive compilation to a real runtime
        // access modifier, so it's reachable here as a plain property. This
        // is an internal implementation detail of the Music-Player repo's
        // build, not a public API, so it could break on a future rebuild of
        // that widget.
        function ensureAnalyser() {
            if (analyser || !widget.engine || !widget.engine.audio) return;
            try {
                var Ctx = window.AudioContext || window.webkitAudioContext;
                audioCtx = new Ctx();
                var source = audioCtx.createMediaElementSource(widget.engine.audio);
                analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.8;
                source.connect(analyser);
                // Routing through an AnalyserNode replaces the element's
                // default output, so this connection is what keeps the
                // music audible.
                analyser.connect(audioCtx.destination);
                freqData = new Uint8Array(analyser.frequencyBinCount);
            } catch (err) {
                console.warn("Audio-reactive background disabled:", err);
            }
        }

        // AudioContext creation/resume needs a user gesture. The widget's
        // own controls already provide one, but hooking the first click
        // anywhere on the page (capture, once) keeps this from depending on
        // which control a visitor happens to use first.
        document.addEventListener(
            "click",
            function () {
                ensureAnalyser();
                if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
            },
            { once: true, capture: true }
        );

        if (widget.engine) {
            widget.engine.on("play", function () {
                isPlaying = true;
            });
            widget.engine.on("pause", function () {
                isPlaying = false;
            });
        }

        function level() {
            if (analyser && freqData) {
                analyser.getByteFrequencyData(freqData);
                var sum = 0;
                for (var i = 0; i < freqData.length; i++) sum += freqData[i];
                var avg = sum / freqData.length / 255;
                // A real signal almost never sits at exactly 0 across a
                // whole frame; treat that as "no data" (cross-origin
                // without CORS) rather than "silent track" and fall through
                // to the synthetic pulse below so the background still
                // feels alive.
                if (avg > 0.01) return avg;
            }
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
