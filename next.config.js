/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
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
              "connect-src 'self' https://www.youtube.com https://*.googleapis.com https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org",
              "media-src 'self' https://www.youtube.com https://*.googlevideo.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;