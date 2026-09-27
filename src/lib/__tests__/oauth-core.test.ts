import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateToken,
  hashToken,
  isTokenOfKind,
  isAllowedRedirectUri,
  parseBasicAuth,
  parseClientRegistration,
  pkceChallengeFromVerifier,
  verifyPkce,
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
