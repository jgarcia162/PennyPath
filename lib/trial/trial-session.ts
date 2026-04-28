const TRIAL_SESSION_KEY = 'pennypath:trial-session';
const TRIAL_ENDS_AT_KEY = 'pennypath:trial-ends-at';
const TRIAL_SEED_KEY = 'pennypath:trial-seed';
const DEMO_MODE_KEY = 'financial-plan.historyDemo';

export const DEFAULT_TRIAL_DURATION_MS = 15 * 60 * 1000;

function notifyTrialChange() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('pennypath:trialchange'));
  } catch {
    // ignore
  }
}

export function enableTrialSession() {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(TRIAL_SESSION_KEY, '1');
  } catch {
    // ignore
  }

  try {
    if (!window.sessionStorage.getItem(TRIAL_ENDS_AT_KEY)) {
      window.sessionStorage.setItem(TRIAL_ENDS_AT_KEY, String(Date.now() + DEFAULT_TRIAL_DURATION_MS));
    }
  } catch {
    // ignore
  }

  // One seed per trial session (changes each time "Take a peek" starts).
  try {
    if (!window.sessionStorage.getItem(TRIAL_SEED_KEY)) {
      const seed = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
      window.sessionStorage.setItem(TRIAL_SEED_KEY, seed);
    }
  } catch {
    // ignore
  }

  try {
    window.localStorage.setItem(DEMO_MODE_KEY, '1');
  } catch {
    // ignore
  }

  notifyTrialChange();
}

export function maybeEnableTrialSessionFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('trial') !== '1') return;
    enableTrialSession();

    // Clear the URL so refresh/back doesn't re-trigger.
    url.searchParams.delete('trial');
    window.history.replaceState({}, '', url.toString());
  } catch {
    // ignore
  }
}

export function isTrialSessionActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(TRIAL_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function getTrialEndsAtMs(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(TRIAL_ENDS_AT_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function getTrialSeed(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(TRIAL_SEED_KEY);
    return raw ? String(raw) : null;
  } catch {
    return null;
  }
}

export function clearTrialSession() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(TRIAL_SESSION_KEY);
    window.sessionStorage.removeItem(TRIAL_ENDS_AT_KEY);
    window.sessionStorage.removeItem(TRIAL_SEED_KEY);
  } catch {
    // ignore
  }
  try {
    window.localStorage.removeItem(DEMO_MODE_KEY);
  } catch {
    // ignore
  }

  notifyTrialChange();
}

/**
 * If demo mode is on but there is no trial session marker, the user likely closed the tab/browser.
 * Clear demo mode so the test experience resets on the next visit.
 */
export function clearDemoModeIfTrialEnded() {
  if (typeof window === 'undefined') return;
  if (isTrialSessionActive()) return;

  try {
    if (window.localStorage.getItem(DEMO_MODE_KEY) === '1') {
      window.localStorage.removeItem(DEMO_MODE_KEY);
    }
  } catch {
    // ignore
  }
}

