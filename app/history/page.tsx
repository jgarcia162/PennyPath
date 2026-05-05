'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AppLoadingOverlay } from '../components/AppLoadingOverlay';
import { LogoutForm } from '../components/LogoutForm';
import { TrialCountdown } from '../components/TrialCountdown';
import { clearDemoModeIfTrialEnded, maybeEnableTrialSessionFromUrl } from '../../lib/trial/trial-session';

export default function HistoryPage() {
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let disposeSiteSettings: (() => void) | undefined;
    document.body.classList.add('history-page');

    async function boot() {
      try {
        maybeEnableTrialSessionFromUrl();
        clearDemoModeIfTrialEnded();
        // Load order matches `history.html`.
        await import('../../assets/theme-service');
        await import('../../assets/color-palette-service');
        const siteSettings = await import('../../assets/site-settings');
        disposeSiteSettings?.();
        if (!cancelled) {
          disposeSiteSettings = siteSettings.bindSiteSettings();
        }
        await import('../../assets/dev-mode');
        await import('../../assets/checkin-service');
        await import('../../assets/financial-plan/history-main.js');
      } catch (e) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('Failed to boot History page:', e);
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
      disposeSiteSettings?.();
      document.body.classList.remove('history-page');
    };
  }, []);

  return (
    <div>
      {booting ? (
        <AppLoadingOverlay message="Loading history…" ariaLabel="Loading history page" />
      ) : null}
      <header className="site-header no-print">
        <Link href="/dashboard" className="site-header__brand logo" aria-label="PennyPath home">
          <div className="logo__mark" aria-hidden="true">
            🌿
          </div>
          <span className="logo__text">PennyPath</span>
        </Link>
        <nav className="site-nav" aria-label="Site">
          <Link className="site-nav__tab" href="/dashboard">
            💰 Financial Plan
          </Link>
          <Link className="site-nav__tab" href="/real-estate">
            🏠 Real Estate
          </Link>
          <Link className="site-nav__tab site-nav__tab--active" href="/history" aria-current="page">
            📅 History
          </Link>
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
            <li data-dev-only="sample-data">
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

      <div className="history-hero">
        <div className="history-eyebrow">Activity</div>
        <h1 className="history-title">Monthly history</h1>
        <p className="history-lead">
          Compare any two calendar months using payments and deposits you log in Goal 2 &amp; Goal 3, plus check-ins from
          the main plan. Balances shown elsewhere are always “today”; this page is only about <strong>recorded activity</strong>{' '}
          in each month.
        </p>
      </div>

      <div className="history-demo-banner" id="history-demo-banner" hidden>
        <strong>Sample data mode</strong> — charts and totals below use mock activity so you can refine the layout. Turn
        off sample data in Settings (⚙) to use your saved logs.
      </div>

      <div className="content history-content">
        <div className="history-controls no-print">
          <div className="history-control">
            <label htmlFor="hist-month-a">Month A</label>
            <input type="month" id="hist-month-a" autoComplete="off" />
          </div>
          <button type="button" className="history-swap-btn" id="hist-swap" title="Swap months">
            ⇄ Swap
          </button>
          <div className="history-control">
            <label htmlFor="hist-month-b">Month B</label>
            <input type="month" id="hist-month-b" autoComplete="off" />
          </div>
        </div>
        <div className="history-controls no-print" style={{ marginTop: 10 }}>
          <div className="history-control">
            <label htmlFor="hist-export-month">Export month</label>
            <input type="month" id="hist-export-month" autoComplete="off" />
          </div>
          <button type="button" className="history-swap-btn" id="hist-export-csv" title="Export month as CSV">
            Export CSV
          </button>
          <button type="button" className="history-swap-btn" id="hist-export-json" title="Export month as backup file">
            Export backup
          </button>
          <label className="history-swap-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            Import backup
            <input type="file" id="hist-import-json" accept=".json,application/json" style={{ display: 'none' }} />
          </label>
        </div>
        <p className="history-hint" id="history-export-hint" aria-live="polite"></p>
        <p className="history-hint" id="history-months-hint" aria-live="polite"></p>

        <div id="history-insights-root"></div>
        <div id="history-compare-root"></div>
      </div>

      <div className="footer">
        <strong>Data stays in this browser</strong> — same saved plan and check-ins as the Financial Plan page.
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

