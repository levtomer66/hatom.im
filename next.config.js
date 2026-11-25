// One policy; only frame-ancestors differs between the site and /oauth.
const csp = (frameAncestors) => [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://unpkg.com https://www.google.com https://maps.google.com",
  "frame-src https://www.youtube.com https://youtube.com https://www.google.com https://maps.google.com https://open.spotify.com https://w.soundcloud.com",
  "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://www.youtube.com https://*.googleapis.com https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://ntfy.sh",
  "media-src 'self' https://www.youtube.com https://*.googlevideo.com",
  // No page uses <base>; stops an injected one re-pointing relative script URLs.
  "base-uri 'self'",
  // Clickjacking. Browsers ignore X-Frame-Options once this is set.
  `frame-ancestors ${frameAncestors}`,
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Coffee-review photos can come from any social-media / blog URL the
    // user pastes — Instagram CDN, Google Maps, restaurant blogs, etc.
    // Wildcard pattern keeps Next's image optimizer in the loop (resize
    // + AVIF/WebP) without us having to allowlist every new host.
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Same-origin framing only: no page is embedded on another site.
          { key: 'Content-Security-Policy', value: csp("'self'") },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        // The OAuth consent page is never framed, not even by us, so its
        // Allow button can't be clickjacked. Same key, later rule: this CSP
        // replaces the site's one here. X-Frame-Options for old browsers.
        source: '/oauth/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp("'none'") },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;