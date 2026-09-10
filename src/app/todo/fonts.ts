import { Caveat } from 'next/font/google';

// Handwriting face for the notepad. Latin-only — Hebrew task text falls back
// to the site font (Rubik) via the `todo.css` font stack.
export const caveat = Caveat({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-hand',
  display: 'swap',
});
