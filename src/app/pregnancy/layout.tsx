import type { Metadata } from 'next';
import { IBM_Plex_Sans_Hebrew } from 'next/font/google';
import '../shopping/shopping.css';
import '../calories/calories.css';
import './pregnancy.css';

// Wears /shopping's look and /calories' pieces, plus a few pg- classes.
const plex = IBM_Plex_Sans_Hebrew({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--sh-font',
});

export const metadata: Metadata = {
  title: '🤰 הריון',
  description: 'שבוע, תורים וקפאין',
  appleWebApp: { title: 'הריון' },
};

export default function PregnancyLayout({ children }: { children: React.ReactNode }) {
  return <div className={plex.variable}>{children}</div>;
}
