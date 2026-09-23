import projects from "../data/projects.js";
import ProjectRow from "../components/ProjectRow.jsx";
import Title from "../components/Title.jsx";
import useScrollReveal from "../hooks/useScrollReveal.js";

export default function Projects() {
    const revealRef = useScrollReveal();

    return (
        <div ref={revealRef}>
            <section className="hero hero-left">
                <div className="wrap">
                    <span className="label eyebrow">Projects</span>
                    <Title segments={[{ text: "Things I've " }, { text: "built.", accent: true }]} />
                    <p className="lede">Mostly Rust, mostly from scratch. Here's what I've been working on.</p>
                </div>
            </section>

            <section className="section-tight">
                <div className="wrap">
                    <div className="rows">
                        {projects.map((project, i) => (
                            <ProjectRow key={project.name} project={project} index={i} />
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
