'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { fontPlayfair } from '../fonts';
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
      router.push('/dashboard');
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      {loading ? <AppLoadingOverlay message="Creating account…" ariaLabel="Creating account" /> : null}
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
          <h1 className={`auth-page__title ${fontPlayfair.className}`}>Sign up</h1>
          <p className="auth-page__lede">Create an account to use your planner across devices.</p>

          <div className="auth-page__card">
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
                    autoComplete="new-password"
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
                <p className="auth-page__hint">Minimum length is enforced by your Supabase Auth settings.</p>
              </div>

              <div className="auth-page__toggle">
                <label className="auth-page__toggle-label">
                  <input
                    type="checkbox"
                    checked={saveLogin}
                    onChange={(e) => setSaveLogin(e.target.checked)}
                  />
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
                {loading ? 'Creating account…' : 'Create account'}
              </button>

              <p className="auth-page__footer">
                Already have an account? <a href="/login">Log in</a>
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
