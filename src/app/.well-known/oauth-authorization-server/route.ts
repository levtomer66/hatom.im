import { NextRequest } from 'next/server';
import { authorizationServerMetadata } from '@/lib/oauth-core';
import { corsPreflight, oauthJson, requestOrigin } from '@/lib/oauth-http';

// RFC 8414 authorization-server metadata.
export function GET(request: NextRequest) {
  return oauthJson(authorizationServerMetadata(requestOrigin(request)));
}

export function OPTIONS() {
  return corsPreflight();
}
