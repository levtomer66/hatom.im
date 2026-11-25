import type { Metadata } from 'next';
import { Frank_Ruhl_Libre, IBM_Plex_Sans_Hebrew } from 'next/font/google';
import '../shopping/shopping.css';
import '../calories/calories.css';
import './recipes.css';

// Built on /shopping's and calories' components, in recipes' own warm look: .rc-app
// remaps their tokens (recipes.css; spec 2026-11-25-recipes-warm-ux-design.md § Look).
const plex = IBM_Plex_Sans_Hebrew({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--sh-font',
});

const serif = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['500', '700'],
  display: 'swap',
  variable: '--rc-serif',
});

export const metadata: Metadata = {
  title: '🍳 מתכונים',
  description: 'ספר המתכונים שלנו',
  appleWebApp: { title: "מתכונים" },
};

export default function RecipesLayout({ children }: { children: React.ReactNode }) {
  return <div className={`rc-app ${plex.variable} ${serif.variable}`}>{children}</div>;
}
