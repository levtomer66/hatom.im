// Server-side glue the /api/recipes routes share.

import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';

export async function readJson(request: NextRequest): Promise<unknown | NextResponse> {
  try {
    return await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
export const notFound = () => bad('המתכון לא נמצא', 404);

export function serverError(what: string, error: unknown) {
  console.error(`recipes: ${what}:`, error);
  return NextResponse.json({ error: 'משהו השתבש, נסו שוב' }, { status: 500 });
}

/** Deletes a recipe photo's blob; a failure only leaves an orphan, never breaks the request. */
export async function dropBlob(url: string | null | undefined): Promise<void> {
  if (!url || !url.includes('.blob.vercel-storage.com/')) return;
  try {
    await del(url);
  } catch (error) {
    console.error('recipes: deleting a photo blob:', error);
  }
}
