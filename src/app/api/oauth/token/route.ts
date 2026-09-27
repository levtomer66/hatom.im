import { NextRequest } from 'next/server';
import { MCP_SCOPE, verifyPkce } from '@/lib/oauth-core';
import {
  authenticateClient,
  corsPreflight,
  oauthError,
  oauthJson,
  readParams,
} from '@/lib/oauth-http';
import { consumeAuthorizationCode } from '@/models/OAuthCode';
import { issueGrant, rotateGrant, type TokenPair } from '@/models/OAuthGrant';

function tokenResponse(pair: TokenPair) {
  return oauthJson({
    access_token: pair.accessToken,
    token_type: 'Bearer',
    expires_in: pair.expiresIn,
    refresh_token: pair.refreshToken,
    scope: MCP_SCOPE,
  });
}

// RFC 6749 token endpoint: authorization_code (+ PKCE) and refresh_token.
export async function POST(request: NextRequest) {
  try {
    const params = await readParams(request);
    const client = await authenticateClient(request, params);
    if (!client) return oauthError('invalid_client', 'Client authentication failed', 401);

    if (params.grant_type === 'authorization_code') {
      if (!params.code || !params.code_verifier) {
        return oauthError('invalid_request', 'code and code_verifier are required');
      }
      const grant = await consumeAuthorizationCode(params.code);
      if (
        !grant ||
        grant.clientId !== client.clientId ||
        (params.redirect_uri !== undefined && params.redirect_uri !== grant.redirectUri) ||
        !verifyPkce(params.code_verifier, grant.codeChallenge)
      ) {
        return oauthError('invalid_grant', 'Authorization code is invalid, expired or already used');
      }
      return tokenResponse(
        await issueGrant({
          userEmail: grant.userEmail,
          userName: grant.userName,
          clientId: client.clientId,
          clientName: client.clientName,
          redirectHost: new URL(grant.redirectUri).host,
        })
      );
    }

    if (params.grant_type === 'refresh_token') {
      if (!params.refresh_token) return oauthError('invalid_request', 'refresh_token is required');
      const pair = await rotateGrant(params.refresh_token, client.clientId);
      if (!pair) return oauthError('invalid_grant', 'Refresh token is invalid, expired or revoked');
      return tokenResponse(pair);
    }

    return oauthError('unsupported_grant_type', `Unsupported grant_type: ${params.grant_type ?? ''}`);
  } catch (error) {
    console.error('OAuth token endpoint failed:', error);
    return oauthError('server_error', 'Token request failed', 500);
  }
}

export function OPTIONS() {
  return corsPreflight();
}
