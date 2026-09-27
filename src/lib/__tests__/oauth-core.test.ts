import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizationServerMetadata,
  buildRedirectUrl,
  generateToken,
  hashToken,
  isTokenOfKind,
  isAllowedRedirectUri,
  mcpResourceUrl,
  negotiateProtocolVersion,
  originFromHeaders,
  parseBasicAuth,
  parseClientRegistration,
  pkceChallengeFromVerifier,
  protectedResourceMetadata,
  validateAuthorizeParams,
  verifyPkce,
  wwwAuthenticateHeader,
} from '../oauth-core.ts';

test('generateToken uses the kind prefix and is recognised by isTokenOfKind', () => {
  const access = generateToken('access');
  assert.match(access, /^hto_[A-Za-z0-9_-]{43}$/);
  assert.equal(isTokenOfKind(access, 'access'), true);
  assert.equal(isTokenOfKind(access, 'refresh'), false);
  assert.equal(isTokenOfKind('htm_abcdefghijklmnopqrstuvwx', 'access'), false);
  assert.equal(isTokenOfKind('hto_short', 'access'), false);
  assert.notEqual(generateToken('code'), generateToken('code'));
});

test('hashToken is deterministic SHA-256 hex', () => {
  assert.equal(
    hashToken('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
});

test('PKCE matches the RFC 7636 appendix-B vector', () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  assert.equal(pkceChallengeFromVerifier(verifier), challenge);
  assert.equal(verifyPkce(verifier, challenge), true);
  assert.equal(verifyPkce(verifier.replace('d', 'e'), challenge), false);
  assert.equal(verifyPkce('too-short', challenge), false);
});

test('redirect URIs: https anywhere, http only on loopback, no fragments', () => {
  assert.equal(isAllowedRedirectUri('https://chatgpt.com/connector_platform_oauth_redirect'), true);
  assert.equal(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback'), true);
  assert.equal(isAllowedRedirectUri('http://localhost:6274/oauth/callback'), true);
  assert.equal(isAllowedRedirectUri('http://127.0.0.1:33418/callback'), true);
  assert.equal(isAllowedRedirectUri('http://[::1]:8080/cb'), true);
  assert.equal(isAllowedRedirectUri('http://evil.example/cb'), false);
  assert.equal(isAllowedRedirectUri('https://claude.ai/cb#frag'), false);
  assert.equal(isAllowedRedirectUri('javascript:alert(1)'), false);
  assert.equal(isAllowedRedirectUri('not a url'), false);
});

test('parseClientRegistration applies defaults', () => {
  const r = parseClientRegistration({ redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] });
  assert.deepEqual(r, {
    ok: true,
    registration: {
      clientName: 'MCP client',
      redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
      tokenEndpointAuthMethod: 'none',
    },
  });
});

test('parseClientRegistration keeps name + auth method and dedupes URIs', () => {
  const r = parseClientRegistration({
    client_name: '  ChatGPT  ',
    redirect_uris: ['https://chatgpt.com/cb', 'https://chatgpt.com/cb'],
    token_endpoint_auth_method: 'client_secret_post',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.registration.clientName, 'ChatGPT');
  assert.deepEqual(r.registration.redirectUris, ['https://chatgpt.com/cb']);
  assert.equal(r.registration.tokenEndpointAuthMethod, 'client_secret_post');
});

test('parseClientRegistration rejects bad input', () => {
  const bad = (body: unknown) => {
    const r = parseClientRegistration(body);
    assert.equal(r.ok, false);
    return r.ok ? '' : r.error;
  };
  assert.equal(bad(null), 'invalid_client_metadata');
  assert.equal(bad({}), 'invalid_redirect_uri');
  assert.equal(bad({ redirect_uris: [] }), 'invalid_redirect_uri');
  assert.equal(bad({ redirect_uris: ['http://evil.example/cb'] }), 'invalid_redirect_uri');
  assert.equal(
    bad({ redirect_uris: Array.from({ length: 11 }, (_, i) => `https://a.example/${i}`) }),
    'invalid_redirect_uri'
  );
  assert.equal(bad({ redirect_uris: ['https://a.example/cb'], client_name: 'x'.repeat(101) }), 'invalid_client_metadata');
  assert.equal(bad({ redirect_uris: ['https://a.example/cb'], client_name: 42 }), 'invalid_client_metadata');
  assert.equal(bad({ redirect_uris: ['https://a.example/cb'], token_endpoint_auth_method: 'private_key_jwt' }), 'invalid_client_metadata');
  assert.equal(bad({ redirect_uris: ['https://a.example/cb'], grant_types: ['implicit'] }), 'invalid_client_metadata');
  assert.equal(bad({ redirect_uris: ['https://a.example/cb'], response_types: ['token'] }), 'invalid_client_metadata');
});

test('parseBasicAuth decodes form-encoded credentials', () => {
  const header = 'Basic ' + Buffer.from('htc_abc:s%3Acret').toString('base64');
  assert.deepEqual(parseBasicAuth(header), { clientId: 'htc_abc', clientSecret: 's:cret' });
  assert.equal(parseBasicAuth(null), null);
  assert.equal(parseBasicAuth('Bearer xyz'), null);
  assert.equal(parseBasicAuth('Basic ' + Buffer.from('nocolon').toString('base64')), null);
});

const ORIGIN = 'https://www.hatom.im';
const RESOURCE = `${ORIGIN}/api/mcp`;
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const CLIENT = { clientId: 'htc_x', redirectUris: ['https://claude.ai/api/mcp/auth_callback'] };

function authParams(overrides: Record<string, string | undefined> = {}) {
  return {
    response_type: 'code',
    client_id: 'htc_x',
    redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    state: 'st',
    resource: RESOURCE,
    ...overrides,
  };
}

test('authorize: unknown client or mismatched redirect renders, never redirects', () => {
  assert.equal(validateAuthorizeParams(authParams(), null, RESOURCE).kind, 'render-error');
  assert.equal(
    validateAuthorizeParams(authParams({ redirect_uri: 'https://evil.example/cb' }), CLIENT, RESOURCE).kind,
    'render-error'
  );
  const twoUris = { clientId: 'htc_x', redirectUris: ['https://a.example/1', 'https://a.example/2'] };
  assert.equal(
    validateAuthorizeParams(authParams({ redirect_uri: undefined }), twoUris, RESOURCE).kind,
    'render-error'
  );
});

test('authorize: redirect_uri may be omitted when exactly one is registered', () => {
  const v = validateAuthorizeParams(authParams({ redirect_uri: undefined }), CLIENT, RESOURCE);
  assert.equal(v.kind, 'ok');
  if (v.kind === 'ok') assert.equal(v.request.redirectUri, CLIENT.redirectUris[0]);
});

test('authorize: protocol errors redirect with the OAuth error code and state', () => {
  const cases: Array<[Record<string, string | undefined>, string]> = [
    [{ response_type: 'token' }, 'unsupported_response_type'],
    [{ code_challenge: undefined }, 'invalid_request'],
    [{ code_challenge_method: 'plain' }, 'invalid_request'],
    [{ code_challenge_method: undefined }, 'invalid_request'],
    [{ code_challenge: 'short' }, 'invalid_request'],
    [{ resource: 'https://other.example/mcp' }, 'invalid_target'],
  ];
  for (const [overrides, error] of cases) {
    const v = validateAuthorizeParams(authParams(overrides), CLIENT, RESOURCE);
    assert.equal(v.kind, 'redirect-error', JSON.stringify(overrides));
    if (v.kind === 'redirect-error') {
      assert.equal(v.error, error);
      assert.equal(v.state, 'st');
      assert.equal(v.redirectUri, CLIENT.redirectUris[0]);
    }
  }
});

test('authorize: ok result; resource is optional and trailing slash tolerated', () => {
  const v = validateAuthorizeParams(authParams({ resource: `${RESOURCE}/`, scope: 'mcp' }), CLIENT, RESOURCE);
  assert.equal(v.kind, 'ok');
  if (v.kind === 'ok') {
    assert.deepEqual(v.request, {
      clientId: 'htc_x',
      redirectUri: CLIENT.redirectUris[0],
      codeChallenge: CHALLENGE,
      state: 'st',
      resource: RESOURCE,
      scope: 'mcp',
    });
  }
  const noResource = validateAuthorizeParams(authParams({ resource: undefined, state: undefined }), CLIENT, RESOURCE);
  assert.equal(noResource.kind, 'ok');
  if (noResource.kind === 'ok') {
    assert.equal(noResource.request.resource, null);
    assert.equal(noResource.request.state, null);
  }
});

test('buildRedirectUrl appends params, skips nulls, keeps existing query', () => {
  assert.equal(
    buildRedirectUrl('https://chatgpt.com/cb?x=1', { code: 'hta_a b', state: null, iss: ORIGIN }),
    'https://chatgpt.com/cb?x=1&code=hta_a+b&iss=https%3A%2F%2Fwww.hatom.im'
  );
});

test('metadata documents derive every URL from the origin', () => {
  assert.deepEqual(protectedResourceMetadata(ORIGIN), {
    resource: RESOURCE,
    authorization_servers: [ORIGIN],
    bearer_methods_supported: ['header'],
    scopes_supported: ['mcp'],
  });
  const as = authorizationServerMetadata('http://localhost:3000') as Record<string, unknown>;
  assert.equal(as.issuer, 'http://localhost:3000');
  assert.equal(as.authorization_endpoint, 'http://localhost:3000/oauth/authorize');
  assert.equal(as.token_endpoint, 'http://localhost:3000/api/oauth/token');
  assert.equal(as.registration_endpoint, 'http://localhost:3000/api/oauth/register');
  assert.equal(as.revocation_endpoint, 'http://localhost:3000/api/oauth/revoke');
  assert.deepEqual(as.code_challenge_methods_supported, ['S256']);
  assert.equal(mcpResourceUrl(ORIGIN), RESOURCE);
});

test('originFromHeaders prefers forwarded headers and defaults proto sensibly', () => {
  const from = (h: Record<string, string>) => (name: string) => h[name] ?? null;
  assert.equal(
    originFromHeaders(from({ 'x-forwarded-host': 'www.hatom.im', 'x-forwarded-proto': 'https', host: 'internal' }), 'x'),
    'https://www.hatom.im'
  );
  assert.equal(originFromHeaders(from({ host: 'localhost:3000' }), 'x'), 'http://localhost:3000');
  assert.equal(originFromHeaders(from({ host: 'preview.vercel.app' }), 'x'), 'https://preview.vercel.app');
  assert.equal(originFromHeaders(from({}), 'https://fallback.example'), 'https://fallback.example');
});

test('wwwAuthenticateHeader points at resource metadata, optionally with an error', () => {
  assert.equal(
    wwwAuthenticateHeader(ORIGIN, null),
    'Bearer resource_metadata="https://www.hatom.im/.well-known/oauth-protected-resource"'
  );
  assert.equal(
    wwwAuthenticateHeader(ORIGIN, 'invalid_token'),
    'Bearer resource_metadata="https://www.hatom.im/.well-known/oauth-protected-resource", error="invalid_token"'
  );
});

test('negotiateProtocolVersion echoes supported versions, else the newest', () => {
  assert.equal(negotiateProtocolVersion('2024-11-05'), '2024-11-05');
  assert.equal(negotiateProtocolVersion('2025-03-26'), '2025-03-26');
  assert.equal(negotiateProtocolVersion('2025-06-18'), '2025-06-18');
  assert.equal(negotiateProtocolVersion('2099-01-01'), '2025-06-18');
  assert.equal(negotiateProtocolVersion(undefined), '2025-06-18');
});
