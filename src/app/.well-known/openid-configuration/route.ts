import { NextRequest } from 'next/server';
import { authorizationServerMetadata } from '@/lib/oauth-core';
import { corsPreflight, oauthJson, requestOrigin } from '@/lib/oauth-http';

// Alias for clients that only probe the OIDC discovery path. Same document as
// oauth-authorization-server; no id_tokens are issued.
export function GET(request: NextRequest) {
  return oauthJson(authorizationServerMetadata(requestOrigin(request)));
}

export function OPTIONS() {
  return corsPreflight();
}
