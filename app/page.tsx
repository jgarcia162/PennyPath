import { fontPlayfair } from './fonts';

export default function HomePage() {
  return (
    <div className="home-page">
      <header className="site-header no-print">
        <a className={`auth-page__brand ${fontPlayfair.className}`} href="/">
          PennyPath
        </a>
        <div className="home-page__header-aside">
          <a className="home-page__header-aside-link" href="/login">
            Log in
          </a>
          <a className="home-page__header-aside-link home-page__header-aside-link--primary" href="/signup">
            Sign up
          </a>
        </div>
      </header>

      <main className="home-page__main">
        <p className="auth-page__eyebrow">Family finance, made tangible</p>
        <h1 className={`home-page__hero-title ${fontPlayfair.className}`}>
          A simple place to track progress, build momentum, and stick to the plan.
        </h1>
        <p className="auth-page__lede">
          PennyPath helps you map debt payoff, build savings targets, and keep a lightweight monthly history — so you
          can see what’s working, what changed, and what to do next.
        </p>

        <div className="auth-page__card">
          <p className="home-page__section-label">Get started</p>
          <div className="home-page__actions">
            <a className="home-page__btn home-page__btn--primary" href="/signup">
              Create an account
            </a>
            <a className="home-page__btn home-page__btn--secondary" href="/login">
              Log in
            </a>
            <a className="home-page__btn home-page__btn--ghost" href="/login?takeAPeek=1">
              Take a peek
            </a>
          </div>
          <p className="home-page__subtle">
            “Take a peek” opens a time-boxed trial with sample data. Your changes won’t persist.
          </p>
        </div>

        <section className="home-page__section home-page__card--spaced" aria-labelledby="what-you-get">
          <div className="auth-page__card">
            <h2 className={`home-page__h2 ${fontPlayfair.className}`} id="what-you-get">
              What you get
            </h2>
            <div className="home-page__grid" role="list">
              <div className="home-page__feature" role="listitem">
                <div className="home-page__feature-title">Payoff planning</div>
                <p className="home-page__feature-body">
                  Keep debts and payments in one place and watch your runway shrink as you log progress.
                </p>
              </div>
              <div className="home-page__feature" role="listitem">
                <div className="home-page__feature-title">Savings targets</div>
                <p className="home-page__feature-body">
                  Set goal milestones and track how accounts roll up into “fully funded” moments.
                </p>
              </div>
              <div className="home-page__feature" role="listitem">
                <div className="home-page__feature-title">Monthly history</div>
                <p className="home-page__feature-body">
                  Compare months side-by-side using recorded deposits, payments, and check-ins.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="home-page__section" aria-labelledby="how-it-works">
          <div className="auth-page__card home-page__card--spaced">
            <h2 className={`home-page__h2 ${fontPlayfair.className}`} id="how-it-works">
              How it works
            </h2>
            <ol className="home-page__steps">
              <li>
                <strong>Capture today.</strong> Add debts, savings, and a couple key totals to set your baseline.
              </li>
              <li>
                <strong>Pick targets.</strong> Decide what “done” looks like and let the plan reflect it instantly.
              </li>
              <li>
                <strong>Log the month.</strong> Record payments and deposits so history shows real momentum.
              </li>
            </ol>
          </div>
        </section>

        <section className="home-page__section" aria-labelledby="privacy-note">
          <div className="auth-page__card home-page__card--spaced">
            <h2 className={`home-page__h2 ${fontPlayfair.className}`} id="privacy-note">
              Private by default
            </h2>
            <p className="home-page__privacy">
              Your planner is designed to feel fast and personal. When you use “Take a peek”, the account runs with
              sample data and resets automatically when you leave.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
