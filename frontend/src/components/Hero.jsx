import "./Hero.css";

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero__text">
        <p className="hero__eyebrow">image · gif · video</p>
        <h1 className="hero__title">
          One face in.
          <br />
          Any face out.
        </h1>
        <p className="hero__sub">
          Upload a source face and a target — Shu AI handles the blend, frame
          by frame, whether it's a single photo, a looping GIF, or full video.
        </p>
        <a href="#workbench" className="hero__cta">
          Start swapping ↓
        </a>
      </div>

      <div className="hero__visual" aria-hidden="true">
        <div className="morph">
          <div className="morph__blob morph__blob--a" />
          <div className="morph__blob morph__blob--b" />
          <div className="morph__seam" />
        </div>
      </div>
    </section>
  );
}
