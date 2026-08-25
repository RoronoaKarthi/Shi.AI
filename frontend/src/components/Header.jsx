import "./Header.css";

export default function Header() {
  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__mark" aria-hidden="true" />
        <span className="header__name">Shu AI</span>
      </div>
      <nav className="header__nav">
        <a href="#workbench">Workbench</a>
        <a href="#guidelines">Guidelines</a>
      </nav>
    </header>
  );
}
