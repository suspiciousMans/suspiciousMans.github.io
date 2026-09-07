import projects from "../data/projects.js";
import ProjectCard from "../components/ProjectCard.jsx";
import TypewriterTitle from "../components/TypewriterTitle.jsx";
import useScrollTimeline from "../hooks/useScrollTimeline.js";

export default function Projects() {
    const timelineRef = useScrollTimeline(({ gsap, root }) => {
        const cards = root.querySelectorAll(".grid > *");
        gsap.fromTo(
            cards,
            { autoAlpha: 0, y: 46 },
            {
                autoAlpha: 1,
                y: 0,
                ease: "power2.out",
                stagger: 0.08,
                scrollTrigger: { trigger: root.querySelector(".grid"), start: "top 82%", end: "bottom 55%", scrub: 0.5 },
            }
        );
    }, []);

    return (
        <div ref={timelineRef}>
            <section className="hero" style={{ paddingBottom: "24px" }}>
                <div className="wrap">
                    <span className="eyebrow">Projects</span>
                    <TypewriterTitle segments={[{ text: "Things I've " }, { text: "built", accent: true }]} />
                    <p className="lede">Mostly Rust, mostly from scratch. Here's what I've been working on.</p>
                </div>
            </section>

            <section>
                <div className="wrap wrap-wide">
                    <div className="grid grid-bento">
                        {projects.map((project) => (
                            <ProjectCard key={project.name} project={project} revealMode="none" />
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
