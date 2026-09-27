import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Pure OAuth 2.1 protocol logic for the MCP authorization server. Kept
// import-free (only node:crypto) so `node --test` can load it directly —
// `src/lib/__tests__/oauth-core.test.ts` imports it by relative `.ts` path.
// Everything that touches Mongo or Next lives in the models / oauth-http.

export const AUTH_CODE_TTL_SECONDS = 300;
export const ACCESS_TOKEN_TTL_SECONDS = 3600;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const MCP_SCOPE = 'mcp';

export type TokenKind = 'client' | 'secret' | 'code' | 'access' | 'refresh';

// Distinct prefixes make a leaked value identifiable at a glance and let
// /api/mcp tell an OAuth token from an `htm_` personal key without a lookup.
const TOKEN_PREFIX: Record<TokenKind, string> = {
  client: 'htc_',
  secret: 'hts_',
  code: 'hta_',
  access: 'hto_',
  refresh: 'htr_',
};

const TOKEN_BODY = /^[A-Za-z0-9_-]{20,128}$/;

export function generateToken(kind: TokenKind): string {
  return TOKEN_PREFIX[kind] + randomBytes(32).toString('base64url');
}

export function isTokenOfKind(value: string, kind: TokenKind): boolean {
  const prefix = TOKEN_PREFIX[kind];
  return value.startsWith(prefix) && TOKEN_BODY.test(value.slice(prefix.length));
}

// Codes, tokens and secrets are never shown again after issue, so only their
// hash is stored — unlike `htm_` keys, which are revealable by design.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const PKCE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

export function pkceChallengeFromVerifier(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!PKCE_VERIFIER.test(verifier)) return false;
  const expected = Buffer.from(pkceChallengeFromVerifier(verifier));
  const presented = Buffer.from(challenge);
  return expected.length === presented.length && timingSafeEqual(expected, presented);
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// https anywhere; plain http only for loopback (local tools / MCP Inspector).
// Fragments are forbidden by RFC 6749 §3.1.2.
export function isAllowedRedirectUri(value: string): boolean {
  if (value.includes('#')) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}

export type ClientAuthMethod = 'none' | 'client_secret_post' | 'client_secret_basic';
export const CLIENT_AUTH_METHODS: readonly ClientAuthMethod[] = [
  'none',
  'client_secret_post',
  'client_secret_basic',
];
export const GRANT_TYPES = ['authorization_code', 'refresh_token'] as const;
const RESPONSE_TYPES = ['code'] as const;

const MAX_REDIRECT_URIS = 10;
const MAX_CLIENT_NAME = 100;
const DEFAULT_CLIENT_NAME = 'MCP client';

export interface ClientRegistration {
  clientName: string;
  redirectUris: string[];
  tokenEndpointAuthMethod: ClientAuthMethod;
}

export type RegistrationResult =
  | { ok: true; registration: ClientRegistration }
  | {
      ok: false;
      error: 'invalid_redirect_uri' | 'invalid_client_metadata';
      description: string;
    };

function metadataError(description: string): RegistrationResult {
  return { ok: false, error: 'invalid_client_metadata', description };
}

function isSubsetOf(value: unknown, allowed: readonly string[]): boolean {
  return (
    Array.isArray(value) &&
    value.every((v) => typeof v === 'string' && allowed.includes(v))
  );
}

// RFC 7591 request → our stored shape. Registration is open (the MCP spec
// expects DCR), so this is the only gate: tight limits, known values only.
export function parseClientRegistration(body: unknown): RegistrationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return metadataError('Body must be a JSON object');
  }
  const b = body as Record<string, unknown>;

  const uris = b.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > MAX_REDIRECT_URIS) {
    return {
      ok: false,
      error: 'invalid_redirect_uri',
      description: `redirect_uris must list 1-${MAX_REDIRECT_URIS} URIs`,
    };
  }
  for (const uri of uris) {
    if (typeof uri !== 'string' || !isAllowedRedirectUri(uri)) {
      return {
        ok: false,
        error: 'invalid_redirect_uri',
        description: `Unsupported redirect URI: ${String(uri)}`,
      };
    }
  }

  if (b.client_name !== undefined && typeof b.client_name !== 'string') {
    return metadataError('client_name must be a string');
  }
  const clientName = (b.client_name as string | undefined)?.trim() || DEFAULT_CLIENT_NAME;
  if (clientName.length > MAX_CLIENT_NAME) {
    return metadataError(`client_name must be at most ${MAX_CLIENT_NAME} characters`);
  }

  const method = b.token_endpoint_auth_method ?? 'none';
  if (!CLIENT_AUTH_METHODS.includes(method as ClientAuthMethod)) {
    return metadataError(`Unsupported token_endpoint_auth_method: ${String(method)}`);
  }
  if (b.grant_types !== undefined && !isSubsetOf(b.grant_types, GRANT_TYPES)) {
    return metadataError('Unsupported grant_types');
  }
  if (b.response_types !== undefined && !isSubsetOf(b.response_types, RESPONSE_TYPES)) {
    return metadataError('Unsupported response_types');
  }

  return {
    ok: true,
    registration: {
      clientName,
      redirectUris: Array.from(new Set(uris as string[])),
      tokenEndpointAuthMethod: method as ClientAuthMethod,
    },
  };
}

// RFC 6749 §2.3.1: id and secret are form-urlencoded before base64.
export function parseBasicAuth(
  header: string | null
): { clientId: string; clientSecret: string } | null {
  if (!header) return null;
  const spaceIndex = header.indexOf(' ');
  if (spaceIndex === -1 || header.slice(0, spaceIndex).toLowerCase() !== 'basic') return null;
  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(spaceIndex + 1).trim(), 'base64').toString('utf8');
  } catch {
    return null;
  }
  const colon = decoded.indexOf(':');
  if (colon === -1) return null;
  try {
    return {
      clientId: decodeURIComponent(decoded.slice(0, colon)),
      clientSecret: decodeURIComponent(decoded.slice(colon + 1)),
    };
  } catch {
    return null;
  }
}
