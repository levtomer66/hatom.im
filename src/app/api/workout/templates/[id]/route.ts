import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutTemplateModel from '@/models/WorkoutTemplate';
import { DEFAULT_NUM_SETS } from '@/types/workout';
import { requireSignedIn } from '@/lib/auth-helpers';
import { isOwnerEmail } from '@/types/auth';
import {
  normalizeTemplate,
  sanitizeExercises,
  sanitizeDescription,
  sanitizeInstagramUrl,
  type LegacyTemplate,
} from '@/lib/workout-templates';

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// GET /api/workout/templates/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const template = await WorkoutTemplateModel.findById(id).lean();
    if (!template || (template as { userId?: string }).userId !== userId) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(normalizeTemplate(template as unknown as LegacyTemplate));
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}

// PUT /api/workout/templates/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const template = await WorkoutTemplateModel.findById(id);
    if (!template || template.userId !== userId) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (body.name !== undefined) {
      template.name = body.name;
    }
    // New { exercises } shape preferred; legacy { exerciseIds } accepted.
    if (Array.isArray(body.exercises)) {
      template.exercises = sanitizeExercises(body.exercises);
    } else if (Array.isArray(body.exerciseIds)) {
      template.exercises = sanitizeExercises(
        (body.exerciseIds as unknown[]).map((id) => ({ exerciseId: id, numSets: DEFAULT_NUM_SETS, notes: '' })),
      );
    }

    // sharedByOwner is owner-only; a non-owner PUT silently drops it.
    if (body.sharedByOwner !== undefined && isOwnerEmail(userId)) {
      template.set('sharedByOwner', !!body.sharedByOwner, { strict: false });
    }

    // Optional protocol text + example link (any owner of the template).
    // undefined = field absent → leave unchanged.
    const description = sanitizeDescription(body.description);
    if (description !== undefined) template.description = description;
    const instagramUrl = sanitizeInstagramUrl(body.instagramUrl);
    if (instagramUrl !== undefined) template.instagramUrl = instagramUrl;

    // Opportunistically drop the legacy field once we rewrite this doc.
    template.set('exerciseIds', undefined, { strict: false });

    await template.save();

    const saved = template.toObject();
    return NextResponse.json(normalizeTemplate(saved as unknown as LegacyTemplate));
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

// DELETE /api/workout/templates/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const template = await WorkoutTemplateModel.findById(id);
    if (!template || template.userId !== userId) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await WorkoutTemplateModel.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
