'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  createSupabaseBrowserClient,
  getSaveLoginPreference,
  setSaveLoginPreference,
} from '../../lib/supabase/browser';
import { AppLoadingOverlay } from '../components/AppLoadingOverlay';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saveLogin, setSaveLogin] = useState(() => getSaveLoginPreference());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      setSaveLoginPreference(saveLogin);
      const supabase = createSupabaseBrowserClient({ saveLogin });
      const { error: authError } = await supabase.auth.signUp({
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
      {loading ? <AppLoadingOverlay message="Creating account…" ariaLabel="Creating account" /> : null}
      <div className="auth-page__panel">
        <div className="auth-panel__inner">
          <div className="auth-panel__logo logo">
            <div className="logo__mark" aria-hidden="true">
              🌿
            </div>
            <span className="logo__text">PennyPath</span>
          </div>
          <h2 className="auth-panel__headline">
            Start your
            <br />
            path to
            <br />
            <em>financial freedom.</em>
          </h2>
          <p className="auth-panel__sub">Create an account to sync your planner across devices and keep your progress safe.</p>
          <div className="auth-panel__features">
            <div className="auth-panel__feature">
              <div className="auth-panel__feature-icon">🔄</div>
              <span>Sync across all devices</span>
            </div>
            <div className="auth-panel__feature">
              <div className="auth-panel__feature-icon">🏅</div>
              <span>Earn milestone badges</span>
            </div>
            <div className="auth-panel__feature">
              <div className="auth-panel__feature-icon">🌱</div>
              <span>Free forever, no credit card</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <Link href="/" className="auth-form-wrap__back">
            ← Back to home
          </Link>
          <h1 className="auth-form__title">Create account</h1>
          <p className="auth-form__sub">Start tracking your debt payoff and savings goals today.</p>

          <form onSubmit={onSubmit}>
            <div className="auth-form__field">
              <label className="auth-form__label" htmlFor="signup-email">
                Email
              </label>
              <input
                id="signup-email"
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
              <label className="auth-form__label" htmlFor="signup-password">
                Password
              </label>
              <div className="auth-form-password">
                <input
                  id="signup-password"
                  className="auth-form__input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
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
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                Use a strong password you don&apos;t use elsewhere.
              </div>
            </div>

            <label className="auth-form__toggle auth-form__toggle-wrap" htmlFor="signup-save">
              <input
                id="signup-save"
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
              <p className="auth-form__error" role="alert" aria-live="assertive">
                {error}
              </p>
            ) : null}

            <button type="submit" className="auth-form__submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create account →'}
            </button>
          </form>

          <div className="auth-form__footer">
            Already have an account? <Link href="/login">Log in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
