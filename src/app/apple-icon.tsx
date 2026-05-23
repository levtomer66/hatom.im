import { ImageResponse } from 'next/og';

// iOS "Add to Home Screen" uses this PNG (apple-touch-icon). SVG icons
// aren't honored by Safari for the home-screen badge, so we generate a
// raster image per route via Next's ImageResponse + Twemoji. Same emoji
// the matching `icon.svg` in this folder uses, so favicon and
// home-screen icon stay in lockstep.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';
export const runtime = 'nodejs';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #faf1de 0%, #efe0c4 100%)',
          fontSize: 130,
        }}
      >
        💍
      </div>
    ),
    { ...size, emoji: 'twemoji' }
  );
}
