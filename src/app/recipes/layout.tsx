import type { Metadata } from 'next';
import { IBM_Plex_Sans_Hebrew } from 'next/font/google';
import '../shopping/shopping.css';
import '../calories/calories.css';
import './recipes.css';

// Wears /shopping's look (its tokens, sheets, chips, steppers) plus calories classes and a few rc- classes.
const plex = IBM_Plex_Sans_Hebrew({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--sh-font',
});

export const metadata: Metadata = {
  title: '🍳 מתכונים',
  description: 'ספר המתכונים שלנו',
  appleWebApp: { title: "מתכונים" },
};

export default function RecipesLayout({ children }: { children: React.ReactNode }) {
  return <div className={plex.variable}>{children}</div>;
}
