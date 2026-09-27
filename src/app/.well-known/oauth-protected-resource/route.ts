import { NextRequest } from 'next/server';
import { protectedResourceMetadata } from '@/lib/oauth-core';
import { corsPreflight, oauthJson, requestOrigin } from '@/lib/oauth-http';

// RFC 9728 protected-resource metadata for /api/mcp. Its 401 points here.
export function GET(request: NextRequest) {
  return oauthJson(protectedResourceMetadata(requestOrigin(request)));
}

export function OPTIONS() {
  return corsPreflight();
}
