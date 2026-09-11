import { Caveat } from 'next/font/google';
import localFont from 'next/font/local';

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

// Hebrew handwriting face: "Dana Yad" (Dana Nof & Avraham Cornfeld). It isn't
// on Google Fonts, so it's self-hosted via next/font/local — served from the
// app origin (no CSP change needed). Caveat has no Hebrew glyphs, so Hebrew
// characters fall through to this via the `--font-hand-he` slot in todo.css.
export const hebrewHand = localFont({
  src: './DanaYad.woff',
  variable: '--font-hand-he',
  display: 'swap',
});
