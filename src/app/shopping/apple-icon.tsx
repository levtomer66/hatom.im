import { ImageResponse } from 'next/og';

// iOS "Add to Home Screen" for /shopping uses this PNG (apple-touch-icon;
// Safari ignores SVG here). A white cart on the page's accent blue, like the
// "כיף לי בסופר" logo; `icon.svg` in this folder draws the same for the tab.
// iOS rounds the corners itself, so the square is filled edge to edge.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';
export const runtime = 'nodejs';

/** Font Awesome's shopping-cart glyph (the one the page uses), viewBox 0 0 576 512. */
const CART_PATH = 'M528.12 301.319l47.273-208C578.806 78.301 567.391 64 551.99 64H159.208l-9.166-44.81C147.758 8.021 137.93 0 126.529 0H24C10.745 0 0 10.745 0 24v16c0 13.255 10.745 24 24 24h69.883l70.248 343.435C147.325 417.1 136 435.222 136 456c0 30.928 25.072 56 56 56s56-25.072 56-56c0-15.674-6.447-29.835-16.824-40h209.647C430.447 426.165 424 440.326 424 456c0 30.928 25.072 56 56 56s56-25.072 56-56c0-22.172-12.888-41.332-31.579-50.405l5.517-24.276c3.413-15.018-8.002-29.319-23.403-29.319H218.117l-6.545-32h293.145c11.206 0 20.92-7.754 23.403-18.681z';

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
          background: 'linear-gradient(160deg, #3d6dff 0%, #1a4be0 55%, #0f2f9e 100%)',
        }}
      >
        <svg width="112" height="100" viewBox="0 0 576 512" style={{ marginLeft: -6, marginTop: 4 }}>
          <path d={CART_PATH} fill="#ffffff" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
