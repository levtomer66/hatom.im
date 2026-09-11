import { Caveat, Amatic_SC } from 'next/font/google';

// Latin handwriting face for the "Things To Do" title and Latin task text.
// adjustFontFallback is disabled so next/font doesn't inject a metric-adjusted
// system fallback that itself carries Hebrew glyphs — that would intercept
// Hebrew before it can fall through to the Hebrew handwriting face below.
export const caveat = Caveat({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-hand',
  display: 'swap',
  adjustFontFallback: false,
});

// Hebrew handwriting face (Amatic SC ships a `hebrew` subset and is the only
// hand-drawn Hebrew face in next/font's registry). Caveat has no Hebrew glyphs,
// so Hebrew characters fall through to this via the `--font-hand-he` slot in
// the todo.css stack.
export const hebrewHand = Amatic_SC({
  subsets: ['hebrew'],
  weight: ['400', '700'],
  variable: '--font-hand-he',
  display: 'swap',
});
