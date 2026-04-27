'use client';

export type AppLoadingOverlayProps = {
  message?: string;
  /** Defaults to `message`; use for a longer screen-reader phrase if needed */
  ariaLabel?: string;
};

/**
 * Full-viewport loading state using the same spinner and typography as the
 * AI Payoff Plan generator (`.ai-payoff-loading`). Not for in-panel AI flows
 * (bill calendar prompt, payoff output) — those keep their own indicators.
 */
export function AppLoadingOverlay({ message = 'Loading…', ariaLabel }: AppLoadingOverlayProps) {
  return (
    <div
      className="app-loading-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={ariaLabel ?? message}
    >
      <div className="ai-payoff-loading app-loading-overlay__panel">
        <span className="ai-payoff-loading__spinner" aria-hidden="true" />
        <p className="ai-payoff-loading__label">{message}</p>
      </div>
    </div>
  );
}
