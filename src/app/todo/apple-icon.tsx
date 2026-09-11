import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';
export const runtime = 'nodejs';

// "Things To Do" add-to-home-screen icon: a little notepad with the rainbow
// top stripe and three checked ruled lines, echoing the /todo theme.
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
          background: 'linear-gradient(180deg, #e8f4f1 0%, #cfe9e2 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 132,
            height: 146,
            background: '#fffdf7',
            borderRadius: 22,
            overflow: 'hidden',
            boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
          }}
        >
          <div
            style={{
              height: 18,
              display: 'flex',
              background:
                'linear-gradient(90deg,#7cc242,#b6d957,#f4d23c,#f2a13c,#ee6d5a,#e94f8a,#7fd0c4)',
            }}
          />
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 16,
              padding: '0 16px',
            }}
          >
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', fontSize: 26 }}>✔️</div>
                <div style={{ flex: 1, height: 6, background: '#c9d3d8', borderRadius: 3 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size, emoji: 'twemoji' },
  );
}
