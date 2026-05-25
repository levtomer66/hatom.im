import { NextResponse } from 'next/server';
import { SexPosition } from '@/types/valentine';
import { requirePagePermission } from '@/lib/auth-helpers';
import { VALENTINE_POSES } from '@/data/valentine-poses';

// GET /api/valentine/poses - list pose ids from the static manifest.
// The id (and filename) is the original screenshot name; it doubles as
// the key inside ValentineProgress.experiencedPositionIds in Mongo, so
// the catalogue moving to Blob must not change these identifiers.
export async function GET() {
  const gate = await requirePagePermission('valentine');
  if (gate instanceof NextResponse) return gate;
  const positions: SexPosition[] = VALENTINE_POSES.map((p) => ({
    id: p.filename,
    filename: p.filename,
  })).sort((a, b) => a.filename.localeCompare(b.filename));
  return NextResponse.json(positions);
}
