import "./Footer.css";

export default function Footer() {
  return (
    <footer className="visro-footer">
      <div className="visro-footer__container">
        <div className="visro-footer__top">
          <div className="visro-footer__brand">
            <div className="visro-footer__logo">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="6" />
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" />
                <path d="M9 15c.85.63 1.885 1 3 1s2.15-.37 3-1" />
              </svg>
              <span>luffy.ai</span>
            </div>
            <p className="visro-footer__tagline">
              Online AI Face Swap studio for photos. Experience flawless facial identity transfer in authentic 4K resolution with zero artificial filters.
            </p>
          </div>

          <div className="visro-footer__nav-group">
            <h5 className="visro-footer__nav-title">Features</h5>
            <ul className="visro-footer__nav-list">
              <li><a href="#workbench">AI Face Swap</a></li>
              <li><a href="#workbench">Single Face Swap</a></li>
              <li><a href="#workbench">Multiple Face Swap</a></li>
              <li><a href="#workbench">4K UHD Resolution</a></li>
            </ul>
          </div>

          <div className="visro-footer__nav-group">
            <h5 className="visro-footer__nav-title">Resources</h5>
            <ul className="visro-footer__nav-list">
              <li><a href="#how-it-works">How It Works</a></li>
              <li><a href="#features">AI Pipeline Details</a></li>
              <li><a href="#features">Privacy &amp; Security</a></li>
            </ul>
          </div>

          <div className="visro-footer__nav-group">
            <h5 className="visro-footer__nav-title">Company</h5>
            <ul className="visro-footer__nav-list">
              <li><a href="#">About Us</a></li>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        <div className="visro-footer__bottom">
          <p>© {new Date().getFullYear()} luffy.ai. All rights reserved. Free &amp; private face swap online.</p>
          <div className="visro-footer__bottom-links">
            <span className="visro-footer__badge">Strict 4K UHD Master</span>
            <span className="visro-footer__badge">Pure Natural Blending</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
