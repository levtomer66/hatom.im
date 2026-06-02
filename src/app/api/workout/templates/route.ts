import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutTemplateModel from '@/models/WorkoutTemplate';
import { DEFAULT_NUM_SETS } from '@/types/workout';
import { requireSignedIn } from '@/lib/auth-helpers';
import {
  getOwnTemplates,
  getSharedTemplates,
  sanitizeExercises,
  sanitizeDescription,
  sanitizeInstagramUrl,
  normalizeTemplate,
  type LegacyTemplate,
} from '@/lib/workout-templates';

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// GET /api/workout/templates              → caller's own templates
// GET /api/workout/templates?scope=shared → owner-shared templates, visible
//                                           to every signed-in workout user.
// userId is derived from the Auth.js session.
export async function GET(request: NextRequest) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;
  const scope = request.nextUrl.searchParams.get('scope');

  try {
    const templates = scope === 'shared'
      ? await getSharedTemplates()
      : await getOwnTemplates(userId);
    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST /api/workout/templates
// userId is derived from the session; any client-supplied userId is ignored.
export async function POST(request: NextRequest) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    await connectDB();

    const body = await request.json();
    const { name } = body as { name: string };
    // Prefer the new { exercises } shape; fall back to legacy { exerciseIds }
    // from stale clients so an edit from an older bundle doesn't wipe data.
    const exercises = Array.isArray(body.exercises)
      ? sanitizeExercises(body.exercises)
      : Array.isArray(body.exerciseIds)
        ? sanitizeExercises(
            (body.exerciseIds as unknown[]).map((id) => ({ exerciseId: id, numSets: DEFAULT_NUM_SETS, notes: '' })),
          )
        : [];

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    const template = new WorkoutTemplateModel({
      userId,
      name: name.trim(),
      exercises,
      description: sanitizeDescription(body.description),
      instagramUrl: sanitizeInstagramUrl(body.instagramUrl),
    });

    await template.save();

    const saved = template.toObject();
    return NextResponse.json(normalizeTemplate(saved as unknown as LegacyTemplate), { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
