import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { del, put } from '@vercel/blob';
import sharp from 'sharp';
import { deleteScan, setScan } from '@/models/Pregnancy';
import { bad, requirePregnancyCaller, serverError, pOut } from '../_shared';

// A scan per pregnancy week, in Vercel Blob (only its URL in the doc), the
// trip-journey pattern: resized here to 1600 px, JPEG 0.82, metadata stripped.

// The page shrinks photos first; a Vercel function body tops out near 4.5 MB anyway.
const MAX_BYTES = 4 * 1024 * 1024;
const weekOf = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 4 && n <= 42 ? n : null;
};

// POST multipart { week, file } → { p }
export async function POST(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (!gate.p) return bad('אין הריון פעיל', 404);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad('קובץ לא תקין');
  }
  const week = weekOf(form.get('week'));
  const file = form.get('file');
  if (week === null) return bad('שבוע לא תקין');
  if (!(file instanceof Blob) || !file.size) return bad('צריך תמונה');
  if (file.size > MAX_BYTES) return bad('התמונה גדולה מדי (עד 4MB)');
  try {
    const jpeg = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    const blob = await put(`pregnancy/${gate.p.id}/${week}-${randomUUID()}.jpg`, jpeg, { access: 'public', contentType: 'image/jpeg' });
    const r = await setScan(gate.p.id, week, { url: blob.url, at: new Date().toISOString(), by: gate.caller.userEmail })
      .catch(async (e) => { await del(blob.url).catch(() => undefined); throw e; });
    if (!r) {
      await del(blob.url).catch(() => undefined);
      return bad('אין הריון פעיל', 404);
    }
    if (r.replaced) await del(r.replaced).catch((e) => console.error('pregnancy: deleting a replaced scan:', e));
    return NextResponse.json({ p: pOut(r.p, gate.caller.userEmail) }, { status: 201 });
  } catch (error) {
    return serverError('uploading a scan', error);
  }
}

// DELETE ?week= → { p }
export async function DELETE(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (!gate.p) return bad('אין הריון פעיל', 404);
  const week = weekOf(request.nextUrl.searchParams.get('week'));
  if (week === null) return bad('שבוע לא תקין');
  try {
    const r = await deleteScan(gate.p.id, week);
    if (!r) return bad('אין הריון פעיל', 404);
    if (r.url) await del(r.url).catch((e) => console.error('pregnancy: deleting a scan:', e));
    return NextResponse.json({ p: pOut(r.p, gate.caller.userEmail) });
  } catch (error) {
    return serverError('deleting a scan', error);
  }
}
