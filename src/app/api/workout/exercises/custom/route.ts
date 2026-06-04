import { NextRequest, NextResponse } from 'next/server';
import { ExerciseCategory } from '@/types/workout';
import { requireSignedIn } from '@/lib/auth-helpers';
import { listCustomExercises, createCustomExercise } from '@/lib/workout-custom-exercises';

// Mirror the categories the AddExerciseForm actually offers, so the API can't
// accept a category the UI can't produce (keeps the model enum in sync too).
const VALID_CATEGORIES: ExerciseCategory[] = [
  'push', 'pull', 'legs', 'calisthenics', 'full-body',
];

// Entry-point caps so a malformed/abusive client can't store a huge name or
// image blob in Mongo. Photo is currently never sent by the form, but the
// field is accepted, so bound it (~450 KB once base64-decoded).
const MAX_NAME_LEN = 200;
const MAX_PHOTO_LEN = 600_000;

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
    if (photo && photo.length > MAX_PHOTO_LEN) {
      return NextResponse.json({ error: 'Photo too large' }, { status: 400 });
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
