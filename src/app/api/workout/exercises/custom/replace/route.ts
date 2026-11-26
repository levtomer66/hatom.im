import { NextRequest, NextResponse } from 'next/server';
import { requireSignedIn } from '@/lib/auth-helpers';
import { countCustomUsage, replaceCustomExercise } from '@/lib/workout-custom-replace';
import { isCustomExerciseId } from '@/lib/workout-replace-exercise';

// GET  /api/workout/exercises/custom/replace?id=<customId>
//      → { workouts, templates }: how much of the caller's history uses it.
// POST /api/workout/exercises/custom/replace  { id, targetId }
//      Replaces the caller's custom exercise with a built-in one everywhere in
//      their history (workouts, templates, gear setting, PBs) and retires it.
// Both are scoped to the session user; another user's id is a 404.

const notFound = () => NextResponse.json({ error: 'Custom exercise not found' }, { status: 404 });

export async function GET(request: NextRequest) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!isCustomExerciseId(id)) return notFound();
  try {
    const counts = await countCustomUsage(gate.session.user.email, id);
    if (counts === 'custom-not-found') return notFound();
    return NextResponse.json(counts);
  } catch (error) {
    console.error('Error counting custom exercise usage:', error);
    return NextResponse.json({ error: 'Failed to count usage' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === 'string' ? body.id : '';
  const targetId = typeof body?.targetId === 'string' ? body.targetId : '';
  if (!isCustomExerciseId(id)) return notFound();
  if (!targetId) return NextResponse.json({ error: 'targetId is required' }, { status: 400 });
  try {
    const result = await replaceCustomExercise(gate.session.user.email, id, targetId);
    if (result === 'custom-not-found') return notFound();
    if (result === 'target-not-built-in') {
      return NextResponse.json({ error: 'Pick a built-in exercise' }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error replacing custom exercise:', error);
    return NextResponse.json({ error: 'Failed to replace exercise' }, { status: 500 });
  }
}
