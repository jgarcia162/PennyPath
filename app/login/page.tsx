'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { fontPlayfair } from '../fonts';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(authError.message);
        return;
      }
      router.push('/dashboard');
      router.refresh();
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
          <p className="auth-page__lede">Use your email and password to access your planner.</p>

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
                <input
                  id="password"
                  className="auth-page__input"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
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
