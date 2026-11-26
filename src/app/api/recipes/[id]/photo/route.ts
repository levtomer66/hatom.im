import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { requireFeatureCaller } from '@/lib/api-caller';
import { setPhoto } from '@/models/Recipe';
import { bad, dropBlob, notFound, serverError } from '../../_shared';

type Ctx = { params: Promise<{ id: string }> };

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// POST multipart { file } — the owner's new photo (already resized in the
// browser to ~300 KB) to Vercel Blob; the old blob is deleted. Only the URL
// is stored on the recipe.
export async function POST(request: NextRequest, { params }: Ctx) {
  const caller = await requireFeatureCaller(request, 'recipes');
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get('file');
    file = f instanceof File ? f : null;
  } catch {
    return bad('קובץ לא תקין');
  }
  if (!file || !TYPES.has(file.type)) return bad('צריך תמונה (JPEG, PNG או WebP)');
  if (file.size > MAX_BYTES) return bad('התמונה גדולה מדי');
  try {
    const blob = await put(`recipes/${id}-${Math.random().toString(36).slice(2, 10)}.jpg`, Buffer.from(await file.arrayBuffer()), {
      access: 'public', contentType: file.type,
    });
    const before = await setPhoto(caller.userEmail, id, blob.url);
    if (before === undefined) {
      await dropBlob(blob.url);
      return notFound();
    }
    await dropBlob(before);
    return NextResponse.json({ photo: blob.url });
  } catch (error) {
    return serverError('uploading a photo', error);
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const caller = await requireFeatureCaller(request, 'recipes');
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  try {
    const before = await setPhoto(caller.userEmail, id, null);
    if (before === undefined) return notFound();
    await dropBlob(before);
    return NextResponse.json({ photo: null });
  } catch (error) {
    return serverError('removing a photo', error);
  }
}
