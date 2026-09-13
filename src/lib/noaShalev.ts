import localFont from 'next/font/local';

// Noa Shalev — a free calligraphic Hebrew serif from AlefAlefAlef, self-hosted
// (CSP only allows fonts from 'self'). One regular weight. Used across the
// /mekafkefim coffee journal so the whole page shares one hand-lettered voice.
export const noaShalev = localFont({
  src: [
    { path: '../fonts/noa-shalev-regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/noa-shalev-regular.woff', weight: '400', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-noa',
  fallback: ['Playfair Display', 'Georgia', 'serif'],
});
