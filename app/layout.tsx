import type { ReactNode } from 'react';

import { fontCormorant, fontJetBrains, fontOutfit } from './fonts';
import './globals.css';

export const metadata = {
  title: 'PennyPath',
  description: 'Family financial planning tools.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${fontOutfit.className} ${fontOutfit.variable} ${fontCormorant.variable} ${fontJetBrains.variable} min-h-screen antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

