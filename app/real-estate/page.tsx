'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AppLoadingOverlay } from '../components/AppLoadingOverlay';
import { LogoutForm } from '../components/LogoutForm';
import { TrialCountdown } from '../components/TrialCountdown';
import { clearDemoModeIfTrialEnded, maybeEnableTrialSessionFromUrl } from '../../lib/trial/trial-session';

export default function RealEstatePage() {
  const [booting, setBooting] = useState(true);
  const [collapseLabel, setCollapseLabel] = useState<'Collapse all' | 'Expand all'>('Collapse all');

  function animateSection(details: HTMLDetailsElement, expand: boolean) {
    const summary = details.querySelector('summary') as HTMLElement | null;
    const anim = details.querySelector('.section-collapsible__anim') as HTMLElement | null;
    if (!summary || !anim) {
      details.open = expand;
      return;
    }

    const startHeight = details.offsetHeight;
    if (expand) details.open = true;
    const endHeight = expand ? summary.offsetHeight + anim.offsetHeight : summary.offsetHeight;

    details.style.height = `${startHeight}px`;
    details.style.overflow = 'hidden';

    const heightAnim = details.animate(
      [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
      { duration: 700, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
    );
    anim.animate(
      expand ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
      { duration: expand ? 360 : 260, easing: 'ease' }
    );

    heightAnim.onfinish = () => {
      if (!expand) details.open = false;
      details.style.height = '';
      details.style.overflow = '';
    };
  }

  function wireAnimatedSections() {
    const root = document.querySelector('.content');
    if (!root) return () => {};
    const sections = Array.from(root.querySelectorAll('details.section-collapsible')) as HTMLDetailsElement[];
    const cleanups: Array<() => void> = [];

    sections.forEach((details) => {
      const summary = details.querySelector('summary');
      if (!summary) return;
      const onClick = (e: Event) => {
        e.preventDefault();
        if (details.dataset.animating === '1') return;
        details.dataset.animating = '1';
        const expand = !details.open;
        animateSection(details, expand);
        window.setTimeout(() => {
          delete (details as any).dataset.animating;
        }, 760);
      };
      summary.addEventListener('click', onClick);
      cleanups.push(() => summary.removeEventListener('click', onClick));
    });

    return () => cleanups.forEach((fn) => fn());
  }

  function toggleAllCollapsibles() {
    const root = document.querySelector('.content');
    if (!root) return;
    const details = root.querySelectorAll('details.section-collapsible');
    const anyOpen = Array.from(details).some((d) => d instanceof HTMLDetailsElement && d.open);
    const nextOpen = !anyOpen;
    details.forEach((d) => {
      if (!(d instanceof HTMLDetailsElement)) return;
      animateSection(d, nextOpen);
    });
    setCollapseLabel(nextOpen ? 'Collapse all' : 'Expand all');
  }

  useEffect(() => {
    let cancelled = false;
    document.body.classList.add('re-page');

    async function boot() {
      try {
        maybeEnableTrialSessionFromUrl();
        clearDemoModeIfTrialEnded();
        // Load order matches `real-estate-plan.html`.
        await import('../../assets/theme-service');
        await import('../../assets/color-palette-service');
        await import('../../assets/safe-api-origin');

        // Converted from the large inline <script>.
        const mod = await import('../../lib/real-estate/real-estate-plan');
        if (!cancelled && mod && typeof mod.initRealEstatePlan === 'function') {
          mod.initRealEstatePlan();
        }

        // Settings/dev scripts were loaded at the bottom of the HTML (non-defer).
        await import('../../assets/site-settings');
        await import('../../assets/dev-mode');
      } catch (e) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('Failed to boot Real Estate page:', e);
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
      document.body.classList.remove('re-page');
    };
  }, []);

  useEffect(() => {
    return wireAnimatedSections();
  }, []);

  return (
    <div>
      {booting ? (
        <AppLoadingOverlay message="Loading real estate planner…" ariaLabel="Loading real estate planner" />
      ) : null}
      <header className="site-header no-print">
        <Link href="/dashboard" className="site-header__brand logo" aria-label="PennyPath home">
          <div className="logo__mark" aria-hidden="true">
            🌿
          </div>
          <span className="logo__text">PennyPath</span>
        </Link>
        <nav className="site-nav" aria-label="Site">
          <a className="site-nav__tab" href="/dashboard">
            💰 Financial Plan
          </a>
          <a className="site-nav__tab site-nav__tab--active" href="/real-estate" aria-current="page">
            🏠 Real Estate
          </a>
          <a className="site-nav__tab" href="/history">
            📅 History
          </a>
        </nav>
        <div className="site-header__settings">
          <TrialCountdown />
          <button
            type="button"
            className="site-settings-btn"
            id="btn-site-settings"
            aria-expanded="false"
            aria-haspopup="true"
            aria-controls="site-settings-menu"
          >
            <span className="site-settings-btn__icon" aria-hidden="true">
              ⚙
            </span>
            <span className="site-settings-btn__label">Settings</span>
          </button>
          <ul className="site-settings-menu" id="site-settings-menu" aria-label="Site settings">
            <li>
              <div className="site-settings-menu-section">
                <span className="site-settings-menu-label">Display</span>
                <button
                  type="button"
                  className="site-settings-item site-settings-item--muted"
                  id="btn-toggle-theme"
                  aria-pressed="false"
                >
                  Dark mode
                </button>
                <button type="button" className="site-settings-item" id="btn-open-appearance">
                  Appearance…
                </button>
              </div>
            </li>
            <li>
              <div className="site-settings-menu-section">
                <span className="site-settings-menu-label">Page</span>
                <button type="button" className="site-settings-item" id="btn-print">
                  Print
                </button>
              </div>
            </li>
            <li data-dev-only="developer-settings" hidden>
              <div className="site-settings-menu-section">
                <span className="site-settings-menu-label">Developer</span>
                <button type="button" className="site-settings-item" id="btn-dev-lock">
                  Lock developer options
                </button>
                <p className="site-settings-dev-hint">
                  Clears the developer unlock. Use the footer version gesture to unlock again.
                </p>
              </div>
            </li>
            <li>
              <div className="site-settings-menu-section">
                <span className="site-settings-menu-label">Account</span>
                <LogoutForm>
                  <button type="submit" className="site-settings-item">
                    Log out
                  </button>
                </LogoutForm>
              </div>
            </li>
          </ul>
        </div>
      </header>

      <div className="cover">
        <div className="cover-label" id="re-cover-eyebrow">
          Real estate · Investment planning
        </div>
        <h1 className="re-hero-title" id="re-hero-title">
          Buying rental property — Two Paths, One Goal.
        </h1>
        <p className="re-hero-sub">
          Compare FHA owner-occupancy financing against a conventional investment (LLC) loan so you can see cash
          required, monthly carry, and which path fits your timeline.
        </p>
        <div className="re-stat-pills">
          <span className="re-pill">
            <strong>FHA</strong> down · 3.5%
          </span>
          <span className="re-pill">
            <strong>LLC</strong> down · 20%
          </span>
          <span className="re-pill">
            <strong>FHA rate</strong> · ~6.1%
          </span>
          <span className="re-pill">
            <strong>Investment loan</strong> · ~7.0%
          </span>
        </div>
      </div>

      <div className="content">
        <div className="collapsible-controls no-print">
          <button type="button" className="collapsible-controls__toggle" onClick={() => toggleAllCollapsibles()}>
            {collapseLabel}
          </button>
        </div>

        <details className="section section-collapsible" id="section-market-ai" open>
          <summary className="section-collapsible__summary">
            <span className="section-collapsible__chevron" aria-hidden="true"></span>
            <span className="section-collapsible__summary-text">
              <span className="section-title">City search &amp; AI estimates</span>
            </span>
          </summary>
          <div className="section-collapsible__anim">
            <div className="section-collapsible__body">
            <p className="section-sub">
              Search for any city, then use <strong>Research with AI</strong> to fill the calculator with ballpark numbers
              (verify with real listings and quotes). You can still edit every field manually. Run the local server from
              this project so search and AI can reach the API — see console or <code>server/market-research.mjs</code>.
            </p>

            <div className="re-market-search-wrap re-calculator-panel">
              <div className="re-search-row">
                <div className="balance-field re-search-field">
                  <label htmlFor="re-search-input">City or region</label>
                  <input type="text" id="re-search-input" autoComplete="off" placeholder="e.g. Austin, TX or Denver, CO" />
                  <div className="balance-field-hint">
                    Place search is proxied through the dev server (OpenStreetMap Nominatim).
                  </div>
                </div>
                <div className="re-search-actions">
                  <button type="button" className="btn-save" id="re-ai-btn" disabled>
                    Research with AI
                  </button>
                  <button type="button" className="btn-undo" id="re-refresh-btn" disabled>
                    Refresh AI
                  </button>
                </div>
              </div>
              <div className="re-search-dropdown" id="re-search-dropdown" hidden role="listbox" aria-label="Search results"></div>
              <p className="re-search-status" id="re-search-status" aria-live="polite"></p>
              <div id="re-ai-loading" className="re-ai-loading-panel" hidden role="status" aria-live="polite">
                <div className="ai-payoff-loading">
                  <span className="ai-payoff-loading__spinner" aria-hidden="true" />
                  <p className="ai-payoff-loading__label" id="re-ai-loading-label">
                    Researching market with AI…
                  </p>
                </div>
              </div>
              <div className="re-current-market">
                <strong>Current market:</strong> <span id="re-current-label">—</span>
              </div>
              <div className="callout sage" id="re-ai-notes" hidden style={{ marginTop: 14 }}></div>
              <div>
                <div className="debts-editor-title" style={{ marginTop: 18 }}>
                  Recent searches
                </div>
                <ul className="re-recent-list" id="re-recent-list"></ul>
              </div>
            </div>
            </div>
          </div>
        </details>

        <details className="section section-collapsible" open>
          <summary className="section-collapsible__summary">
            <span className="section-collapsible__chevron" aria-hidden="true"></span>
            <span className="section-collapsible__summary-text">
              <span className="section-title">Live Cash Flow Calculator</span>
            </span>
          </summary>
          <div className="section-collapsible__anim">
            <div className="section-collapsible__body">
            <p className="section-sub">
              Adjust inputs to match a specific listing or market assumptions. Press <strong>Recalculate</strong> or Enter
              in any field.
            </p>

            <div className="re-calculator-panel" id="re-calculator-panel">
              <div className="re-calculator-grid">
                <div className="balance-field">
                  <label htmlFor="re-price">Purchase price</label>
                  <input
                    type="text"
                    id="re-price"
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue="175000"
                    aria-describedby="hint-price"
                  />
                  <div className="balance-field-hint" id="hint-price">
                    Use AI research or listings to anchor price for your market
                  </div>
                </div>
                <div className="balance-field">
                  <label htmlFor="re-rent">Monthly rent estimate</label>
                  <input
                    type="text"
                    id="re-rent"
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue="1445"
                    aria-describedby="hint-rent"
                  />
                  <div className="balance-field-hint" id="hint-rent">
                    Align rent with local comps for the area you selected
                  </div>
                </div>
                <div className="balance-field">
                  <label htmlFor="re-hoa">HOA fee ($/mo)</label>
                  <input
                    type="text"
                    id="re-hoa"
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue="450"
                    aria-describedby="hint-hoa"
                  />
                  <div className="balance-field-hint" id="hint-hoa">
                    HOA varies by building and region — verify in the listing
                  </div>
                </div>
                <div className="balance-field">
                  <label htmlFor="re-tax">Property tax rate (% / year)</label>
                  <input
                    type="text"
                    id="re-tax"
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue="1.2"
                    aria-describedby="hint-tax"
                  />
                  <div className="balance-field-hint" id="hint-tax">
                    Often ~1–2% effective; use assessor estimate
                  </div>
                </div>
                <div className="balance-field">
                  <label htmlFor="re-ins">Insurance ($/mo)</label>
                  <input
                    type="text"
                    id="re-ins"
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue="150"
                    aria-describedby="hint-ins"
                  />
                  <div className="balance-field-hint" id="hint-ins">
                    Coastal wind zones can be much higher
                  </div>
                </div>
                <div className="balance-field">
                  <label htmlFor="re-vac">Vacancy rate (%)</label>
                  <input
                    type="text"
                    id="re-vac"
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue="5"
                    aria-describedby="hint-vac"
                  />
                  <div className="balance-field-hint" id="hint-vac">
                    5–8% common for planning
                  </div>
                </div>
              </div>
              <div className="re-pm-toggle">
                <label htmlFor="re-include-pm">
                  <input type="checkbox" id="re-include-pm" defaultChecked aria-describedby="re-include-pm-hint" />
                  <span>Include property management fee (8% of effective gross income)</span>
                </label>
                <span className="re-pm-toggle-hint" id="re-include-pm-hint">
                  Uncheck to model self-management (no third-party PM fee). CapEx and other costs still apply.
                </span>
              </div>
              <button type="button" className="btn-save" id="re-recalc">
                Recalculate
              </button>
            </div>

            <div className="re-compare-grid">
              <div className="re-path-card fha">
                <h3>FHA path</h3>
                <div id="re-fha-kv"></div>
              </div>
              <div className="re-path-card llc">
                <h3>LLC / investment path</h3>
                <div id="re-llc-kv"></div>
              </div>
            </div>

            <div className="timeline-wrap">
              <table className="re-cf-table" id="re-cf-table" aria-label="Monthly cash flow comparison">
                <thead>
                  <tr>
                    <th>Line item</th>
                    <th>FHA</th>
                    <th>LLC</th>
                  </tr>
                </thead>
                <tbody id="re-cf-tbody"></tbody>
              </table>
            </div>

            <div className="callout" id="re-cf-scenario" style={{ marginTop: 18 }}></div>
          </div>
          </div>
        </details>

        <details className="section section-collapsible" open>
          <summary className="section-collapsible__summary">
            <span className="section-collapsible__chevron" aria-hidden="true"></span>
            <span className="section-collapsible__summary-text">
              <span className="section-title">Market snapshot</span>
            </span>
          </summary>
          <div className="section-collapsible__anim">
            <div className="section-collapsible__body">
            <p className="section-sub" id="re-market-snapshot-sub">
              Select a city in <strong>Market &amp; location</strong> above; numbers update from your calculator inputs.
            </p>
            <div className="budget-wrap" style={{ overflowX: 'auto' }}>
              <table className="re-market-table" aria-describedby="re-market-snapshot-sub">
                <thead>
                  <tr>
                    <th>Location</th>
                    <th>Rent (model)</th>
                    <th>HOA (model)</th>
                    <th>Price (model)</th>
                    <th>Cash flow outlook</th>
                  </tr>
                </thead>
                <tbody id="re-market-tbody">
                  <tr>
                    <td id="re-market-name">
                      <span className="re-recent-meta">Search &amp; select a city</span>
                    </td>
                    <td id="re-market-rent">—</td>
                    <td id="re-market-hoa">—</td>
                    <td id="re-market-price">—</td>
                    <td id="re-market-outlook">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </details>

        <details className="section section-collapsible" open>
          <summary className="section-collapsible__summary">
            <span className="section-collapsible__chevron" aria-hidden="true"></span>
            <span className="section-collapsible__summary-text">
              <span className="section-title">Down Payment From HYSA</span>
            </span>
          </summary>
          <div className="section-collapsible__anim">
            <div className="section-collapsible__body">
            <div className="re-stat-row">
              <div className="re-stat-card">
                <div className="status-label" style={{ marginBottom: 0 }}>
                  HYSA target
                </div>
                <div className="val" id="re-hysa-target">
                  $50,000
                </div>
              </div>
              <div className="re-stat-card">
                <div className="status-label" style={{ marginBottom: 0 }}>
                  FHA total cash needed
                </div>
                <div className="val" id="re-stat-fha-cash">
                  —
                </div>
              </div>
              <div className="re-stat-card">
                <div className="status-label" style={{ marginBottom: 0 }}>
                  LLC total cash needed
                </div>
                <div className="val" id="re-stat-llc-cash">
                  —
                </div>
              </div>
            </div>
            <div className="budget-wrap">
              <table className="re-market-table" id="re-hysa-table">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Cash required</th>
                    <th>HYSA left after</th>
                  </tr>
                </thead>
                <tbody id="re-hysa-tbody"></tbody>
              </table>
            </div>
            <div className="callout blue" id="re-hysa-callout"></div>
          </div>
          </div>
        </details>

        <details className="section section-collapsible" open>
          <summary className="section-collapsible__summary">
            <span className="section-collapsible__chevron" aria-hidden="true"></span>
            <span className="section-collapsible__summary-text">
              <span className="section-title">FHA House Hack Strategy</span>
            </span>
          </summary>
          <div className="section-collapsible__anim">
            <div className="section-collapsible__body">
            <div className="callout red" style={{ marginBottom: 14 }}>
              <strong>12-month owner-occupancy</strong>
              FHA loans for 1–4 unit properties generally require you to occupy the property as your primary residence.
              You typically must move in within 60 days and live there at least 12 months before converting to a rental
              (unless an exception applies). Plan the timeline before you commit.
            </div>
            <div className="callout sage">
              <strong>House-hack math</strong>
              On a duplex, FHA may allow a portion of projected rent from the other unit to help qualify (often up to 75%
              of market rent toward income/DTI per current FHA guidelines — confirm with your loan officer and appraiser
              rent schedule).
            </div>
          </div>
          </div>
        </details>

        <div className="section section-static section-static--plain" aria-label="Verdict">
            <div className="goal-card primary" style={{ marginTop: 8 }}>
              <div className="goal-tag">Verdict</div>
              <div
                className="re-hero-title"
                style={{ color: 'var(--cream)', fontSize: 'clamp(26px,4vw,36px)' }}
                id="re-verdict-title"
              >
                Start with FHA in your market — LLC comes later.
              </div>
              <p className="goal-desc" style={{ marginTop: 14, maxWidth: 640 }} id="re-verdict-body">
                FHA keeps the entry ticket small enough to match a realistic HYSA timeline. Choose a city above to tie
                numbers to a real market. An LLC + investment loan is often the right tool for <strong>property #2</strong>
                , once you have equity, documented rental history on taxes, and more dry powder for 20% down and reserves.
              </p>
              <p className="goal-desc" style={{ marginTop: 12, fontWeight: 700 }} id="re-verdict-hoa-warning">
                Warning: HOA fees and special assessments are the single biggest risk to condo cash flow — model them
                conservatively every time.
              </p>
            </div>
        </div>

        <details className="section section-collapsible" open>
          <summary className="section-collapsible__summary">
            <span className="section-collapsible__chevron" aria-hidden="true"></span>
            <span className="section-collapsible__summary-text">
              <span className="section-title">Roadmap Timeline</span>
            </span>
          </summary>
          <div className="section-collapsible__anim">
            <div className="section-collapsible__body">
            <div className="re-timeline">
              <div className="re-milestone">
                <div className="re-milestone-title">Now–Mid 2026 · Research Mode</div>
                <div className="re-milestone-body" id="re-timeline-research-body">
                  Study your target market, follow listings, and line up a local agent who knows condos/HOAs.
                </div>
              </div>
              <div className="re-milestone">
                <div className="re-milestone-title">Dec 2026 · CC Debt Eliminated</div>
                <div className="re-milestone-body">Lower debt improves DTI; begin FHA pre-approval prep with your lender.</div>
              </div>
              <div className="re-milestone">
                <div className="re-milestone-title">Early 2027 · Get FHA Pre-Approved</div>
                <div className="re-milestone-body">
                  Typical needs: 2 years W-2s, pay stubs, bank statements, 620+ credit score (higher is better).
                </div>
              </div>
              <div className="re-milestone">
                <div className="re-milestone-title">Mid 2027 · Make Your Move</div>
                <div className="re-milestone-body">
                  At $50K HYSA, deploy roughly $10–14K toward an FHA purchase and keep $36K+ as reserves (targets depend on
                  your calculator outputs).
                </div>
              </div>
              <div className="re-milestone">
                <div className="re-milestone-title">Mid 2028+ · LLC Property #2</div>
                <div className="re-milestone-body">
                  Rental income history on taxes, equity in property #1, and reserves — ready for a 20% investment loan.
                </div>
              </div>
            </div>
          </div>
          </div>
        </details>
      </div>

      <div className="footer">
        <strong>Research. Plan. Execute. Repeat.</strong>
        <div className="re-footer-sub">First property by mid-2027 · Portfolio building from 2028.</div>
        <p className="re-disclaimer">This page is for planning purposes only and does not constitute financial or legal advice.</p>
        <div className="footer-meta" id="footer-meta" title="App version">
          <button type="button" className="footer-version" id="footer-app-version" aria-label="Application version"></button>
        </div>
      </div>

      <dialog className="appearance-dialog no-print" id="appearance-dialog" aria-labelledby="appearance-dialog-title" aria-modal="true">
        <div className="appearance-dialog__chrome">
          <div className="appearance-dialog__header">
            <h2 className="appearance-dialog__title" id="appearance-dialog-title">
              Appearance
            </h2>
            <button type="button" className="appearance-dialog__close" data-close-appearance-dialog aria-label="Close dialog">
              ×
            </button>
          </div>
          <div className="appearance-dialog__body">
            <p className="appearance-dialog__intro">
              Choose a color palette. Your choice is saved in this browser and applies to PennyPath pages that share
              this header.
            </p>
            <div className="palette-options" role="listbox" aria-label="Color palettes">
              <button type="button" className="palette-option" role="option" data-palette="pastel" id="palette-opt-pastel">
                <span className="palette-option__preview" aria-hidden="true"></span>
                <span className="palette-option__text">
                  <span className="palette-option__name">Pastel</span>
                  <span className="palette-option__blurb">Soft blues, warm cream</span>
                </span>
              </button>
              <button type="button" className="palette-option" role="option" data-palette="classic" id="palette-opt-classic">
                <span className="palette-option__preview" aria-hidden="true"></span>
                <span className="palette-option__text">
                  <span className="palette-option__name">Classic</span>
                  <span className="palette-option__blurb">Navy, gold, sage</span>
                </span>
              </button>
              <button type="button" className="palette-option" role="option" data-palette="ocean" id="palette-opt-ocean">
                <span className="palette-option__preview" aria-hidden="true"></span>
                <span className="palette-option__text">
                  <span className="palette-option__name">Ocean</span>
                  <span className="palette-option__blurb">Teal, sea glass, sand</span>
                </span>
              </button>
              <button type="button" className="palette-option" role="option" data-palette="forest" id="palette-opt-forest">
                <span className="palette-option__preview" aria-hidden="true"></span>
                <span className="palette-option__text">
                  <span className="palette-option__name">Forest</span>
                  <span className="palette-option__blurb">Moss, bark, honey</span>
                </span>
              </button>
              <button type="button" className="palette-option" role="option" data-palette="sunset" id="palette-opt-sunset">
                <span className="palette-option__preview" aria-hidden="true"></span>
                <span className="palette-option__text">
                  <span className="palette-option__name">Sunset</span>
                  <span className="palette-option__blurb">Rose, peach, amber</span>
                </span>
              </button>
            </div>
            <div className="appearance-dialog__section appearance-dialog__dev" id="appearance-dev-section" hidden>
              <p className="appearance-dialog__section-label">Developer</p>
              <p className="appearance-dialog__dev-hint">
                When on, supported areas show setup and diagnostic details (for example the AI Payoff Plan section).
              </p>
              <label className="appearance-dev-toggle">
                <input type="checkbox" id="dev-mode-technical-toggle" />
                <span>Show technical messages and setup details</span>
              </label>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}

