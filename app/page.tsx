import { fontPlayfair } from './fonts';

export default function HomePage() {
  return (
    <div className="home-page">
      <header className="site-header no-print">
        <a className={`auth-page__brand ${fontPlayfair.className}`} href="/">
          PennyPath
        </a>
        <nav className="site-nav" aria-label="Site">
          <a className="site-nav__tab" href="/dashboard">
            💰 Financial Plan
          </a>
          <a className="site-nav__tab" href="/real-estate">
            🏠 Real Estate
          </a>
          <a className="site-nav__tab" href="/history">
            📅 History
          </a>
        </nav>
        <div className="home-page__header-aside">
          <a className="home-page__header-aside-link" href="/login">
            Log in
          </a>
        </div>
      </header>

      <main className="home-page__main">
        <p className="auth-page__eyebrow">Welcome</p>
        <h1 className={`home-page__hero-title ${fontPlayfair.className}`}>PennyPath</h1>
        <p className="auth-page__lede">
          Your family financial planner — balances, payoffs, real estate, and history in one place. This home page is
          part of the Next.js (App Router) app; the planner routes below use the same experience you see in the
          migrated pages.
        </p>

        <div className="auth-page__card">
          <p className="home-page__section-label">Open a tool</p>
          <div className="home-page__actions">
            <a className="home-page__btn home-page__btn--primary" href="/dashboard">
              Go to Dashboard
            </a>
            <a className="home-page__btn home-page__btn--secondary" href="/history">
              View History
            </a>
            <a className="home-page__btn home-page__btn--secondary" href="/real-estate">
              Real Estate Plan
            </a>
          </div>
        </div>

        <div className="auth-page__card home-page__card--spaced">
          <h2 className={`home-page__h2 ${fontPlayfair.className}`}>What’s next</h2>
          <ul className="home-page__list">
            <li>Keep the dashboard route and all existing planner behavior intact as we iterate.</li>
            <li>
              Move <code>assets/financial-plan/</code> logic into <code>lib/</code> and <code>components/</code> in
              small, safe slices.
            </li>
            <li>Preserve localStorage and optional features (AI helpers, badges, history, and more).</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
