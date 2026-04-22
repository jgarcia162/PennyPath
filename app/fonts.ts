import { DM_Sans, Playfair_Display } from 'next/font/google';

export const fontDmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const fontPlayfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '700'],
});
