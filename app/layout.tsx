import type { ReactNode } from 'react';

import { fontDmSans } from './fonts';
import './globals.css';

export const metadata = {
  title: 'PennyPath',
  description: 'Family financial planning tools.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fontDmSans.className} min-h-screen antialiased`}>{children}</body>
    </html>
  );
}

