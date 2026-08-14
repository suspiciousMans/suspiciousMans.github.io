import { useEffect, useRef } from "react";

// Deliberately does NOT use the Web Audio API (AnalyserNode etc.) — see the
// git history of the old vanilla version for why: routing the widget's
// <audio> element through an AudioContext once silenced playback outright,
// and it wouldn't have produced real data anyway, since the bundled
// placeholder tracks are cross-origin without CORS headers (browsers zero
// out analyser reads from those regardless). Driven purely off the
// widget's public play/pause events instead — can't affect playback.
export default function AudioBackground() {
    const blobRefs = [useRef(null), useRef(null), useRef(null)];

    useEffect(() => {
        let cancelled = false;
        let rafId;
        let pollId;
        let isPlaying = false;
        let t = 0;

        function attach(widget) {
            widget.engine.on("play", () => {
                isPlaying = true;
            });
            widget.engine.on("pause", () => {
                isPlaying = false;
            });

            function level() {
                return isPlaying ? 0.35 + 0.25 * Math.sin(t * 2.2) : 0;
            }

            function frame() {
                if (cancelled) return;
                t += 0.016;
                const lvl = level();
                blobRefs.forEach((ref, i) => {
                    const blob = ref.current;
                    if (!blob) return;
                    const phase = t * (0.6 + i * 0.15) + i * 2.1;
                    const scale = 0.55 + lvl * (0.9 + 0.3 * Math.sin(phase));
                    const dx = Math.sin(phase * 0.5) * 3;
                    const dy = Math.cos(phase * 0.5) * 3;
                    blob.style.transform = `scale(${scale.toFixed(3)}) translate(${dx.toFixed(2)}%, ${dy.toFixed(2)}%)`;
                    blob.style.opacity = (0.14 + lvl * 0.28 + (isPlaying ? 0.06 : 0)).toFixed(3);
                });
                rafId = requestAnimationFrame(frame);
            }
            rafId = requestAnimationFrame(frame);
        }

        // The <music-widget> custom element is mounted by a sibling
        // component (MusicPlayer) via a dynamically-injected <script> tag,
        // so — unlike the old static site, where script tag order in the
        // HTML guaranteed the widget existed first — there's no ordering
        // guarantee here between React effects. Poll briefly instead.
        let attempts = 0;
        pollId = setInterval(() => {
            attempts += 1;
            const widget = document.querySelector("music-widget");
            if (widget && widget.engine) {
                clearInterval(pollId);
                attach(widget);
            } else if (attempts > 100) {
                clearInterval(pollId);
            }
        }, 100);

        return () => {
            cancelled = true;
            clearInterval(pollId);
            cancelAnimationFrame(rafId);
        };
    }, []);

    return (
        <div className="audio-bg" aria-hidden="true">
            <div className="blob blob-1" ref={blobRefs[0]}></div>
            <div className="blob blob-2" ref={blobRefs[1]}></div>
            <div className="blob blob-3" ref={blobRefs[2]}></div>
        </div>
    );
}
