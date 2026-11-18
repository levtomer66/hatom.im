import type { Metadata } from 'next';
import { IBM_Plex_Sans_Hebrew } from 'next/font/google';
import './shopping.css';

// The page's one face: Hebrew and Latin in the same family, tabular figures
// for prices. next/font self-hosts it, so the CSP needs no font origin.
const plex = IBM_Plex_Sans_Hebrew({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--sh-font',
});

export const metadata: Metadata = {
  title: '🛒 כיף לי בסופר',
  description: 'רשימת קניות ואיפה הכי זול לקנות אותה',
  // The label under the home-screen icon (iOS otherwise uses the whole title, emoji and site suffix).
  appleWebApp: { title: 'כיף לי בסופר' },
};

export default function ShoppingLayout({ children }: { children: React.ReactNode }) {
  return <div className={plex.variable}>{children}</div>;
}
