import { ImageResponse } from 'next/og';
import { getCoffeeFavoriteById } from '@/models/CoffeeFavorite';
import { COFFEE_CAPSULES } from '@/types/coffee-order';

export const runtime = 'nodejs';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// Per-favorite "Add to Home Screen" icon: the favorite's capsule photo on a
// warm ground, so each favorite installs with its own picture. iOS caches this
// at install time. Unauthenticated — iOS fetches the icon with no cookie, and
// it reveals only which capsule a favorite id uses. Falls back to a coffee
// glyph when the favorite is missing or the capsule image can't be fetched.
export default async function AppleIcon({
  params,
}: {
  params: Promise<{ favoriteId: string }>;
}) {
  const { favoriteId } = await params;

  let capsuleImg: string | null = null;
  // Bound the third-party CDN fetch so a hang can't block the icon route
  // (mirrors src/lib/reverseGeocode.ts). Any failure falls back to the glyph.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const fav = await getCoffeeFavoriteById(favoriteId);
    const cap = fav && COFFEE_CAPSULES.find((c) => c.id === fav.capsule);
    if (cap?.img) {
      const res = await fetch(cap.img, {
        headers: { 'User-Agent': 'hatom.im coffee (https://www.hatom.im)' },
        signal: controller.signal,
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const type = res.headers.get('content-type') || 'image/jpeg';
        capsuleImg = `data:${type};base64,${buf.toString('base64')}`;
      }
    }
  } catch (err) {
    console.warn('quick apple-icon capsule fetch failed', String(err));
  } finally {
    clearTimeout(timer);
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg,#f6efe6 0%,#e7d8c3 100%)',
        }}
      >
        {capsuleImg ? (
          <img src={capsuleImg} alt="" width={152} height={152} style={{ objectFit: 'contain' }} />
        ) : (
          <div style={{ display: 'flex', fontSize: 96 }}>☕</div>
        )}
      </div>
    ),
    { ...size, emoji: 'twemoji' }
  );
}
