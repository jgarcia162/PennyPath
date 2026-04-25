const TRIAL_SESSION_KEY = 'pennypath:trial-session';
const DEMO_MODE_KEY = 'financial-plan.historyDemo';

export function enableTrialSession() {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(TRIAL_SESSION_KEY, '1');
  } catch {
    // ignore
  }

  try {
    window.localStorage.setItem(DEMO_MODE_KEY, '1');
  } catch {
    // ignore
  }
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

