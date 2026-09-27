import { NextRequest, NextResponse } from 'next/server';
import {
  CORS_HEADERS,
  authenticateClient,
  corsPreflight,
  oauthError,
  readParams,
} from '@/lib/oauth-http';
import { revokeTokenForClient } from '@/models/OAuthGrant';

// RFC 7009. Always 200 for an authenticated client — even for an unknown
// token — so the endpoint can't be used to probe which tokens exist.
export async function POST(request: NextRequest) {
  try {
    const params = await readParams(request);
    const client = await authenticateClient(request, params);
    if (!client) {
      return oauthError(
        'invalid_client',
        'Client authentication failed',
        401,
        request.headers.get('authorization')
          ? { 'WWW-Authenticate': 'Basic realm="hatom.im"' }
          : undefined
      );
    }
    if (params.token) await revokeTokenForClient(params.token, client.clientId);
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
  } catch (error) {
    console.error('OAuth revoke failed:', error);
    return oauthError('server_error', 'Revocation failed', 500);
  }
}

export function OPTIONS() {
  return corsPreflight();
}
