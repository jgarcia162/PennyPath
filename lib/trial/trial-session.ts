const TRIAL_SESSION_KEY = 'pennypath:trial-session';
const TRIAL_ENDS_AT_KEY = 'pennypath:trial-ends-at';
const TRIAL_SEED_KEY = 'pennypath:trial-seed';
const DEMO_MODE_KEY = 'financial-plan.historyDemo';

export const DEFAULT_TRIAL_DURATION_MS = 15 * 60 * 1000;

// sessionStorage can be cleared unexpectedly in some environments (e.g. privacy modes or certain reload flows).
// Mirror the trial marker into localStorage so refreshes keep the same time box within the same browser.
const TRIAL_SESSION_KEY_LOCAL = 'pennypath:trial-session-local';
const TRIAL_ENDS_AT_KEY_LOCAL = 'pennypath:trial-ends-at-local';
const TRIAL_SEED_KEY_LOCAL = 'pennypath:trial-seed-local';

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
    window.localStorage.setItem(TRIAL_SESSION_KEY_LOCAL, '1');
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
  try {
    if (!window.localStorage.getItem(TRIAL_ENDS_AT_KEY_LOCAL)) {
      window.localStorage.setItem(TRIAL_ENDS_AT_KEY_LOCAL, String(Date.now() + DEFAULT_TRIAL_DURATION_MS));
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
    if (!window.localStorage.getItem(TRIAL_SEED_KEY_LOCAL)) {
      const seed = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
      window.localStorage.setItem(TRIAL_SEED_KEY_LOCAL, seed);
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
    if (window.sessionStorage.getItem(TRIAL_SESSION_KEY) === '1') return true;
  } catch {
    // ignore
  }

  // Fallback: rehydrate from localStorage mirror if still within the trial window.
  try {
    if (window.localStorage.getItem(TRIAL_SESSION_KEY_LOCAL) !== '1') return false;
    const endsAtRaw = window.localStorage.getItem(TRIAL_ENDS_AT_KEY_LOCAL);
    const endsAt = endsAtRaw ? Number(endsAtRaw) : NaN;
    if (!Number.isFinite(endsAt) || endsAt <= Date.now()) return false;

    // Rehydrate sessionStorage for the rest of the app (timer, demo seed, save-blocks).
    try {
      window.sessionStorage.setItem(TRIAL_SESSION_KEY, '1');
      window.sessionStorage.setItem(TRIAL_ENDS_AT_KEY, String(endsAt));
      const seed = window.localStorage.getItem(TRIAL_SEED_KEY_LOCAL);
      if (seed) window.sessionStorage.setItem(TRIAL_SEED_KEY, String(seed));
    } catch {
      // ignore
    }
    return true;
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
    // ignore
  }
  try {
    const raw = window.localStorage.getItem(TRIAL_ENDS_AT_KEY_LOCAL);
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
    // ignore
  }
  try {
    const raw = window.localStorage.getItem(TRIAL_SEED_KEY_LOCAL);
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
    window.localStorage.removeItem(TRIAL_SESSION_KEY_LOCAL);
    window.localStorage.removeItem(TRIAL_ENDS_AT_KEY_LOCAL);
    window.localStorage.removeItem(TRIAL_SEED_KEY_LOCAL);
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

