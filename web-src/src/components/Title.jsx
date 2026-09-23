// Page heading used by every hero. Takes the same `segments` shape the old
// TypewriterTitle did ({ text, accent? }[]); accent segments render in the
// italic serif cut instead of a different color.
export default function Title({ segments }) {
    return (
        <h1 className="display">
            {segments.map((seg, i) => (seg.accent ? <em key={i}>{seg.text}</em> : <span key={i}>{seg.text}</span>))}
        </h1>
    );
}
