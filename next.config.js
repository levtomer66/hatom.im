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
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://unpkg.com https://www.google.com https://maps.google.com",
              "frame-src https://www.youtube.com https://youtube.com https://www.google.com https://maps.google.com",
              "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://www.youtube.com https://*.googleapis.com https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://ntfy.sh",
              "media-src 'self' https://www.youtube.com https://*.googlevideo.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;