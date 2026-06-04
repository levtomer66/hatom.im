import { NextRequest, NextResponse } from 'next/server';
import { ExerciseCategory } from '@/types/workout';
import { requireSignedIn } from '@/lib/auth-helpers';
import {
  listCustomExercises,
  createCustomExercise,
  setCustomExerciseRetired,
} from '@/lib/workout-custom-exercises';

// Mirror the categories the AddExerciseForm actually offers, so the API can't
// accept a category the UI can't produce (keeps the model enum in sync too).
const VALID_CATEGORIES: ExerciseCategory[] = [
  'push', 'pull', 'legs', 'calisthenics', 'full-body',
];

// Entry-point cap so a malformed/abusive client can't store a huge name.
const MAX_NAME_LEN = 200;

// Photos are uploaded via /custom/upload and we store the returned Vercel Blob
// URL — never raw user-supplied URLs (which would let a user point an <img> at
// an arbitrary host). Validate the shape before persisting.
const BLOB_URL_RE = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[^\s"'<>]+$/i;

// GET /api/workout/exercises/custom
// All custom exercises for the signed-in user. userId is derived from the
// session — any client-supplied userId is ignored.
export async function GET() {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    const exercises = await listCustomExercises(userId);
    return NextResponse.json(exercises);
  } catch (error) {
    console.error('Error fetching custom exercises:', error);
    return NextResponse.json(
      { error: 'Failed to fetch custom exercises' },
      { status: 500 },
    );
  }
}

// POST /api/workout/exercises/custom
// Create a new custom exercise owned by the signed-in user.
export async function POST(request: NextRequest) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const rawCategories: unknown = body?.categories;
    const photo = typeof body?.photo === 'string' ? body.photo : null;

    // Keep only known category ids — guards the Mongo enum and stops junk
    // from a malformed client from being persisted. Dedupe so the same
    // category can't be sent twice.
    const categories = [...new Set(
      (Array.isArray(rawCategories) ? rawCategories : [])
        .filter((c): c is ExerciseCategory => VALID_CATEGORIES.includes(c as ExerciseCategory)),
    )];

    if (!name || categories.length === 0) {
      return NextResponse.json(
        { error: 'Name and at least one valid category are required' },
        { status: 400 },
      );
    }

    if (name.length > MAX_NAME_LEN) {
      return NextResponse.json({ error: 'Name too long' }, { status: 400 });
    }
    if (photo && (!BLOB_URL_RE.test(photo) || photo.includes('..'))) {
      return NextResponse.json({ error: 'Invalid photo URL' }, { status: 400 });
    }

    const exercise = await createCustomExercise(userId, { name, categories, photo });
    return NextResponse.json(exercise, { status: 201 });
  } catch (error) {
    console.error('Error creating custom exercise:', error);
    return NextResponse.json(
      { error: 'Failed to create custom exercise' },
      { status: 500 },
    );
  }
}

// PATCH /api/workout/exercises/custom?id=<exerciseId>
// Soft-delete (retire) or restore one of the caller's own custom exercises.
// Body: { retired: boolean }. Scoped to the session user — a user can't touch
// another user's customs.
export async function PATCH(request: NextRequest) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    const exerciseId = new URL(request.url).searchParams.get('id');
    if (!exerciseId) {
      return NextResponse.json({ error: 'Missing exercise id' }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    if (typeof body?.retired !== 'boolean') {
      return NextResponse.json({ error: 'retired (boolean) is required' }, { status: 400 });
    }

    const matched = await setCustomExerciseRetired(userId, exerciseId, body.retired);
    if (!matched) {
      // 404 (not 403) so we don't reveal whether another user's id exists.
      return NextResponse.json({ error: 'Custom exercise not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, retired: body.retired });
  } catch (error) {
    console.error('Error updating custom exercise:', error);
    return NextResponse.json(
      { error: 'Failed to update custom exercise' },
      { status: 500 },
    );
  }
}
