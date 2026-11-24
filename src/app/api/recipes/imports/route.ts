import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { MAX_OPEN, parseImportRequest } from '@/lib/recipes/imports';
import { createImport, listMyImports } from '@/models/RecipeImport';
import { bad, readJson, serverError } from '../_shared';

// GET — the caller's open import requests and those finished in the last day.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'recipes');
  if (caller instanceof NextResponse) return caller;
  try {
    return NextResponse.json({ imports: await listMyImports(caller.userEmail) });
  } catch (error) {
    return serverError('listing imports', error);
  }
}

// POST { url?, text?, note? } — asks the import agent to import a recipe into
// the caller's book. The ntfy message is only the request id (the topic is on
// public ntfy.sh); the agent reads the rest through MCP. Without the topic the
// request still waits for the agent's next poll.
export async function POST(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'recipes');
  if (caller instanceof NextResponse) return caller;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const parsed = parseImportRequest(body);
  if (!parsed.ok) return bad(parsed.error);
  try {
    const req = await createImport(caller.userEmail, parsed.value);
    if (!req) return bad(`אפשר עד ${MAX_OPEN} ייבואים פתוחים בבת אחת`, 429);
    const topic = process.env.RECIPES_IMPORT_TOPIC;
    if (topic) {
      await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, { method: 'POST', body: req.id, signal: AbortSignal.timeout(5000) })
        .catch((error) => console.error('recipes: ntfy wake-up failed:', error));
    }
    return NextResponse.json({ import: req }, { status: 201 });
  } catch (error) {
    return serverError('creating an import', error);
  }
}
