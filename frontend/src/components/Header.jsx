import "./Header.css";

export default function Header() {
  return (
    <header className="header">
      <div className="header__brand">
        <div className="header__logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="6" />
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
            <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" />
            <path d="M9 15c.85.63 1.885 1 3 1s2.15-.37 3-1" />
          </svg>
        </div>
        <span className="header__name">luffy.ai</span>
        <span className="header__badge">Free Online</span>
      </div>

      <nav className="header__nav">
        <a href="#workbench" className="header__nav-item header__nav-item--active">
          AI Face Swap
        </a>
        <a href="#features" className="header__nav-item">
          AI Image
        </a>
        <a href="#features" className="header__nav-item">
          AI Video
        </a>
        <a href="#how-it-works" className="header__nav-item">
          How it Works
        </a>
        <a href="#history" className="header__nav-item">
          Recent Swaps
        </a>
      </nav>

      <div className="header__actions">
        <button type="button" className="header__btn-signin">
          Sign in for free
        </button>
      </div>
    </header>
  );
}
