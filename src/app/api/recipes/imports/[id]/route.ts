import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { dismissImport } from '@/models/RecipeImport';
import { bad, serverError } from '../../_shared';

type Ctx = { params: Promise<{ id: string }> };

// DELETE — the requester dismisses a finished import or cancels a queued one
// (one the agent is working on can't be pulled back).
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const caller = await requireFeatureCaller(request, 'recipes');
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  try {
    return (await dismissImport(caller.userEmail, id)) ? NextResponse.json({ ok: true }) : bad('לא נמצא', 404);
  } catch (error) {
    return serverError('dismissing an import', error);
  }
}
