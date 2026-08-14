// Mouse-tracked spotlight for .card elements: written straight to the DOM
// via CSS custom properties rather than React state, so the highlight can
// follow the cursor at full pointer-event frequency without triggering a
// re-render on every mousemove. Shared by every place that renders a .card
// (ProjectCard and the featured cards on Home) so the effect is consistent.
export function handleCardMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    e.currentTarget.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
}
