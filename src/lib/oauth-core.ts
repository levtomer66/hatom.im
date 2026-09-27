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

// DCR is open registration with no auth — these caps bound how much one
// anonymous POST can make us store (registration doc + logs) on the shared
// 512 MB Atlas M0. Enforced in oauth-core so both the field-level check
// below and the route's raw-body check (register/route.ts) share one source
// of truth for the redirect-URI limit.
export const MAX_REGISTRATION_BODY_BYTES = 16 * 1024;
export const MAX_REDIRECT_URI_LENGTH = 2000;

// Strips bidi-override/mark characters (LRM/RLM, LRE/RLE/PDF/LRO/RLO,
// LRI/RLI/FSI/PDI) and all C0/C1 control characters so a registered
// client_name can't reorder or hide its own text when rendered on the
// consent page or in the connected-apps list.
const BIDI_AND_CONTROL_CHARS = /[\p{Cc}‎‏‪-‮⁦-⁩]/gu;

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
    if (typeof uri !== 'string' || uri.length > MAX_REDIRECT_URI_LENGTH) {
      return {
        ok: false,
        error: 'invalid_redirect_uri',
        description: `Redirect URI must be a string of at most ${MAX_REDIRECT_URI_LENGTH} characters`,
      };
    }
    if (!isAllowedRedirectUri(uri)) {
      return {
        ok: false,
        error: 'invalid_redirect_uri',
        description: `Unsupported redirect URI: ${uri}`,
      };
    }
  }

  if (b.client_name !== undefined && typeof b.client_name !== 'string') {
    return metadataError('client_name must be a string');
  }
  const sanitizedClientName = (b.client_name as string | undefined)?.replace(
    BIDI_AND_CONTROL_CHARS,
    ''
  );
  const clientName = sanitizedClientName?.trim() || DEFAULT_CLIENT_NAME;
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

// ── Authorization request ────────────────────────────────────────────────

// The query parameters the consent page round-trips through its form, so the
// server action can re-validate exactly what the page validated.
export const AUTHORIZE_PARAM_NAMES = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
  'state',
  'resource',
  'scope',
] as const;

export interface AuthorizeClient {
  clientId: string;
  redirectUris: string[];
}

export interface AuthorizeRequest {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
  resource: string | null;
  scope: string | null;
}

export type AuthorizeValidation =
  | { kind: 'render-error'; message: string }
  | {
      kind: 'redirect-error';
      redirectUri: string;
      error: string;
      description: string;
      state: string | null;
    }
  | { kind: 'ok'; request: AuthorizeRequest };

const PKCE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

// RFC 6749 §4.1.2.1: until client_id and redirect_uri are trusted we must NOT
// redirect (that would be an open redirector) — render instead. After that,
// errors go back to the client with `error` + `state`.
export function validateAuthorizeParams(
  params: Record<string, string | undefined>,
  client: AuthorizeClient | null,
  mcpResource: string
): AuthorizeValidation {
  if (!client || params.client_id !== client.clientId) {
    return { kind: 'render-error', message: 'This app is not registered with hatom.im.' };
  }
  const redirectUri =
    params.redirect_uri ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : undefined);
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return { kind: 'render-error', message: 'The redirect address does not match this app.' };
  }

  const state = params.state ?? null;
  const fail = (error: string, description: string): AuthorizeValidation => ({
    kind: 'redirect-error',
    redirectUri,
    error,
    description,
    state,
  });

  if (params.response_type !== 'code') {
    return fail('unsupported_response_type', 'Only response_type=code is supported');
  }
  if (!params.code_challenge || !PKCE_CHALLENGE.test(params.code_challenge)) {
    return fail('invalid_request', 'A valid PKCE code_challenge is required');
  }
  if (params.code_challenge_method !== 'S256') {
    return fail('invalid_request', 'code_challenge_method must be S256');
  }
  let resource: string | null = null;
  if (params.resource) {
    resource = stripTrailingSlash(params.resource);
    if (resource !== stripTrailingSlash(mcpResource)) {
      return fail('invalid_target', `Unknown resource: ${params.resource}`);
    }
  }

  return {
    kind: 'ok',
    request: {
      clientId: client.clientId,
      redirectUri,
      codeChallenge: params.code_challenge,
      state,
      resource,
      scope: params.scope ?? null,
    },
  };
}

export function buildRedirectUrl(
  redirectUri: string,
  params: Record<string, string | null>
): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null) url.searchParams.set(key, value);
  }
  return url.toString();
}

// ── Discovery ─────────────────────────────────────────────────────────────

export function mcpResourceUrl(origin: string): string {
  return `${origin}/api/mcp`;
}

export function resourceMetadataUrl(origin: string): string {
  return `${origin}/.well-known/oauth-protected-resource`;
}

// RFC 9728 — what /api/mcp's 401 points clients at.
export function protectedResourceMetadata(origin: string) {
  return {
    resource: mcpResourceUrl(origin),
    authorization_servers: [origin],
    bearer_methods_supported: ['header'],
    scopes_supported: [MCP_SCOPE],
  };
}

// RFC 8414. Also served at /.well-known/openid-configuration for clients that
// only probe the OIDC path (we issue no id_tokens).
export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    revocation_endpoint: `${origin}/api/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: [...GRANT_TYPES],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: [...CLIENT_AUTH_METHODS],
    revocation_endpoint_auth_methods_supported: [...CLIENT_AUTH_METHODS],
    scopes_supported: [MCP_SCOPE],
    // RFC 9207 — lets clients bind an authorization response to the request
    // that started it, using the `iss` param we already emit on redirects.
    authorization_response_iss_parameter_supported: true,
  };
}

function firstHeaderValue(value: string | null): string | null {
  const first = value?.split(',')[0]?.trim();
  return first || null;
}

// Each deployment (prod, previews, localhost) advertises its own issuer —
// clients reject an issuer that differs from the URL they fetched.
export function originFromHeaders(
  get: (name: string) => string | null,
  fallback: string
): string {
  const host = firstHeaderValue(get('x-forwarded-host')) ?? firstHeaderValue(get('host'));
  if (!host) return fallback;
  const hostname = host.replace(/:\d+$/, '');
  const proto =
    firstHeaderValue(get('x-forwarded-proto')) ??
    (LOOPBACK_HOSTS.has(hostname) ? 'http' : 'https');
  return `${proto}://${host}`;
}

export function wwwAuthenticateHeader(origin: string, error: 'invalid_token' | null): string {
  const base = `Bearer resource_metadata="${resourceMetadataUrl(origin)}"`;
  return error ? `${base}, error="${error}"` : base;
}

// ── MCP protocol ──────────────────────────────────────────────────────────

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;

export function negotiateProtocolVersion(requested: unknown): string {
  return typeof requested === 'string' &&
    (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : SUPPORTED_PROTOCOL_VERSIONS[0];
}
