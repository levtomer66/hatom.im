import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { listFeed } from '@/models/Recipe';
import { serverError } from '../_shared';

// GET — recipes anyone shared to the feed, newest first.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'recipes');
  if (caller instanceof NextResponse) return caller;
  try {
    return NextResponse.json({ recipes: await listFeed() });
  } catch (error) {
    return serverError('listing the feed', error);
  }
}
