// Pointer-tracked spotlight + 3D tilt for .card elements: written straight
// to the DOM via CSS custom properties rather than React state, so both can
// follow the cursor at full pointer-event frequency without triggering a
// re-render on every move. Shared by every place that renders a .card
// (ProjectCard and the featured cards on Home) so the effect is consistent.
//
// Pointer Events, not mouse events: mobile browsers dispatch a synthetic
// "compatibility" mousemove right after a tap (for older sites that only
// listen for mouse input), which would otherwise engage the tilt — and
// since there's no matching mouseleave on a touchscreen, it would stay
// stuck mid-tilt indefinitely after every tap. A PointerEvent carries a
// real pointerType, so touch input can be told apart from an actual mouse
// and skipped entirely instead of leaving a permanently crooked card.
//
// While the pointer is actively moving over a card, .card-tilting switches
// the card to a near-instant linear transition so the tilt tracks it
// without lag; on pointerleave that class comes off and the card's default
// transition (a springy overshoot curve) takes over, so it settles back to
// resting flat instead of just snapping.
export function handleCardPointerMove(e) {
    if (e.pointerType !== "mouse") return;

    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;

    // The glow is just a color/opacity effect, so it stays for everyone;
    // the tilt is real parallax-style motion, which prefers-reduced-motion
    // is specifically meant to suppress — leave those custom properties at
    // their neutral CSS defaults in that case.
    card.style.setProperty("--mx", `${mx * 100}%`);
    card.style.setProperty("--my", `${my * 100}%`);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    card.classList.add("card-tilting");
    card.style.setProperty("--rx", `${(0.5 - my) * 16}deg`);
    card.style.setProperty("--ry", `${(mx - 0.5) * 16}deg`);
    card.style.setProperty("--card-lift", "-14px");
    card.style.setProperty("--card-scale", "1.035");
}

export function handleCardPointerLeave(e) {
    if (e.pointerType !== "mouse") return;

    const card = e.currentTarget;
    card.classList.remove("card-tilting");
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
    card.style.setProperty("--card-lift", "0px");
    card.style.setProperty("--card-scale", "1");
}
