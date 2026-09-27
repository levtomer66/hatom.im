import { NextRequest } from 'next/server';
import { protectedResourceMetadata } from '@/lib/oauth-core';
import { corsPreflight, oauthJson, requestOrigin } from '@/lib/oauth-http';

// Path-aware variant (…/oauth-protected-resource/api/mcp), which claude.ai
// probes first. There's one resource, so any suffix gets the same document.
export function GET(request: NextRequest) {
  return oauthJson(protectedResourceMetadata(requestOrigin(request)));
}

export function OPTIONS() {
  return corsPreflight();
}
