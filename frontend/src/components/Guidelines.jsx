import "./Guidelines.css";

const RULES = [
  {
    title: "Consent, always",
    body: "Only upload faces and footage you have permission to use — your own, or someone who's explicitly agreed.",
  },
  {
    title: "No real public figures",
    body: "Don't use this to depict politicians, celebrities, or other real people without their consent, especially in ways that could mislead.",
  },
  {
    title: "No explicit content",
    body: "Sexual or intimate content generated without the depicted person's consent is not permitted, ever.",
  },
  {
    title: "Label synthetic media",
    body: "If you share a result publicly, disclose that it's AI-generated.",
  },
];

export default function Guidelines() {
  return (
    <section id="guidelines" className="guidelines">
      <h2>Ground rules</h2>
      <div className="guidelines__grid">
        {RULES.map((r) => (
          <div className="guidelines__card" key={r.title}>
            <h3>{r.title}</h3>
            <p>{r.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
