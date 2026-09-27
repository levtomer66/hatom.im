import { NextRequest } from 'next/server';
import { GRANT_TYPES, parseClientRegistration } from '@/lib/oauth-core';
import { corsPreflight, oauthError, oauthJson } from '@/lib/oauth-http';
import { registerOAuthClient } from '@/models/OAuthClient';

// RFC 7591 dynamic client registration — open, as the MCP auth spec expects.
// Registering grants nothing: every connection still needs a signed-in user
// to click Allow on /oauth/authorize.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return oauthError('invalid_client_metadata', 'Body must be JSON');
  }
  const parsed = parseClientRegistration(body);
  if (!parsed.ok) return oauthError(parsed.error, parsed.description);

  try {
    const { client, clientSecret } = await registerOAuthClient(parsed.registration);
    return oauthJson(
      {
        client_id: client.clientId,
        ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
        client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        token_endpoint_auth_method: client.tokenEndpointAuthMethod,
        grant_types: [...GRANT_TYPES],
        response_types: ['code'],
      },
      201
    );
  } catch (error) {
    console.error('OAuth client registration failed:', error);
    return oauthError('server_error', 'Registration failed', 500);
  }
}

export function OPTIONS() {
  return corsPreflight();
}
