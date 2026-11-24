// Server-side glue the /api/recipes routes share.

import { NextRequest, NextResponse } from 'next/server';

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

export { dropBlob } from '@/lib/recipes/server';
