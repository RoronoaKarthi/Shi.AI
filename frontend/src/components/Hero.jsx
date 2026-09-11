import "./Hero.css";

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero__container">
        <div className="hero__eyebrow">
          <span className="hero__sparkle">✨</span>
          <span>Free Online AI Studio • No Sign-up Required</span>
        </div>
        <h1 className="hero__title">
          AI Face Swap for Videos &amp; Photos Free Online
        </h1>
        <p className="hero__sub">
          Easily swap your faces in photos with luffy.ai. Experience realistic, natural face swapping with authentic lighting.
        </p>

        {/* Visro AI Pill Nav Tabs */}
        <div className="hero__tabs-wrap">
          <div className="hero__tabs">
            <button type="button" className="hero__tab hero__tab--active">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Photo Face Swap
            </button>
            <button type="button" className="hero__tab hero__tab--secondary" title="Video swap is in beta">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
              Video Face Swap
              <span className="hero__tab-badge">Beta</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
