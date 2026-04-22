import type { ReactNode } from 'react';

import './globals.css';

export const metadata = {
  title: 'PennyPath',
  description: 'Family financial planning tools.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <header className="mb-10 flex items-center justify-between">
            <div className="flex items-baseline gap-3">
              <span className="text-xl font-semibold tracking-tight">PennyPath</span>
              <span className="text-sm text-slate-500">Next.js migration (in progress)</span>
            </div>
            <nav className="flex items-center gap-4 text-sm">
              <a className="text-slate-700 hover:text-slate-900" href="/">
                Home
              </a>
              <a className="text-slate-700 hover:text-slate-900" href="/dashboard">
                Dashboard
              </a>
              <a className="text-slate-700 hover:text-slate-900" href="/history">
                History
              </a>
              <a className="text-slate-700 hover:text-slate-900" href="/real-estate">
                Real estate
              </a>
            </nav>
          </header>
          {children}
          <footer className="mt-16 border-t border-slate-200 pt-6 text-xs text-slate-500">
            Static app migration scaffold — existing vanilla pages still live at the repository root for now.
          </footer>
        </div>
      </body>
    </html>
  );
}

