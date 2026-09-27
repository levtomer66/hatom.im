import { NextRequest, NextResponse } from 'next/server';
import { originFromHeaders, parseBasicAuth } from '@/lib/oauth-core';
import {
  getOAuthClient,
  verifyOAuthClientSecret,
  type OAuthClient,
} from '@/models/OAuthClient';

// Shared plumbing for the OAuth route handlers. CORS is open (`*`) because
// these endpoints use no cookies — it only matters for in-browser tools such
// as MCP Inspector; ChatGPT / claude.ai / Copilot call server-to-server.
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version',
};

export function requestOrigin(request: NextRequest): string {
  return originFromHeaders((name) => request.headers.get(name), request.nextUrl.origin);
}

export function oauthJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' },
  });
}

export function oauthError(error: string, description: string, status = 400): NextResponse {
  return oauthJson({ error, error_description: description }, status);
}

export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Token/revoke bodies are form-encoded per RFC 6749; JSON is accepted too
// because some clients send it anyway.
export async function readParams(request: NextRequest): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as Record<string, unknown>;
      for (const [key, value] of Object.entries(body ?? {})) {
        if (typeof value === 'string') out[key] = value;
      }
    } else {
      for (const [key, value] of new URLSearchParams(await request.text())) out[key] = value;
    }
  } catch {
    // Malformed body → empty params → the handler reports invalid_request.
  }
  return out;
}

// Public clients (`none`) identify by client_id alone — PKCE is their proof.
// Confidential clients must prove the secret, by Basic OR post regardless of
// which they registered (clients are inconsistent; both prove possession).
export async function authenticateClient(
  request: NextRequest,
  params: Record<string, string>
): Promise<OAuthClient | null> {
  const basic = parseBasicAuth(request.headers.get('authorization'));
  const clientId = basic?.clientId ?? params.client_id;
  if (!clientId) return null;
  const client = await getOAuthClient(clientId);
  if (!client) return null;
  if (client.tokenEndpointAuthMethod === 'none') return client;
  const secret = basic?.clientSecret ?? params.client_secret;
  if (!secret) return null;
  return (await verifyOAuthClientSecret(clientId, secret)) ? client : null;
}
