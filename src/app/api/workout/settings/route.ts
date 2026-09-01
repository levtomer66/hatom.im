import { NextRequest, NextResponse } from 'next/server';
import { requireSignedIn } from '@/lib/auth-helpers';
import {
  getUserSettings,
  setBodyweight,
  setExerciseLoadPref,
} from '@/models/WorkoutUserSettings';
import { DEFAULT_BAR_WEIGHT_KG } from '@/lib/workout-load';
import { ExerciseLoadPref, LoadEntry } from '@/types/workout';

const VALID_ENTRIES: readonly LoadEntry[] = ['total', 'per-side', 'per-dumbbell'];
// Exercise ids are kebab library ids or `custom-<hex>` — never contain a dot or
// `$`, so this both validates and keeps the dotted Mongo field path safe.
const EXERCISE_ID_RE = /^[a-zA-Z0-9_-]+$/;

// GET /api/workout/settings → the caller's WorkoutUserSettings (bodyweight +
// per-exercise gear overrides), defaulting to today's behaviour when unset.
export async function GET() {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  try {
    const settings = await getUserSettings(gate.session.user.email);
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching workout settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PATCH /api/workout/settings
//   { bodyweightKg: number | null }                        → set global bodyweight
//   { exerciseId, pref: ExerciseLoadPref | null }          → set/clear a gear override
// Returns the updated settings.
export async function PATCH(request: NextRequest) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    const body = await request.json();

    if (body && 'bodyweightKg' in body) {
      const bw = body.bodyweightKg;
      if (bw !== null && (typeof bw !== 'number' || !Number.isFinite(bw) || bw <= 0 || bw > 500)) {
        return NextResponse.json({ error: 'Invalid bodyweightKg' }, { status: 400 });
      }
      const settings = await setBodyweight(userId, bw);
      return NextResponse.json(settings);
    }

    if (body && 'exerciseId' in body) {
      const exerciseId = body.exerciseId;
      if (typeof exerciseId !== 'string' || !EXERCISE_ID_RE.test(exerciseId)) {
        return NextResponse.json({ error: 'Invalid exerciseId' }, { status: 400 });
      }
      const pref = body.pref;

      if (pref === null) {
        const settings = await setExerciseLoadPref(userId, exerciseId, null);
        return NextResponse.json(settings);
      }
      if (!pref || typeof pref !== 'object' || !VALID_ENTRIES.includes(pref.entry)) {
        return NextResponse.json({ error: 'Invalid pref' }, { status: 400 });
      }

      const clean: ExerciseLoadPref = { entry: pref.entry };
      if (pref.entry === 'per-side') {
        const bar = pref.barWeightKg;
        clean.barWeightKg =
          typeof bar === 'number' && Number.isFinite(bar) && bar >= 0 && bar <= 100
            ? bar
            : DEFAULT_BAR_WEIGHT_KG;
      }
      const settings = await setExerciseLoadPref(userId, exerciseId, clean);
      return NextResponse.json(settings);
    }

    return NextResponse.json({ error: 'No recognized field to update' }, { status: 400 });
  } catch (error) {
    console.error('Error updating workout settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
