import { ImageResponse } from 'next/og';

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
          background: 'linear-gradient(180deg, #f3e9dd 0%, #e7d3bd 100%)',
          fontSize: 130,
        }}
      >
        ☕
      </div>
    ),
    { ...size, emoji: 'twemoji' }
  );
}
