import { NextRequest, NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { VALENTINE_POSES_BY_FILENAME } from '@/data/valentine-poses';

// GET /api/valentine/poses/image?name=<filename>&size=thumb|full
// Permission-gated proxy: looks the pose up in the static manifest and
// streams the bytes from Vercel Blob. The Blob URL is never disclosed to
// the client so the 'valentine' gate stays meaningful. `size=thumb`
// returns the 400 px grid thumbnail; the default is the 900 px modal
// image.
export async function GET(request: NextRequest) {
  const gate = await requirePagePermission('valentine');
  if (gate instanceof NextResponse) return gate;
  const name = request.nextUrl.searchParams.get('name');
  if (!name) {
    return new NextResponse('Bad request', { status: 400 });
  }
  const entry = VALENTINE_POSES_BY_FILENAME[name];
  if (!entry) {
    return new NextResponse('Not found', { status: 404 });
  }
  const url = request.nextUrl.searchParams.get('size') === 'thumb' ? entry.thumbUrl : entry.url;
  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    return new NextResponse('Bad gateway', { status: 502 });
  }
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'image/webp',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
