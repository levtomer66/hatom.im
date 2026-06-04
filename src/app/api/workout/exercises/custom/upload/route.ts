import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { requireSignedIn } from '@/lib/auth-helpers';

// POST /api/workout/exercises/custom/upload
// Signed-in users upload a thumbnail for a custom exercise. multipart/form-data
// with a single `file`. The image is re-encoded server-side with sharp to a
// 400px square-ish JPEG (strips EXIF, bounds the stored size regardless of what
// the client sends) and pushed to Vercel Blob; we return the public URL, which
// the create call then stores in the `photo` field. Mirrors the trip-journey
// upload pattern.

// Reject obviously-oversized uploads before buffering (the client also resizes,
// so a legit upload is well under this).
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

// Defence in depth: only raster image types. sharp re-encodes to JPEG anyway,
// but this rejects e.g. SVG (script-bearing) before it ever reaches sharp.
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(req: NextRequest) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Image too large' }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
  }

  try {
    const inputBuf = Buffer.from(await file.arrayBuffer());
    const jpeg = await sharp(inputBuf)
      .rotate() // honour EXIF orientation before stripping metadata
      .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const blob = await put(`workout/custom/${randomUUID()}.jpg`, jpeg, {
      access: 'public',
      contentType: 'image/jpeg',
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error('POST /api/workout/exercises/custom/upload failed:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
