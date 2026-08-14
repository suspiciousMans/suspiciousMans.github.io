import { useEffect, useState } from "react";

// Types out `segments` (an ordered list of { text, accent? }) character by
// character, rendering accent segments as <span> so the existing
// `.hero h1 span { color: var(--accent) }` rule still applies untouched.
// The animation is purely visual: the tag carries aria-label with the full
// text up front, and the animated characters are aria-hidden, so screen
// readers get the real title immediately instead of it trickling in.
export default function TypewriterTitle({ segments, as: Tag = "h1", speed = 28, startDelay = 120, className }) {
    const fullText = segments.map((s) => s.text).join("");
    const [count, setCount] = useState(0);

    useEffect(() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reducedMotion) {
            setCount(fullText.length);
            return;
        }
        setCount(0);
        let cancelled = false;
        let i = 0;
        let timer;
        function tick() {
            if (cancelled) return;
            i += 1;
            setCount(i);
            if (i < fullText.length) {
                timer = setTimeout(tick, speed + Math.random() * 22);
            }
        }
        timer = setTimeout(tick, startDelay);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fullText]);

    let remaining = count;
    const rendered = segments.map((seg, idx) => {
        const take = Math.max(0, Math.min(seg.text.length, remaining));
        remaining -= take;
        const shown = seg.text.slice(0, take);
        return seg.accent ? <span key={idx}>{shown}</span> : shown;
    });
    const done = count >= fullText.length;

    return (
        <Tag className={className} aria-label={fullText}>
            <span aria-hidden="true">
                {rendered}
                <span className={"typewriter-cursor" + (done ? " typewriter-cursor-done" : "")} />
            </span>
        </Tag>
    );
}
