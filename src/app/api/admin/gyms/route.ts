// PUT /api/admin/gyms — the local gym backoffice saves every gym at once by
// rewriting src/data/gyms.ts. Local only: a dev server on localhost, signed in
// as an owner. Anywhere else it's a 404 (and a deployment's file system is
// read-only anyway).
import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auth } from '@/auth';
import { localDevServer } from '@/lib/local-dev-login';
import { renderGymsFile, validateGyms } from '@/lib/gym-config';
import { GYM_MACHINES } from '@/data/gym-machines';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest) {
  if (!localDevServer(req.headers.get('host'))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user?.isOwner) {
    return NextResponse.json({ error: 'Owners only' }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
  }
  const result = validateGyms((body as { gyms?: unknown })?.gyms, new Set(GYM_MACHINES.map((m) => m.id)));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  await writeFile(path.join(process.cwd(), 'src/data/gyms.ts'), renderGymsFile(result.gyms), 'utf8');
  return NextResponse.json({ gyms: result.gyms });
}
