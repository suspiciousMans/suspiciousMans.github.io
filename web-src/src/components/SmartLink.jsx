import { Link } from "react-router-dom";

// Internal SPA paths go through the router; anything else (external sites,
// or the separate static builds like /autocode/*.html) is a plain <a>.
const SPA_PATHS = /^\/(?:$|[a-z-]+\.html$|lab\/)/;

export default function SmartLink({ href, external, children, ...rest }) {
    if (!external && SPA_PATHS.test(href)) {
        return (
            <Link to={href} {...rest}>
                {children}
            </Link>
        );
    }
    return (
        <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>
            {children}
        </a>
    );
}
