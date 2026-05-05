'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  createSupabaseBrowserClient,
  getSaveLoginPreference,
  setSaveLoginPreference,
} from '../../lib/supabase/browser';
import { clearTrialSession, enableTrialSession } from '../../lib/trial/trial-session';
import { AppLoadingOverlay } from '../components/AppLoadingOverlay';

type LoginClientProps = {
  sessionEndReason?: string | null;
};

export default function LoginClient({ sessionEndReason }: LoginClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saveLogin, setSaveLogin] = useState(() => getSaveLoginPreference());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Signing in…');

  async function onStartTrial() {
    setError(null);
    setBusyLabel('Starting trial…');
    setLoading(true);
    try {
      setSaveLoginPreference(false);
      enableTrialSession();

      const supabase = createSupabaseBrowserClient({ saveLogin: false });
      const { error: authError } = await supabase.auth.signInAnonymously();
      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      router.replace('/dashboard');
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setBusyLabel('Signing in…');
    setLoading(true);
    try {
      clearTrialSession();
      setSaveLoginPreference(saveLogin);
      const supabase = createSupabaseBrowserClient({ saveLogin });
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      {loading ? <AppLoadingOverlay message={busyLabel} ariaLabel={busyLabel} /> : null}
      <div className="auth-page__panel">
        <div className="auth-panel__inner">
          <div className="auth-panel__logo logo">
            <div className="logo__mark" aria-hidden="true">
              🌿
            </div>
            <span className="logo__text">PennyPath</span>
          </div>
          <h2 className="auth-panel__headline">
            Welcome
            <br />
            back to your
            <br />
            <em>financial path.</em>
          </h2>
          <p className="auth-panel__sub">
            Your plan is waiting. Log in to check progress, log a payment, or see how far you&apos;ve come.
          </p>
          <div className="auth-panel__features">
            <div className="auth-panel__feature">
              <div className="auth-panel__feature-icon">📊</div>
              <span>Track debt payoff progress</span>
            </div>
            <div className="auth-panel__feature">
              <div className="auth-panel__feature-icon">🎯</div>
              <span>Monitor savings milestones</span>
            </div>
            <div className="auth-panel__feature">
              <div className="auth-panel__feature-icon">📅</div>
              <span>Review monthly history</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <Link href="/" className="auth-form-wrap__back">
            ← Back to home
          </Link>
          <h1 className="auth-form__title">Log in</h1>
          <p className="auth-form__sub">
            Start a time-boxed trial with sample data, or use your email and password to access your planner.
          </p>

          {sessionEndReason === 'inactivity' ? (
            <p className="auth-form__notice" role="status">
              You were signed out after a period of inactivity.
            </p>
          ) : null}

          <form onSubmit={onSubmit}>
            <div className="auth-form__field">
              <label className="auth-form__label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                className="auth-form__input"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="auth-form__field">
              <label className="auth-form__label" htmlFor="login-password">
                Password
              </label>
              <div className="auth-form-password">
                <input
                  id="login-password"
                  className="auth-form__input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="auth-form-password__reveal"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <label className="auth-form__toggle auth-form__toggle-wrap" htmlFor="login-save">
              <input
                id="login-save"
                type="checkbox"
                checked={saveLogin}
                onChange={(e) => setSaveLogin(e.target.checked)}
              />
              <div>
                <div className="auth-form__toggle-text">
                  Keep me signed in
                  <span className="auth-form__toggle-hint">Uncheck on shared or public computers.</span>
                </div>
              </div>
            </label>

            {error ? (
              <p className="auth-form__error" role="status" aria-live="polite" aria-atomic="true">
                {error}
              </p>
            ) : null}

            <button type="submit" className="auth-form__submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Log in →'}
            </button>
          </form>

          <div className="auth-form__divider">or</div>

          <button type="button" className="auth-form__peek" onClick={onStartTrial} disabled={loading}>
            👀 Take a peek (sample account)
          </button>
          <p className="auth-form__peek-note">Temporary session with demo data. Resets when you leave.</p>

          <div className="auth-form__footer">
            Don&apos;t have an account? <Link href="/signup">Sign up</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
