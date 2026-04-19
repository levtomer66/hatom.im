import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutTemplateModel from '@/models/WorkoutTemplate';
import { TemplateExercise, DEFAULT_NUM_SETS, MIN_SETS, MAX_SETS } from '@/types/workout';
import { resolveExerciseId } from '@/data/exercise-library';

// Connect to MongoDB using mongoose
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;

  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

type LegacyTemplate = {
  _id: mongoose.Types.ObjectId | string;
  exerciseIds?: string[];
  exercises?: TemplateExercise[];
  [key: string]: unknown;
};

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
    // Mirror into the legacy field for stale clients; safe to remove once none remain.
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

// GET /api/workout/templates/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    const template = await WorkoutTemplateModel.findById(id).lean();

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(normalizeTemplate(template as unknown as LegacyTemplate));
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

// PUT /api/workout/templates/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await request.json();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    const template = await WorkoutTemplateModel.findById(id);

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    if (body.name !== undefined) {
      template.name = body.name;
    }
    // Accept either the new { exercises: [...] } shape or a legacy { exerciseIds: string[] }
    // from stale clients. Preferring the new one when both are present.
    if (Array.isArray(body.exercises)) {
      template.exercises = sanitizeExercises(body.exercises);
    } else if (Array.isArray(body.exerciseIds)) {
      template.exercises = sanitizeExercises(
        (body.exerciseIds as unknown[]).map(id => ({ exerciseId: id, numSets: DEFAULT_NUM_SETS, notes: '' }))
      );
    }

    // Opportunistically drop the legacy field once we rewrite this doc.
    template.set('exerciseIds', undefined, { strict: false });

    await template.save();

    const saved = template.toObject();
    return NextResponse.json(normalizeTemplate(saved as unknown as LegacyTemplate));
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE /api/workout/templates/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    const result = await WorkoutTemplateModel.findByIdAndDelete(id);

    if (!result) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
