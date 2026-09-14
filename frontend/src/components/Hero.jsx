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
          luffy.ai — Free AI Face Swap &amp; Multiple Face Swap Online
        </h1>
        <p className="hero__sub">
          Easily swap single or multiple faces in photos with luffy.ai. Experience razor-sharp, photorealistic 4K UHD face swapping with natural lighting.
        </p>

        {/* Luffy.ai Mode Tabs */}
        <div className="hero__tabs-wrap">
          <div className="hero__tabs">
            <a href="#workbench" className="hero__tab hero__tab--active">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Single Face Swap
            </a>
            <a href="#workbench" className="hero__tab hero__tab--secondary">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Multiple Face Swap
              <span className="hero__tab-badge">4K UHD</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
