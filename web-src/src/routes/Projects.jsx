import projects from "../data/projects.js";
import ProjectCard from "../components/ProjectCard.jsx";
import TypewriterTitle from "../components/TypewriterTitle.jsx";
import useScrollReveal from "../hooks/useScrollReveal.js";

export default function Projects() {
    const revealRef = useScrollReveal();

    return (
        <>
            <section className="hero" style={{ paddingBottom: "24px" }}>
                <div className="wrap">
                    <span className="eyebrow">Projects</span>
                    <TypewriterTitle segments={[{ text: "Things I've " }, { text: "built", accent: true }]} />
                    <p className="lede">Mostly Rust, mostly from scratch. Here's what I've been working on.</p>
                </div>
            </section>

            <section>
                <div className="wrap">
                    <div className="grid" ref={revealRef}>
                        {projects.map((project) => (
                            <ProjectCard key={project.name} project={project} />
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}
