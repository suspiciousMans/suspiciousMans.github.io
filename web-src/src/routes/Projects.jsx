import projects from "../data/projects.js";
import ProjectCard from "../components/ProjectCard.jsx";
import TypewriterTitle from "../components/TypewriterTitle.jsx";

export default function Projects() {
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
                    <div className="grid">
                        {projects.map((project) => (
                            <ProjectCard key={project.name} project={project} />
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}
