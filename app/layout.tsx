import type { ReactNode } from 'react';

import { TrialCloseBeacon } from './components/TrialCloseBeacon';
import { fontCormorant, fontDmSans, fontJetBrains, fontOutfit } from './fonts';
import './globals.css';

export const metadata = {
  title: 'PennyPath',
  description: 'Family financial planning tools.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. GA opt-out) and client-only scripts
    // (theme/palette on documentElement) can differ from SSR; see https://react.dev/link/hydration-mismatch
    // data-scroll-behavior: matches `scroll-behavior: smooth` in CSS (Next.js route transition guidance).
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className={`${fontOutfit.className} ${fontOutfit.variable} ${fontCormorant.variable} ${fontJetBrains.variable} ${fontDmSans.variable} min-h-screen antialiased`}
      >
        <TrialCloseBeacon />
        {children}
      </body>
    </html>
  );
}

