import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutTemplateModel from '@/models/WorkoutTemplate';
import { UserId, TemplateExercise, DEFAULT_NUM_SETS, MIN_SETS, MAX_SETS, USER_IDS, isValidUserId } from '@/types/workout';
import { resolveExerciseId } from '@/data/exercise-library';

// Connect to MongoDB using mongoose
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;

  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// Legacy shape: some templates in Mongo still store { exerciseIds: string[] } from before
// per-exercise defaults existed. Normalize either shape into the new { exercises: TemplateExercise[] }.
type LegacyTemplate = {
  _id: mongoose.Types.ObjectId | string;
  exerciseIds?: string[];
  exercises?: TemplateExercise[];
  [key: string]: unknown;
};

// Resolve legacy exercise IDs to their canonical form, then drop any duplicates
// that collapse together (e.g. `lat-pulldown` + `wide-grip-lat-pulldown`).
// Keeps the first occurrence's numSets + notes.
function dedupeByExerciseId(entries: TemplateExercise[]): TemplateExercise[] {
  const seen = new Set<string>();
  const out: TemplateExercise[] = [];
  for (const e of entries) {
    const canonical = resolveExerciseId(e.exerciseId);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push({ ...e, exerciseId: canonical });
  }
  return out;
}

function normalizeTemplate(t: LegacyTemplate) {
  const rawExercises: TemplateExercise[] = Array.isArray(t.exercises) && t.exercises.length > 0
    ? t.exercises.map(e => ({
        exerciseId: e.exerciseId,
        numSets: typeof e.numSets === 'number' ? e.numSets : DEFAULT_NUM_SETS,
        notes: typeof e.notes === 'string' ? e.notes : '',
      }))
    : Array.isArray(t.exerciseIds)
      ? t.exerciseIds.map(id => ({ exerciseId: id, numSets: DEFAULT_NUM_SETS, notes: '' }))
      : [];

  const exercises = dedupeByExerciseId(rawExercises);

  const { exerciseIds: _legacy, _id, ...rest } = t;
  void _legacy;
  return {
    ...rest,
    id: _id.toString(),
    exercises,
    // Mirror the canonical exercise IDs back into the legacy field so that
    // stale frontend bundles (still reading template.exerciseIds) keep working
    // until they refresh. Safe to remove once no clients read this.
    exerciseIds: exercises.map(e => e.exerciseId),
  };
}

function sanitizeExercises(raw: unknown): TemplateExercise[] {
  if (!Array.isArray(raw)) return [];
  const parsed = raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, unknown>;
      const exerciseId = typeof e.exerciseId === 'string' ? e.exerciseId.trim() : '';
      if (!exerciseId) return null;
      const rawNum = typeof e.numSets === 'number' ? e.numSets : Number(e.numSets);
      const numSets = Number.isFinite(rawNum)
        ? Math.min(MAX_SETS, Math.max(MIN_SETS, Math.round(rawNum)))
        : DEFAULT_NUM_SETS;
      const notes = typeof e.notes === 'string' ? e.notes : '';
      return { exerciseId, numSets, notes } as TemplateExercise;
    })
    .filter((e): e is TemplateExercise => e !== null);
  return dedupeByExerciseId(parsed);
}

// GET /api/workout/templates?userId=tom
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') as UserId | null;

    if (!isValidUserId(userId)) {
      return NextResponse.json(
        { error: `Valid userId is required (${USER_IDS.join(', ')})` },
        { status: 400 }
      );
    }

    const templates = await WorkoutTemplateModel.find({ userId })
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json(templates.map(t => normalizeTemplate(t as unknown as LegacyTemplate)));
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST /api/workout/templates
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { userId, name } = body as { userId: UserId; name: string };
    // Prefer the new { exercises } shape; fall back to legacy { exerciseIds: string[] }
    // from stale clients so an edit from an older bundle doesn't wipe the template.
    const exercises = Array.isArray(body.exercises)
      ? sanitizeExercises(body.exercises)
      : Array.isArray(body.exerciseIds)
        ? sanitizeExercises(
            (body.exerciseIds as unknown[]).map(id => ({ exerciseId: id, numSets: DEFAULT_NUM_SETS, notes: '' }))
          )
        : [];

    if (!isValidUserId(userId)) {
      return NextResponse.json(
        { error: `Valid userId is required (${USER_IDS.join(', ')})` },
        { status: 400 }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    const template = new WorkoutTemplateModel({
      userId,
      name: name.trim(),
      exercises,
    });

    await template.save();

    const saved = template.toObject();
    return NextResponse.json(normalizeTemplate(saved as unknown as LegacyTemplate), { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
