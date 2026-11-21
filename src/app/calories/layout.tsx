import type { Metadata } from 'next';
import { IBM_Plex_Sans_Hebrew } from 'next/font/google';
import '../shopping/shopping.css';
import './calories.css';

// Wears /shopping's look (its tokens, sheets, chips, steppers) plus a few cal- classes.
const plex = IBM_Plex_Sans_Hebrew({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--sh-font',
});

export const metadata: Metadata = {
  title: '🍎 קלוריות',
  description: 'מה אכלתי היום ומה נשאר',
  appleWebApp: { title: 'קלוריות' },
};

export default function CaloriesLayout({ children }: { children: React.ReactNode }) {
  return <div className={plex.variable}>{children}</div>;
}
