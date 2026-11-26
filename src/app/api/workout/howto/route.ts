import { NextRequest, NextResponse } from 'next/server';
import { requireSignedIn } from '@/lib/auth-helpers';
import { resolveExerciseId } from '@/data/exercise-library';
import { EXERCISEDB_ID } from '@/data/exercise-howto';
import { MERGED_AWAY } from '@/data/exercise-movements';

// PROTOTYPE: GET /api/workout/howto?id=<library exercise id>
// → { gifUrl, steps[] } from ExerciseDB's free V1 API, fetched live (its links
// rotate weekly and its terms don't allow storing them), or { gifUrl: null }
// when there's no match or the API is down — the client then falls back to
// our own start/end photos.
const EXERCISEDB_BASE = 'https://oss.exercisedb.dev/api/v1/exercises';

export async function GET(request: NextRequest) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;

  const resolved = resolveExerciseId(request.nextUrl.searchParams.get('id') ?? '');
  const id = MERGED_AWAY[resolved] ?? resolved;
  const edbId = EXERCISEDB_ID[id];
  if (!edbId) return NextResponse.json({ gifUrl: null, steps: [] });

  try {
    const res = await fetch(`${EXERCISEDB_BASE}/${encodeURIComponent(edbId)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`ExerciseDB ${res.status}`);
    const body = (await res.json()) as { data?: { gifUrl?: string; instructions?: string[] } };
    const gifUrl = body.data?.gifUrl ?? null;
    // Only ever hand the client an https link on ExerciseDB's own media host.
    const safe = gifUrl && /^https:\/\/[a-z0-9.-]*exercisedb\.dev\//.test(gifUrl) ? gifUrl : null;
    const steps = (body.data?.instructions ?? []).map((s) => s.replace(/^Step:\s*\d+\s*/i, '')).slice(0, 6);
    return NextResponse.json({ gifUrl: safe, steps });
  } catch (error) {
    console.error('howto: ExerciseDB lookup failed', error);
    return NextResponse.json({ gifUrl: null, steps: [] });
  }
}
