export default function BrandMark({ className = "brand-mark" }) {
    return (
        <svg className={className} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <polygon points="50,3 93,26 93,74 50,97 7,74 7,26" fill="none" stroke="currentColor" strokeWidth="7" />
        </svg>
    );
}
