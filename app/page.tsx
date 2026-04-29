import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ background: 'var(--cream)' }}>
      <header className="landing-header">
        <Link href="/" className="logo">
          <div className="logo__mark" aria-hidden="true">
            🌿
          </div>
          <span className="logo__text">PennyPath</span>
        </Link>
        <nav className="landing-header__nav" aria-label="Account">
          <Link href="/login" className="btn btn--ghost btn--sm">
            Log in
          </Link>
          <Link href="/signup" className="btn btn--primary btn--sm">
            Get started
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero__left">
          <div className="hero__eyebrow">
            <span className="hero__eyebrow-dot"></span>
            Family finance, made tangible
          </div>
          <h1 className="hero__title">
            Track progress,<br />
            build momentum,<br />
            <em>stick to the plan.</em>
          </h1>
          <p className="hero__sub">
            PennyPath helps you map debt payoff, build savings targets, and keep a lightweight monthly history — so you
            can see what&apos;s working, what changed, and what to do next.
          </p>
          <div className="hero__ctas">
            <Link href="/signup" className="btn btn--gold btn--lg">
              Create an account
            </Link>
            <Link href="/login" className="btn btn--ghost-light btn--lg">
              Log in
            </Link>
            <Link href="/login?takeAPeek=1" className="btn btn--ghost-light btn--lg">
              Take a peek →
            </Link>
          </div>
          <p className="hero__peek-note">&quot;Take a peek&quot; opens a time-boxed trial with sample data. Changes don&apos;t persist.</p>
        </div>

        <div className="hero__right">
          <div className="hero__visual">
            <div className="hero__stats-grid">
              <div className="hero-stat-card hero-stat-card--green">
                <div className="hero-stat-card__label">Debt remaining</div>
                <div className="hero-stat-card__value">$18,420</div>
                <div className="progress-bar">
                  <div className="progress-bar__fill" style={{ width: '62%' }}></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7c73', marginTop: 6 }}>
                  <span>62% paid</span>
                  <span>~14 mo left</span>
                </div>
              </div>
              <div className="hero-stat-card hero-stat-card--gold">
                <div className="hero-stat-card__label">HYSA balance</div>
                <div className="hero-stat-card__value">$6,800</div>
                <div className="progress-bar progress-bar--gold">
                  <div className="progress-bar__fill" style={{ width: '34%' }}></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7c73', marginTop: 6 }}>
                  <span>34% funded</span>
                  <span>$20k goal</span>
                </div>
              </div>
            </div>
            <div className="hero-milestone-card">
              <div className="hero-milestone-card__icon" aria-hidden="true">
                🏆
              </div>
              <div>
                <div className="hero-milestone-card__title">Milestone reached!</div>
                <div className="hero-milestone-card__label">First credit card fully paid off • March 2025</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-features">
        <div className="features-header">
          <div className="section-eyebrow" style={{ justifyContent: 'center' }}>
            What you get
          </div>
          <h2>Everything you need to move forward</h2>
          <p>Purpose-built for families with real goals and real debt. No bloat, no jargon.</p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-card__icon">📊</div>
            <h3>Payoff planning</h3>
            <p>
              Keep debts and payments in one place and watch your runway shrink as you log progress month by month.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card__icon">🎯</div>
            <h3>Savings targets</h3>
            <p>Set goal milestones and track how accounts roll up into &quot;fully funded&quot; moments worth celebrating.</p>
          </div>
          <div className="feature-card">
            <div className="feature-card__icon">📅</div>
            <h3>Monthly history</h3>
            <p>
              Compare months side-by-side using recorded deposits, payments, and check-ins. Real momentum, visible.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card__icon">🏠</div>
            <h3>Real estate scenarios</h3>
            <p>
              Model rental property investments with FHA vs LLC comparisons, cap rate, and cash-on-cash projections.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card__icon">🏅</div>
            <h3>Milestone badges</h3>
            <p>Earn badges as you hit payoff and savings milestones. Progress deserves to be recognized.</p>
          </div>
          <div className="feature-card">
            <div className="feature-card__icon">🔒</div>
            <h3>Private by default</h3>
            <p>
              Your data is yours. No ads, no sharing. The &quot;Take a peek&quot; demo resets automatically when you leave.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-how">
        <div className="landing-how__inner">
          <div className="section-eyebrow" style={{ color: 'var(--mint)' }}>
            How it works
          </div>
          <h2>Three steps to momentum</h2>
          <p className="landing-how__sub">Set up in minutes. Build the habit over months.</p>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-card__number">01</div>
              <div className="step-card__title">Capture today.</div>
              <p className="step-card__body">
                Add debts, savings accounts, and a couple of key totals to set your baseline. Your starting point becomes
                the foundation for everything.
              </p>
              <div className="step-card__connector">→</div>
            </div>
            <div className="step-card">
              <div className="step-card__number">02</div>
              <div className="step-card__title">Pick targets.</div>
              <p className="step-card__body">
                Decide what &quot;done&quot; looks like for each goal. Define payoff dates, savings milestones, and let the plan reflect
                it instantly.
              </p>
              <div className="step-card__connector">→</div>
            </div>
            <div className="step-card">
              <div className="step-card__number">03</div>
              <div className="step-card__title">Log the month.</div>
              <p className="step-card__body">
                Record payments and deposits each month so your history shows real momentum. See progress over time and
                stay on track.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-privacy">
        <div>
          <div className="section-eyebrow">Private by default</div>
          <h2>Your plan, your data, your pace.</h2>
          <p>
            PennyPath is designed to feel personal and fast. There are no ads, no data sharing, and no upsells. When you use
            &quot;Take a peek,&quot; the session runs with sample data and resets automatically.
          </p>
          <div style={{ marginTop: 28 }}>
            <Link href="/signup" className="btn btn--primary">
              Create free account
            </Link>
          </div>
        </div>
        <div className="landing-privacy__shield">
          <div className="privacy-item">
            <div className="privacy-item__icon">🔐</div>
            <div>
              <div className="privacy-item__title">No ads, ever</div>
              <div className="privacy-item__body">PennyPath doesn&apos;t monetize your financial data or show advertising.</div>
            </div>
          </div>
          <div className="privacy-item">
            <div className="privacy-item__icon">⚡</div>
            <div>
              <div className="privacy-item__title">Fast &amp; lightweight</div>
              <div className="privacy-item__body">Static-first architecture keeps things snappy even on slow connections.</div>
            </div>
          </div>
          <div className="privacy-item">
            <div className="privacy-item__icon">🌱</div>
            <div>
              <div className="privacy-item__title">Sample data trial</div>
              <div className="privacy-item__body">
                &quot;Take a peek&quot; resets automatically — explore freely, no commitment required.
              </div>
            </div>
          </div>
          <div className="privacy-item">
            <div className="privacy-item__icon">🏠</div>
            <div>
              <div className="privacy-item__title">Built for families</div>
              <div className="privacy-item__body">Shared goals, shared progress. One planner, two people on the same page.</div>
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="logo">
          <div className="logo__mark" aria-hidden="true">
            🌿
          </div>
          <span className="logo__text" style={{ color: 'rgba(250,247,240,0.7)', fontSize: '1.1rem' }}>
            PennyPath
          </span>
        </div>
        <span className="landing-footer__copy">© {new Date().getFullYear()} PennyPath. Family finance, made tangible.</span>
      </footer>
    </div>
  );
}
