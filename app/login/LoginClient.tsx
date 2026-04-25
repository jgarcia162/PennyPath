'use client';

import { useState } from 'react';

import { fontPlayfair } from '../fonts';
import {
  createSupabaseBrowserClient,
  getSaveLoginPreference,
  setSaveLoginPreference,
} from '../../lib/supabase/browser';
import { enableTrialSession } from '../../lib/trial/trial-session';

export default function LoginClient() {
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const takeAPeek = searchParams.get('takeAPeek') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saveLogin, setSaveLogin] = useState(() => getSaveLoginPreference());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onStartTrial() {
    setError(null);
    setLoading(true);
    try {
      // Trial should never persist across browser restarts.
      setSaveLoginPreference(false);
      enableTrialSession();

      const supabase = createSupabaseBrowserClient({ saveLogin: false });
      const { error: authError } = await supabase.auth.signInAnonymously();
      if (authError) {
        setError(authError.message);
        return;
      }

      window.location.href = '/dashboard';
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      setSaveLoginPreference(saveLogin);
      const supabase = createSupabaseBrowserClient({ saveLogin });
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(authError.message);
        return;
      }
      window.location.href = '/dashboard';
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <header className="auth-page__header">
        <a className={`auth-page__brand ${fontPlayfair.className}`} href="/">
          PennyPath
        </a>
        <nav className="auth-page__header-nav" aria-label="Site">
          <a className="auth-page__header-link" href="/">
            Home
          </a>
        </nav>
      </header>

      <main className="auth-page__main">
        <div className="auth-page__inner">
          <p className="auth-page__eyebrow">Account</p>
          <h1 className={`auth-page__title ${fontPlayfair.className}`}>Log in</h1>
          <p className="auth-page__lede">
            {takeAPeek
              ? 'Start a time-boxed trial with sample data, or use your email and password to access your planner.'
              : 'Use your email and password to access your planner.'}
          </p>

          <div className="auth-page__card">
            {takeAPeek ? (
              <div style={{ marginBottom: 16 }}>
                <button type="button" className="auth-page__submit" onClick={onStartTrial} disabled={loading}>
                  {loading ? 'Starting trial…' : 'Take a peek (sample account)'}
                </button>
                <p className="auth-page__hint" style={{ marginTop: 10 }}>
                  This is a temporary session with demo data. Your changes reset when you leave.
                </p>
                <hr style={{ margin: '18px 0', border: 'none', borderTop: '1px solid rgba(60, 68, 82, 0.12)' }} />
              </div>
            ) : null}

            <form onSubmit={onSubmit}>
              <div className="auth-page__field">
                <label className="auth-page__label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  className="auth-page__input"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="auth-page__field">
                <label className="auth-page__label" htmlFor="password">
                  Password
                </label>
                <div className="auth-page__input-wrap">
                  <input
                    id="password"
                    className="auth-page__input auth-page__input--has-reveal"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="auth-page__password-reveal"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="auth-page__toggle">
                <label className="auth-page__toggle-label">
                  <input type="checkbox" checked={saveLogin} onChange={(e) => setSaveLogin(e.target.checked)} />
                  <span>
                    Save login
                    <span className="auth-page__toggle-hint">
                      Keep me signed in on this device (uncheck on shared computers).
                    </span>
                  </span>
                </label>
              </div>

              {error ? <p className="auth-page__error">{error}</p> : null}

              <button type="submit" disabled={loading} className="auth-page__submit">
                {loading ? 'Logging in…' : 'Log in'}
              </button>

              <p className="auth-page__footer">
                Don’t have an account? <a href="/signup">Sign up</a>
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

