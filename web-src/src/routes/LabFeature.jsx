import { lazy, Suspense, useMemo } from "react";
import { useParams } from "react-router-dom";
import features from "../data/features.js";
import FeatureFrame from "../components/FeatureFrame.jsx";
import PageMeta from "../components/PageMeta.jsx";
import NotFound from "./NotFound.jsx";

export default function LabFeature() {
    const { slug } = useParams();
    const feature = features.find((f) => f.slug === slug);
    const Component = useMemo(() => (feature ? lazy(feature.load) : null), [feature]);

    if (!feature) return <NotFound />;

    return (
        <>
            <PageMeta
                title={`${feature.name} — Lab — suspiciousMans`}
                description={feature.blurb}
                path={`/lab/${feature.slug}`}
                image="/assets/img/og-default.png"
            />
            <FeatureFrame feature={feature}>
                <Suspense fallback={<div className="stage-loading label">Loading…</div>}>
                    <Component />
                </Suspense>
            </FeatureFrame>
        </>
    );
}
