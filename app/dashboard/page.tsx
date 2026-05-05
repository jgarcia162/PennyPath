'use client';

import Link from 'next/link';
import { useEffect, useState, memo } from 'react';
import { AppLoadingOverlay } from '../components/AppLoadingOverlay';
import { LogoutForm } from '../components/LogoutForm';
import { TrialCountdown } from '../components/TrialCountdown';
import { migrateLocalStorageToSupabase } from '../../lib/migrate-localstorage';
import { clearDemoModeIfTrialEnded, maybeEnableTrialSessionFromUrl } from '../../lib/trial/trial-session';

/**
 * Keeps the whole Goal 2 editor chrome (ledger tabs, sort control, and list host) off React’s
 * reconciliation path. The savings dialog only wraps the list this way; debts used to wrap only
 * the list while the header lived in a sibling React subtree—parent re-renders could replace
 * tab/select DOM and steal focus from inputs in the list.
 */
const StableGoal2DebtsEditorFields = memo(
  function StableGoal2DebtsEditorFields() {
    return (
      <>
        <div className="debts-editor-header">
          <div className="debts-editor-title">Debts</div>
          <div className="debts-editor-ledger-tabs no-print" role="tablist" aria-label="Which debts to edit">
            <button
              type="button"
              className="debts-editor-ledger-tab is-selected"
              role="tab"
              data-debts-segment="active"
              id="debts-segment-active"
              aria-selected="true"
              tabIndex={0}
            >
              Active
            </button>
            <button
              type="button"
              className="debts-editor-ledger-tab"
              role="tab"
              data-debts-segment="completed"
              id="debts-segment-completed"
              aria-selected="false"
              tabIndex={-1}
            >
              Paid off
            </button>
          </div>
          <div className="debts-editor-sort">
            <label htmlFor="debts-editor-sort" className="debts-editor-sort-label">
              Sort by
            </label>
            <select id="debts-editor-sort" className="debts-editor-sort-select" aria-label="Sort debts">
              <option value="saved">Saved order</option>
              <option value="balance-desc">Balance (high → low)</option>
              <option value="balance-asc">Balance (low → high)</option>
              <option value="apr-desc">APR % (high → low)</option>
              <option value="apr-asc">APR % (low → high)</option>
            </select>
          </div>
        </div>
        <div className="debts-editor-list" id="debts-editor-list" suppressHydrationWarning />
      </>
    );
  },
  () => true
);

const StableSavingsEditorListHost = memo(
  function StableSavingsEditorListHost() {
    return <div className="savings-editor-list" id="savings-editor-list" suppressHydrationWarning />;
  },
  () => true
);

export default function DashboardPage() {
  const [booting, setBooting] = useState(true);
  const [planCollapseLabel, setPlanCollapseLabel] = useState<'Collapse all' | 'Expand all'>('Collapse all');

  function animateSection(details: HTMLDetailsElement, expand: boolean) {
    const summary = details.querySelector('summary') as HTMLElement | null;
    const anim = details.querySelector('.section-collapsible__anim') as HTMLElement | null;
    if (!summary || !anim) {
      details.open = expand;
      return;
    }

    const startHeight = details.offsetHeight;

    if (expand) {
      details.open = true;
    }

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

  function wireAnimatedSections(rootId: string) {
    const root = document.getElementById(rootId);
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

  function toggleAllCollapsibles(rootId: string) {
    const root = document.getElementById(rootId);
    if (!root) return;
    const details = root.querySelectorAll('details.section-collapsible');
    const anyOpen = Array.from(details).some((d) => d instanceof HTMLDetailsElement && d.open);
    const nextOpen = !anyOpen;
    details.forEach((d) => {
      if (!(d instanceof HTMLDetailsElement)) return;
      animateSection(d, nextOpen);
    });
    setPlanCollapseLabel(nextOpen ? 'Collapse all' : 'Expand all');
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      // Everything below assumes a browser environment and the DOM nodes rendered by this page.
      // Load order matches `financial-plan-v3-aggressive.html`.
      try {
        maybeEnableTrialSessionFromUrl();
        clearDemoModeIfTrialEnded();
        await import('../../assets/safe-api-origin');
        await import('../../assets/theme-service');
        await import('../../assets/color-palette-service');
        await import('../../assets/site-settings');
        await import('../../assets/dev-mode');
        await import('../../assets/financial-plan/payoff-projection.js');
        await import('../../assets/checkin-service');
        await import('../../assets/badges');

        await migrateLocalStorageToSupabase();

        // Entrypoint: wires UI and features (reads DOM immediately if document is ready).
        const { bootFinancialPlanPage } = await import('../../assets/financial-plan/main');
        await bootFinancialPlanPage();
      } catch (e) {
        if (cancelled) return;
        // Keep the page usable even if wiring fails; surface a console error for debugging.
        // eslint-disable-next-line no-console
        console.error('Failed to boot Financial Plan dashboard:', e);
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return wireAnimatedSections('panel-plan');
  }, []);

  return (
    <div suppressHydrationWarning>
      {booting ? (
        <AppLoadingOverlay message="Loading your financial plan…" ariaLabel="Loading financial plan application" />
      ) : null}
      <header className="site-header no-print">
        <Link href="/dashboard" className="site-header__brand logo" aria-label="PennyPath home">
          <div className="logo__mark" aria-hidden="true">
            🌿
          </div>
          <span className="logo__text">PennyPath</span>
        </Link>
        <nav className="site-nav" aria-label="Site">
          <a className="site-nav__tab site-nav__tab--active" href="/dashboard" aria-current="page">
            💰 Financial Plan
          </a>
          <a className="site-nav__tab" href="/real-estate">
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
            <li data-dev-only="sample-data" hidden>
              <div className="site-settings-menu-section">
                <span className="site-settings-menu-label">Sample data</span>
                <label className="site-settings-demo-toggle">
                  <input type="checkbox" id="demo-mode-toggle" />
                  <span>Use sample data (demo)</span>
                </label>
              </div>
            </li>
            <li data-dev-only="developer-settings" hidden>
              <div className="site-settings-menu-section">
                <span className="site-settings-menu-label">Developer</span>
                <button type="button" className="site-settings-item" id="btn-dev-lock">
                  Lock developer options
                </button>
                <p className="site-settings-dev-hint">
                  Clears the developer unlock (same as a fresh browser). Use the footer version gesture to unlock
                  again.
                </p>
              </div>
            </li>
            <li>
              <div className="site-settings-menu-section">
                <span className="site-settings-menu-label">Data</span>
                <button
                  type="button"
                  className="site-settings-item site-settings-item--danger"
                  id="btn-wipe-all-data"
                  title="Clear all saved balances, debts, savings, check-ins, and milestone progress in this browser"
                >
                  Reset all data
                </button>
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
        <div className="cover-label">Family Financial Plan · 2026 – 2027</div>
        <h1>
          Our Plan to Get
          <br />
          Free &amp; Save Big 💸
        </h1>
        <div className="cover-sub" id="cover-sub"></div>
        <div className="cover-stats">
          <div className="cover-stat">
            <div className="cover-stat-label">Take-Home Pay</div>
            <div className="cover-stat-val" id="cover-takehome"></div>
            <div className="cover-stat-note">per month</div>
          </div>
          <div className="cover-stat">
            <div className="cover-stat-label">Debt-Free By</div>
            <div className="cover-stat-val" id="cover-debt-free-date"></div>
            <div className="cover-stat-note" id="cover-debt-free-note"></div>
          </div>
          <div className="cover-stat">
            <div className="cover-stat-label" id="cover-hysa-goal-label"></div>
            <div className="cover-stat-val" id="cover-hysa-by"></div>
            <div className="cover-stat-note" id="cover-hysa-note"></div>
          </div>
        </div>
      </div>

      <div className="content">
        <div className="history-demo-banner no-print" id="financial-plan-demo-banner" hidden>
          <strong>Sample data mode</strong> — Turn off the toggle in Settings to use your own data.
        </div>

        <div className="page-tabs no-print" role="tablist" aria-label="Financial Plan tabs">
          <button
            type="button"
            className="page-tab-btn"
            id="tab-plan"
            role="tab"
            aria-selected="true"
            aria-controls="panel-plan"
          >
            Financial Plan
          </button>
          <button
            type="button"
            className="page-tab-btn"
            id="tab-dashboard"
            role="tab"
            aria-selected="false"
            aria-controls="panel-dashboard"
          >
            Dashboard
          </button>
        </div>

        <section className="page-tab-panel" id="panel-plan" role="tabpanel" aria-labelledby="tab-plan">
          <div className="collapsible-controls no-print">
            <button
              type="button"
              className="collapsible-controls__toggle"
              onClick={() => toggleAllCollapsibles('panel-plan')}
            >
              {planCollapseLabel}
            </button>
          </div>

          {/* SECTION 01 */}
          <details className="section section-collapsible" open>
            <summary className="section-collapsible__summary">
              <span className="section-collapsible__chevron" aria-hidden="true"></span>
              <span className="section-collapsible__summary-text">
                <span className="section-title">Where We Stand Today</span>
              </span>
            </summary>
            <div className="section-collapsible__anim">
              <div className="section-collapsible__body">
              <div className="top-actions no-print">
                <button
                  type="button"
                  className="btn-undo"
                  data-open-dashboard="debts"
                >
                  Edit Debts and Savings
                </button>
              </div>

            <div className="status-grid">
              <div className="status-card positive">
                <div className="status-label">Joint Account Balance</div>
                <div className="status-value" id="status-hysa"></div>
                <div className="status-note" id="status-hysa-note"></div>
              </div>
              <div className="status-card neutral">
                <div className="status-label">Personal Savings</div>
                <div className="status-value" id="status-personal"></div>
                <div className="status-note" id="status-personal-note"></div>
              </div>
              <div className="status-card negative">
                <div className="status-label">Debt</div>
                <div className="status-value" id="status-debt-rounded"></div>
                <div className="status-note" id="status-debt-note"></div>
              </div>
              <div className="status-card income">
                <div className="status-label">Monthly Take-Home</div>
                <div className="status-value" id="status-takehome"></div>
                <div className="status-note" id="status-takehome-note"></div>
              </div>
            </div>

            <div className="networth-wrap">
              <div className="networth-label">Current Net Worth (Assets vs. Debt)</div>
              <div className="networth-bar-track">
                <div className="networth-bar-fill" id="nw-fill-assets"></div>
                <div className="networth-bar-fill debt" id="nw-fill-debt"></div>
              </div>
              <div className="networth-legend">
                <span>
                  <span className="dot-sage"></span> <span id="nw-legend-assets"></span>
                </span>
                <span>
                  <span className="dot-red"></span> <span id="nw-legend-debt"></span>
                </span>
              </div>
              <div className="networth-total">
                <span id="nw-total-line"></span> <span id="nw-total-sub"></span>
              </div>
            </div>
              </div>
            </div>
          </details>

          {/* SECTION 02 */}
          <details className="section section-collapsible" open>
            <summary className="section-collapsible__summary">
              <span className="section-collapsible__chevron" aria-hidden="true"></span>
              <span className="section-collapsible__summary-text">
                <span className="section-title">Where We Want to Be</span>
              </span>
            </summary>
            <div className="section-collapsible__anim">
              <div className="section-collapsible__body">

            <details className="plan-goals-editor no-print" id="plan-goals-editor">
              <summary className="btn-undo plan-goals-editor__toggle">
                Edit Goals
              </summary>
              <div className="goal-editor-inner balance-editor plan-goals-editor__panel">

                <div className="plan-goals-editor__section">
                  <div className="debts-editor-header plan-goals-editor__subheader">
                    <div className="debts-editor-title">Savings targets</div>
                  </div>
                  <p className="balance-editor-note plan-goals-editor__targets-note">
                    Each target can include the full balance of accounts you link in the savings editor. One account can
                    count toward several goals.
                  </p>
                  <div
                    id="savings-goals-target-editor"
                    className="debts-editor-list goals-targets-editor-list"
                    aria-label="Savings goal targets"
                  ></div>
                  <div className="balance-editor-actions balance-editor-actions--goal-targets-add">
                    <span className="balance-editor-actions-primary" aria-hidden="true"></span>
                    <button type="button" className="btn-add-debt balance-editor-actions-add" id="btn-add-savings-goal">
                      + Add savings goal
                    </button>
                  </div>
                </div>

                <div className="balance-editor-actions">
                  <div className="balance-editor-actions-primary">
                    <button type="button" className="btn-save" id="btn-save-goal-targets">
                      Save goals
                    </button>
                    <span className="balance-saved-hint" id="goal-targets-save-status" aria-live="polite"></span>
                  </div>
                </div>
              </div>
            </details>

            <div className="goals-grid">
              <div className="goal-card primary">
                <div className="goal-tag">Goal 1 — Primary 🏡</div>
                <div className="goal-value" id="goal-hysa-amt"></div>
                <div className="goal-desc">
                  in our High Yield Savings Account — fully funded, growing, and untouched by debt.
                </div>
                <div className="goal-when" id="goal-hysa-when"></div>
              </div>

              <div className="goal-card secondary-a">
                <div className="goal-card-head" id="goal2-card-head">
                  <div className="goal-tag">Goal 2</div>
                  <button
                    type="button"
                    className="toggle-goal-editor-btn no-print"
                    id="btn-toggle-goal2-editor"
                    data-open-dashboard="debts"
                    aria-expanded="false"
                    aria-haspopup="dialog"
                    aria-controls="goal2-editor-dialog"
                  >
                    Edit debts
                  </button>
                </div>
                <div className="goal-value" id="goal-debt-amt"></div>
                <div className="goal-desc" id="goal-debt-desc"></div>
                <div className="goal-when" id="goal-debt-when"></div>
                <div className="progress-wrap">
                  <div className="progress-label-row debt">
                    <span id="debt-progress-left"></span>
                    <span id="debt-progress-right"></span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill-debt" id="debt-progress-fill"></div>
                  </div>
                </div>
                <div className="monthly-debt-goal-wrap" id="monthly-debt-goal-section">
                  <div className="monthly-debt-goal-head">
                    <span className="monthly-debt-goal-title">This month toward debt</span>
                    <span className="monthly-debt-goal-meta" id="monthly-debt-goal-meta"></span>
                  </div>
                  <div className="progress-wrap monthly-debt-goal-bar">
                    <div className="progress-label-row debt">
                      <span id="monthly-debt-paid-label"></span>
                      <span id="monthly-debt-pct-label"></span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill-debt" id="monthly-debt-progress-fill"></div>
                    </div>
                  </div>
                  <p className="monthly-debt-goal-hint" id="monthly-debt-goal-hint"></p>
                </div>
              </div>

              <div className="goal-card secondary-b">
                <div className="goal-card-head" id="goal3-card-head">
                  <div className="goal-tag">Goal 3 — Savings goals 🚨</div>
                  <button
                    type="button"
                    className="toggle-goal-editor-btn no-print"
                    id="btn-toggle-goal3-editor"
                    data-open-dashboard="savings"
                    aria-expanded="false"
                    aria-haspopup="dialog"
                    aria-controls="goal3-editor-dialog"
                  >
                    Edit savings
                  </button>
                </div>
                <div className="goal-value" id="goal-efund-amt"></div>
                <div className="goal-desc" id="goal-efund-desc"></div>
                <div className="goal-when" id="goal-efund-when"></div>

                <div className="savings-goals-stack" id="savings-goals-stack"></div>
              </div>
            </div>

            <div className="callout sage" id="callout-full-picture"></div>
              </div>
            </div>
          </details>

          {/* SECTION 03 */}
          <details className="section section-collapsible" id="section-how-we-get-there" open>
            <summary className="section-collapsible__summary">
              <span className="section-collapsible__chevron" aria-hidden="true"></span>
              <span className="section-collapsible__summary-text">
                <span className="section-title">How We Get There</span>
              </span>
            </summary>
            <div className="section-collapsible__anim">
              <div className="section-collapsible__body">

            <div className="how-we-get-there__tabs-row no-print">
              <div className="page-tabs" role="tablist" aria-label="How we get there">
                <button
                  type="button"
                  className="page-tab-btn"
                  role="tab"
                  id="tab-how-original"
                  aria-selected="true"
                  aria-controls="panel-how-original"
                >
                  Original plan
                </button>
                <button
                  type="button"
                  className="page-tab-btn"
                  role="tab"
                  id="tab-how-ai"
                  aria-selected="false"
                  tabIndex={-1}
                  aria-controls="panel-how-ai"
                >
                  AI payoff plan
                </button>
              </div>
              <div className="how-we-get-there__generate-wrap">
                <button type="button" className="ai-payoff-generate-btn" id="btn-ai-payoff-generate">
                  Generate plan
                </button>
                <span className="ai-payoff-status" id="ai-payoff-status" role="status"></span>
              </div>
            </div>

            <div id="panel-how-original" role="tabpanel" aria-labelledby="tab-how-original">
              <div className="plan-phases">
                <div className="phase-card p1">
                  <div className="phase-num">Phase 1 · October 2026 - December 2026</div>
                  <div className="phase-name">Destroy the Debt</div>
                  <div className="phase-row">
                    <span className="label">CC Payment</span>
                    <span className="val" id="phase1-cc"></span>
                  </div>
                  <div className="phase-row">
                    <span className="label">HYSA Deposit</span>
                    <span className="val" id="phase1-hysa"></span>
                  </div>
                  <div className="phase-row">
                    <span className="label">Duration</span>
                    <span className="val" id="phase1-dur"></span>
                  </div>
                  <div className="phase-row">
                    <span className="label">Result</span>
                    <span className="val">Debt: $0</span>
                  </div>
                </div>
                <div className="phase-card p2">
                  <div className="phase-num">Phase 2 · Jan – Jun 2027</div>
                  <div className="phase-name">Build the Savings</div>
                  <div className="phase-row">
                    <span className="label">CC Payment</span>
                    <span className="val">$0</span>
                  </div>
                  <div className="phase-row">
                    <span className="label">HYSA Deposit</span>
                    <span className="val" id="phase2-hysa"></span>
                  </div>
                  <div className="phase-row">
                    <span className="label">Duration</span>
                    <span className="val" id="phase2-dur"></span>
                  </div>
                  <div className="phase-row">
                    <span className="label">Result</span>
                    <span className="val" id="phase2-result"></span>
                  </div>
                </div>
              </div>

              <div className="section-eyebrow" style={{ marginTop: 32, marginBottom: 12 }}>
                Monthly Budget Breakdown
              </div>

              <div className="budget-controls no-print">
                <button type="button" id="budget-edit-toggle" className="btn-undo" aria-pressed="false">
                  Edit
                </button>
                <button type="button" id="budget-done-btn" className="btn-save" hidden>
                  Done
                </button>
                <button type="button" id="budget-cancel-btn" className="btn-undo" hidden>
                  Cancel
                </button>
                <button type="button" id="budget-undo-btn" className="btn-undo" hidden>
                  Undo
                </button>
                <span id="budget-edit-status" className="budget-edit-status" aria-live="polite"></span>
              </div>

              <div id="budget-breakdown-wrap" className="budget-wrap budget-wrap--display">
                <div className="budget-header budget-header--4">
                  <span>Category</span>
                  <span>Amount</span>
                  <span>%</span>
                  <span className="budget-header__action" aria-hidden="true"></span>
                </div>
                <div id="budget-breakdown-rows"></div>
                <div className="budget-add-row no-print">
                  <button type="button" className="btn-undo" id="budget-add-row-btn">
                    + Add category
                  </button>
                </div>
                <div className="budget-row total budget-row--total-static">
                  <span>Total</span>
                  <span className="budget-amount" id="budget-total"></span>
                  <span className="budget-pct">100%</span>
                  <span className="budget-header__action" aria-hidden="true"></span>
                </div>
              </div>

              <div className="callout" id="callout-phase2"></div>
              <div className="callout blue" id="callout-fun"></div>
            </div>

            <div id="panel-how-ai" role="tabpanel" aria-labelledby="tab-how-ai" hidden>
              <div className="ai-payoff-setup no-print">
                <p className="ai-payoff-intro">
                  Get a suggested payoff order and monthly allocation based on your debts, interest rates, and any
                  deferred-interest promotions. Results are generated with Google Gemini and require an internet
                  connection.
                </p>
                <p className="ai-payoff-intro ai-payoff-intro--technical" data-dev-copy="technical" hidden>
                  <strong className="ai-payoff-dev-label">Technical</strong>
                  The request is sent to your PennyPath server, which uses <code className="ai-payoff-code">GEMINI_API_KEY</code> from{' '}
                  <code className="ai-payoff-code">.env</code> (same as other Gemini features). For local testing, run{' '}
                  <code className="ai-payoff-code">npm run research-server</code> and open this page at{' '}
                  <code className="ai-payoff-code">http://127.0.0.1:8787/financial-plan-v3-aggressive.html</code>.
                </p>
              </div>
              <div className="ai-payoff-refine no-print">
                <label className="ai-payoff-refine__label" htmlFor="ai-payoff-refine-input">
                  Ask for changes
                </label>
                <p className="ai-payoff-refine__hint" id="ai-payoff-refine-hint">
                  After a plan appears below, describe what you want different (for example: prioritize the car loan,
                  use snowball order, or add a shorter summary).
                </p>
                <textarea
                  id="ai-payoff-refine-input"
                  className="ai-payoff-refine__input"
                  rows={3}
                  maxLength={8000}
                  placeholder="Your feedback or instructions for the AI…"
                  aria-describedby="ai-payoff-refine-hint"
                  disabled
                ></textarea>
                <button type="button" className="ai-payoff-refine-btn" id="btn-ai-payoff-refine" disabled>
                  Refine plan
                </button>
              </div>
              <div className="ai-payoff-output" id="ai-payoff-output" aria-live="polite">
                <div className="ai-payoff-output__toolbar no-print" id="ai-payoff-toolbar" hidden>
                  <button type="button" className="ai-payoff-expand-btn" id="btn-ai-payoff-expand" aria-expanded="false">
                    Expand full plan
                  </button>
                </div>
                <div className="ai-payoff-scroll" id="ai-payoff-scroll" tabIndex={0}>
                  <p className="ai-payoff-placeholder section-sub" id="ai-payoff-placeholder-default">
                    Switch here and generate to see an AI-suggested payoff strategy.
                  </p>
                </div>
              </div>

              <div className="ai-bill-cal no-print">
                <h3 className="ai-bill-cal__heading">Payment &amp; bill calendar</h3>
                <p className="ai-bill-cal__intro">
                  Upload a CSV with your monthly bills. The AI places each bill on its due day and suggests dates to
                  make debt payments using your plan budget and (when available) the generated payoff strategy above.
                </p>
                <p className="ai-bill-cal__format">
                  The first row must be headers. Enter the exact header names from your file for bill name, amount, and
                  due day (day of month 1–31, recurring each month). Matching is not case-sensitive.
                </p>
                <div className="ai-bill-cal__columns" role="group" aria-label="CSV column mapping">
                  <label className="ai-bill-cal__col-field">
                    <span className="ai-bill-cal__col-label">Name column</span>
                    <input
                      type="text"
                      id="ai-bill-cal-col-name"
                      className="ai-bill-cal__col-input"
                      defaultValue="name"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                  <label className="ai-bill-cal__col-field">
                    <span className="ai-bill-cal__col-label">Amount column</span>
                    <input
                      type="text"
                      id="ai-bill-cal-col-amount"
                      className="ai-bill-cal__col-input"
                      defaultValue="amount"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                  <label className="ai-bill-cal__col-field">
                    <span className="ai-bill-cal__col-label">Due day column</span>
                    <input
                      type="text"
                      id="ai-bill-cal-col-due"
                      className="ai-bill-cal__col-input"
                      defaultValue="due_day"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                </div>
                <div className="ai-bill-cal__row">
                  <label className="ai-bill-cal__file-label">
                    <span className="ai-bill-cal__file-btn">Choose CSV</span>
                    <input type="file" id="ai-bill-cal-file" accept=".csv,text/csv" className="ai-bill-cal__file-input" />
                  </label>
                  <button type="button" className="ai-bill-cal-generate-btn" id="btn-ai-bill-cal-generate" disabled>
                    Generate calendar
                  </button>
                  <button
                    type="button"
                    className="ai-bill-cal-prompt-btn"
                    id="btn-ai-bill-cal-open-prompt"
                    disabled
                    title="Load a CSV with at least one valid bill first"
                  >
                    View prompt
                  </button>
                  <span className="ai-bill-cal__status" id="ai-bill-cal-status" role="status"></span>
                </div>
                <div id="ai-bill-cal-host" className="ai-bill-cal-host" aria-live="polite"></div>
              </div>

              <dialog
                id="ai-bill-cal-prompt-dialog"
                className="ai-bill-cal-prompt-dialog"
                aria-labelledby="ai-bill-cal-prompt-dialog-title"
              >
                <div className="ai-bill-cal-prompt-dialog__chrome">
                  <header className="ai-bill-cal-prompt-dialog__header">
                    <h3 id="ai-bill-cal-prompt-dialog-title" className="ai-bill-cal-prompt-dialog__title">
                      Calendar prompt
                    </h3>
                    <button
                      type="button"
                      className="ai-bill-cal-prompt-dialog__close"
                      id="btn-ai-bill-cal-prompt-close"
                      aria-label="Close"
                    >
                      &times;
                    </button>
                  </header>
                  <div className="ai-bill-cal-prompt-dialog__body">
                    <p className="ai-bill-cal-prompt-dialog__hint">
                      Use this with the in-app generator or on its own. Paste into an AI assistant and ask it to reply
                      with only the JSON object (no markdown fences) as specified at the end of the prompt.
                    </p>
                    <label className="ai-bill-cal-prompt-dialog__label" htmlFor="ai-bill-cal-prompt-text">
                      Prompt
                    </label>
                    <textarea
                      id="ai-bill-cal-prompt-text"
                      className="ai-bill-cal-prompt-dialog__textarea"
                      readOnly
                      rows={16}
                      spellCheck={false}
                    ></textarea>
                    <p className="ai-bill-cal-prompt-dialog__feedback" id="ai-bill-cal-prompt-feedback" aria-live="polite"></p>
                    <div className="ai-bill-cal-prompt-dialog__actions">
                      <button type="button" className="ai-bill-cal-prompt-dialog__action" id="btn-ai-bill-cal-prompt-copy">
                        Copy
                      </button>
                      <button type="button" className="ai-bill-cal-prompt-dialog__action" id="btn-ai-bill-cal-prompt-share">
                        Share
                      </button>
                      <button
                        type="button"
                        className="ai-bill-cal-prompt-dialog__action"
                        id="btn-ai-bill-cal-prompt-download"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              </dialog>
            </div>
              </div>
            </div>
          </details>

          {/* SECTION 04 */}
          <details className="section section-checkins section-collapsible" id="section-checkins" open>
            <summary className="section-collapsible__summary">
              <span className="section-collapsible__chevron" aria-hidden="true"></span>
              <span className="section-collapsible__summary-text">
                <span className="section-title">Monthly Check-In Log</span>
              </span>
            </summary>
            <div className="section-collapsible__anim">
              <div className="section-collapsible__body">
              <div className="checkin-wrap no-print">
                <form className="checkin-form" id="checkin-form">
                  <div className="balance-field">
                    <label htmlFor="checkin-date">Date</label>
                    <input type="date" id="checkin-date" required />
                  </div>
                  <div className="balance-field">
                    <label htmlFor="checkin-note">Note</label>
                    <input
                      type="text"
                      id="checkin-note"
                      autoComplete="off"
                      placeholder="What went well? What needs adjusting?"
                      required
                    />
                  </div>
                  <div className="checkin-actions">
                    <button type="submit" className="btn-save">
                      Add check-in
                    </button>
                  </div>
                </form>
                <div className="balance-saved-hint" id="checkin-status" aria-live="polite"></div>
              </div>
              <div className="checkin-list checkin-log" id="checkin-list"></div>
              <dialog className="checkin-log-dialog no-print" id="checkin-log-dialog" aria-labelledby="checkin-log-dialog-title">
                <div className="checkin-log-dialog__chrome">
                  <div className="checkin-log-dialog__header">
                    <h2 className="checkin-log-dialog__title" id="checkin-log-dialog-title">
                      All check-ins
                    </h2>
                    <button
                      type="button"
                      className="checkin-log-dialog__close no-print"
                      data-checkin-dialog-close
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                  <div className="checkin-log-dialog__body" id="checkin-log-dialog-body"></div>
                </div>
              </dialog>
              </div>
            </div>
          </details>

          {/* SECTION 05 */}
          <details className="section section-collapsible" id="section-milestones" open>
            <summary className="section-collapsible__summary">
              <span className="section-collapsible__chevron" aria-hidden="true"></span>
              <span className="section-collapsible__summary-text">
                <span className="section-title">Milestones</span>
              </span>
            </summary>
            <div className="section-collapsible__anim">
              <div className="section-collapsible__body">
                <div className="badges-grid" id="badges-grid"></div>
              </div>
            </div>
          </details>
        </section>

        <section
          className="page-tab-panel page-tab-panel--dashboard"
          id="panel-dashboard"
          role="tabpanel"
          aria-labelledby="tab-dashboard"
          data-dashboard-view="debts"
          hidden
        >
          <div className="dashboard-hero">
            <div className="dashboard-hero__title">Dashboard</div>
            <div className="dashboard-hero__sub">
              Edit debts and savings here. Changes reflect instantly in the Financial Plan outline.
            </div>
          </div>

          <div className="dashboard-month-wrap no-print">
            <div className="dashboard-month-wrap__row">
              <div className="dashboard-month-wrap__text">
                <span className="dashboard-month-wrap__eyebrow">View &amp; edit month</span>
                <div className="dashboard-month-wrap__picker-row">
                  <label className="dashboard-month-wrap__picker-label" htmlFor="dashboard-view-month">
                    Month
                  </label>
                  <select
                    id="dashboard-view-month"
                    className="dashboard-view-month-select"
                    aria-label="Month to view on the dashboard and date new payments"
                  ></select>
                </div>
                <p className="dashboard-month-wrap__working-note" id="dashboard-view-working-note" hidden></p>
              </div>
              <div className="dashboard-month-wrap__actions">
                <button type="button" className="btn-save" id="btn-month-wrap-up">
                  Wrap up month
                </button>
                <button type="button" className="btn-undo" id="btn-month-wrap-undo" disabled>
                  Undo last wrap
                </button>
              </div>
            </div>
            <p className="dashboard-month-wrap__hint">
              Pick a month to see that month’s debt progress and to log payments or deposits with dates in that month.
              “Follow working month” keeps the bar aligned with wrap-up. Wrapping saves a snapshot, advances the working
              month, and resets the monthly bar for the new month. Use Undo once if you need to fix the previous month.
            </p>
          </div>

          <div className="dashboard-view-toolbar no-print">
            <div className="dashboard-tabs" role="tablist" aria-label="Dashboard tabs">
              <button
                type="button"
                className="dashboard-tab-btn"
                id="tab-dashboard-debts"
                role="tab"
                aria-selected="true"
                aria-controls="panel-dashboard-debts"
              >
                Debts
              </button>
              <button
                type="button"
                className="dashboard-tab-btn"
                id="tab-dashboard-savings"
                role="tab"
                aria-selected="false"
                aria-controls="panel-dashboard-savings"
              >
                Savings
              </button>
            </div>

            <div className="dashboard-editor-actions" aria-label="Quick editors">
              <button
                type="button"
                className="dashboard-editor-action-btn dashboard-editor-action-btn--debts"
                id="btn-open-debts-editor"
                aria-expanded="false"
                aria-haspopup="dialog"
                aria-controls="goal2-editor-dialog"
              >
                Edit debts
              </button>
              <button
                type="button"
                className="dashboard-editor-action-btn dashboard-editor-action-btn--savings"
                id="btn-open-savings-editor"
                aria-expanded="false"
                aria-haspopup="dialog"
                aria-controls="goal3-editor-dialog"
              >
                Edit savings
              </button>
            </div>
          </div>

          <section className="dashboard-tab-panel" id="panel-dashboard-debts" role="tabpanel" aria-labelledby="tab-dashboard-debts">
            <div className="dashboard-split">
              <div className="dashboard-main">
                <div className="dashboard-card">
                  <div className="dashboard-card__head dashboard-card__head--split">
                    <div className="dashboard-card__title">Per-debt progress</div>
                    <div
                      className="dashboard-debts-paid-badge"
                      title="Times a debt has reached paid off (lifetime). Removing saved debts does not reduce this."
                    >
                      <span id="dash-debts-paid-off-lifetime" className="dashboard-debts-paid-badge__n">
                        0
                      </span>
                      <span className="dashboard-debts-paid-badge__lbl"> paid off</span>
                    </div>
                  </div>
                  <div className="goal2-debts-wrap">
                    <div className="goal2-debts-toolbar">
                      <div className="goal2-debts-toolbar-title">Cards</div>
                      <div className="debts-progress-sort">
                        <label htmlFor="debts-progress-sort" className="debts-editor-sort-label">
                          Sort by
                        </label>
                        <select id="debts-progress-sort" className="debts-editor-sort-select" aria-label="Sort per-debt progress cards">
                          <option value="saved">Saved order</option>
                          <option value="balance-desc">Balance (high → low)</option>
                          <option value="balance-asc">Balance (low → high)</option>
                          <option value="apr-desc">APR % (high → low)</option>
                          <option value="apr-asc">APR % (low → high)</option>
                          <option value="paid-desc">Amount paid (high → low)</option>
                          <option value="paid-asc">Amount paid (low → high)</option>
                        </select>
                      </div>
                    </div>
                    <div className="goal2-debts" id="goal2-debts"></div>
                  </div>
                  <div className="dashboard-debt-archives no-print" aria-label="Archived debts">
                    <details className="dashboard-debt-archive">
                      <summary className="dashboard-debt-archive-summary">
                        Paid off{' '}
                        <span className="dashboard-debt-archive-count" id="dash-archive-completed-count">
                          0
                        </span>
                      </summary>
                      <div id="dash-debts-completed-list" className="dash-debt-archive-list" />
                    </details>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            className="dashboard-tab-panel"
            id="panel-dashboard-savings"
            role="tabpanel"
            aria-labelledby="tab-dashboard-savings"
            hidden
          >
            <div className="dashboard-split">
              <div className="dashboard-main">
                <div className="dashboard-card">
                  <div className="dashboard-card__head">
                    <div className="dashboard-card__title">Accounts &amp; recent deposits</div>
                  </div>
                  <div className="goal3-savings" id="goal3-savings"></div>
                </div>
              </div>
            </div>
          </section>

          <section className="dashboard-deleted-bin no-print" aria-label="Recently deleted items">
            <details className="dashboard-deleted-bin-details">
              <summary className="dashboard-deleted-bin-summary">
                Recently deleted{' '}
                <span className="dashboard-debt-archive-count" id="dash-deleted-items-count">
                  0
                </span>
              </summary>
              <p className="dashboard-deleted-bin-hint">
                Debts and savings you removed <strong>after they were saved</strong> land here. Draft rows you delete
                before Save are discarded and do not appear.
              </p>
              <div id="dash-deleted-items-list" className="dash-deleted-items-list" />
            </details>
          </section>

          <div className="dashboard-goals-details no-print" id="dashboard-goals-at-glance">
            <div className="dashboard-goals-header">
              <button
                type="button"
                className="dashboard-goals-summary"
                id="dashboard-goals-toggle"
                aria-expanded="false"
                aria-controls="dashboard-goals-panel"
              >
                <span className="section-collapsible__chevron" aria-hidden="true"></span>
                <span className="dashboard-goals-title" id="dashboard-goals-heading">
                  Goals at a glance
                </span>
              </button>
            </div>
            <div
              className="dashboard-goals-anim"
              id="dashboard-goals-panel"
              role="region"
              aria-labelledby="dashboard-goals-heading"
              aria-hidden="true"
            >
              <div className="dashboard-goals-inner">
                <div className="goals-grid goals-grid--dashboard">
                  <div className="goal-card secondary-a">
                    <div className="goal-card-head">
                      <div className="goal-tag">Goal 2</div>
                    </div>
                    <div className="goal-value" id="dash-goal-debt-amt"></div>
                    <div className="goal-desc" id="dash-goal-debt-desc"></div>
                    <div className="goal-when" id="dash-goal-debt-when"></div>
                    <div className="progress-wrap">
                      <div className="progress-label-row debt">
                        <span id="dash-debt-progress-left"></span>
                        <span id="dash-debt-progress-right"></span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill-debt" id="dash-debt-progress-fill"></div>
                      </div>
                    </div>
                    <div className="monthly-debt-goal-wrap" id="dash-monthly-debt-goal-section">
                      <div className="monthly-debt-goal-head">
                        <span className="monthly-debt-goal-title">This month toward debt</span>
                        <span className="monthly-debt-goal-meta" id="dash-monthly-debt-goal-meta"></span>
                      </div>
                      <div className="progress-wrap monthly-debt-goal-bar">
                        <div className="progress-label-row debt">
                          <span id="dash-monthly-debt-paid-label"></span>
                          <span id="dash-monthly-debt-pct-label"></span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill-debt" id="dash-monthly-debt-progress-fill"></div>
                        </div>
                      </div>
                      <p className="monthly-debt-goal-hint" id="dash-monthly-debt-goal-hint"></p>
                    </div>
                  </div>

                  <div className="goal-card secondary-b">
                    <div className="goal-card-head">
                      <div className="goal-tag">Goal 3 — Savings goals 🚨</div>
                    </div>
                    <div className="goal-value" id="dash-goal-efund-amt"></div>
                    <div className="goal-desc" id="dash-goal-efund-desc"></div>
                    <div className="goal-when" id="dash-goal-efund-when"></div>

                    <div className="savings-goals-stack" id="dash-savings-goals-stack"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="footer">
        <strong>Phase 1: Destroy. Phase 2: Build. Phase 3: Protect.</strong>
        <span id="footer-line"></span>
        <div className="footer-meta" id="footer-meta" title="App version">
          <button type="button" className="footer-version" id="footer-app-version" aria-label="Application version">
            Version
          </button>
        </div>
      </div>

      <dialog
        className="goal-editor-dialog no-print"
        id="goal2-editor-dialog"
        aria-labelledby="goal2-editor-dialog-title"
        aria-modal="true"
      >
        <div className="goal-editor-dialog__chrome">
          <div className="goal-editor-dialog__header">
            <h2 className="goal-editor-dialog__title" id="goal2-editor-dialog-title">
              Debts editor
            </h2>
            <span className="goal-editor-dialog__meta toolwin__meta" id="goal2-editor-dialog-totals" aria-live="off"></span>
            <button type="button" className="goal-editor-dialog__close" data-close-goal-dialog aria-label="Close">
              ×
            </button>
          </div>
          <div className="goal-editor-dialog__body">
            <div className="goal-editor-inner balance-editor">
              <StableGoal2DebtsEditorFields />
              <div className="balance-editor-actions">
                <div className="balance-editor-actions-primary">
                  <button type="button" className="btn-save" id="btn-save-goal2-debts">
                    Save
                  </button>
                  <button type="button" className="btn-undo" id="btn-undo-goal2-debts">
                    Undo
                  </button>
                  <button type="button" className="btn-reset" id="btn-reset-goal2-debts">
                    Reset draft
                  </button>
                  <span className="balance-saved-hint" id="goal2-save-status" aria-live="polite"></span>
                </div>
                <button type="button" className="btn-add-debt balance-editor-actions-add" id="btn-add-debt">
                  + Add debt
                </button>
              </div>
            </div>
          </div>
        </div>
      </dialog>

      <dialog
        className="goal-editor-dialog no-print"
        id="goal3-editor-dialog"
        aria-labelledby="goal3-editor-dialog-title"
        aria-modal="true"
      >
        <div className="goal-editor-dialog__chrome">
          <div className="goal-editor-dialog__header">
            <h2 className="goal-editor-dialog__title" id="goal3-editor-dialog-title">
              Savings editor
            </h2>
            <span className="goal-editor-dialog__meta toolwin__meta" id="goal3-editor-dialog-totals" aria-live="off"></span>
            <button type="button" className="goal-editor-dialog__close" data-close-goal-dialog aria-label="Close">
              ×
            </button>
          </div>
          <div className="goal-editor-dialog__body">
            <div className="goal-editor-inner balance-editor">
              <StableSavingsEditorListHost />
              <div className="balance-editor-actions">
                <div className="balance-editor-actions-primary">
                  <button type="button" className="btn-save" id="btn-save-goal3-savings">
                    Save
                  </button>
                  <button type="button" className="btn-undo" id="btn-undo-goal3-savings">
                    Undo
                  </button>
                  <button type="button" className="btn-reset" id="btn-reset-goal3-savings">
                    Reset draft
                  </button>
                  <span className="balance-saved-hint" id="goal3-save-status" aria-live="polite"></span>
                </div>
                <button type="button" className="btn-add-debt balance-editor-actions-add" id="btn-add-savings">
                  + Add account
                </button>
              </div>
            </div>
          </div>
        </div>
      </dialog>

      <dialog
        className="appearance-dialog no-print"
        id="appearance-dialog"
        aria-labelledby="appearance-dialog-title"
        aria-modal="true"
      >
        <div className="appearance-dialog__chrome">
          <div className="appearance-dialog__header">
            <h2 className="appearance-dialog__title" id="appearance-dialog-title">
              Appearance
            </h2>
            <button
              type="button"
              className="appearance-dialog__close"
              data-close-appearance-dialog
              aria-label="Close dialog"
            >
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

