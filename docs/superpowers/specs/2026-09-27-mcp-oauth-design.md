# MCP OAuth — design

**Date:** 2026-09-27
**Status:** Approved in brainstorming, pending spec review

## Goal

Let people connect hatom.im's MCP server (`/api/mcp`) to **claude.ai web,
ChatGPT connectors and Microsoft Copilot** (and their mobile apps, which reuse
web-configured connectors) by signing in with OAuth instead of pasting a
personal API key.

## Non-goals

- Replacing the `htm_` personal API key. Shortcuts, the macOS app and existing
  MCP key users keep working unchanged.
- OAuth for any route other than `/api/mcp`. Feature routes stay key-or-session
  via `requireFeatureCaller`.
- Scoped/partial tokens. A token grants exactly what its user can do on the web
  (live `PermissionKey` check per tool, as today).
- Rate limiting, client-ID metadata documents (CIMD), OIDC `id_token`s.

## Approach

Hand-rolled OAuth 2.1 authorization server inside the Next app (Route Handlers
+ one server-rendered consent page + Mongo), no new npm dependencies. Mirrors
the hand-rolled JSON-RPC MCP server. Rejected: `oidc-provider` / MCP SDK auth
router / better-auth (heavy deps or an auth rewrite), and an external IdP
(vendor + second identity system).

## Flow

```
1. POST /api/mcp (no/invalid token)
     → 401, WWW-Authenticate: Bearer resource_metadata="<origin>/.well-known/oauth-protected-resource"
2. GET /.well-known/oauth-protected-resource
     → { resource: "<origin>/api/mcp", authorization_servers: ["<origin>"],
         bearer_methods_supported: ["header"], scopes_supported: ["mcp"] }
   (also served at /.well-known/oauth-protected-resource/api/mcp)
3. GET /.well-known/oauth-authorization-server
     → RFC 8414 metadata (also served at /.well-known/openid-configuration)
4. POST /api/oauth/register            (RFC 7591 dynamic client registration)
5. Browser → GET /oauth/authorize?...  → Google sign-in if needed → consent page
     Allow → 302 <redirect_uri>?code=…&state=…
     Deny  → 302 <redirect_uri>?error=access_denied&state=…
6. POST /api/oauth/token               (authorization_code + PKCE, refresh_token)
7. POST /api/mcp  Authorization: Bearer hto_…
```

`<origin>` is the request origin (honouring `x-forwarded-host` / `-proto`), so
production (`https://www.hatom.im`), previews and localhost each advertise
their own issuer. Clients (ChatGPT especially) reject an issuer that doesn't
match the URL they fetched.

### Authorization-server metadata

```json
{
  "issuer": "<origin>",
  "authorization_endpoint": "<origin>/oauth/authorize",
  "token_endpoint": "<origin>/api/oauth/token",
  "registration_endpoint": "<origin>/api/oauth/register",
  "revocation_endpoint": "<origin>/api/oauth/revoke",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none", "client_secret_post", "client_secret_basic"],
  "revocation_endpoint_auth_methods_supported": ["none", "client_secret_post", "client_secret_basic"],
  "scopes_supported": ["mcp"]
}
```

## Endpoints

### `POST /api/oauth/register`

- Accepts JSON: `redirect_uris` (required, 1–10), `client_name` (optional,
  ≤100 chars, default "MCP client"), `token_endpoint_auth_method` (default
  `none`), `grant_types`, `response_types` (if present, must be subsets of what
  we support).
- Each redirect URI must parse as a URL with no fragment, and be `https:` or
  `http:` with host `localhost` / `127.0.0.1` / `[::1]`.
- Issues `client_id` (`htc_` + random). Issues `client_secret` (`hts_` +
  random, stored hashed) only when auth method is `client_secret_post` or
  `client_secret_basic`.
- 201 with the RFC 7591 response (`client_id`, `client_secret?`,
  `client_id_issued_at`, `client_secret_expires_at: 0`, echoed metadata).
- Errors: 400 `{ error: "invalid_redirect_uri" | "invalid_client_metadata", error_description }`.

### `GET /oauth/authorize` (server-rendered page)

Parameters: `response_type`, `client_id`, `redirect_uri`, `code_challenge`,
`code_challenge_method`, `state`, `scope` (ignored beyond echo), `resource`.

Validation order:

1. Unknown `client_id`, or `redirect_uri` not an **exact string match** of a
   registered one (if the client registered exactly one URI, `redirect_uri` may
   be omitted) → render an error page. **Never redirect.**
2. Everything else redirects to `redirect_uri` with `error` + `state`:
   `response_type !== "code"` → `unsupported_response_type`; missing
   `code_challenge` or method ≠ `S256` → `invalid_request`; `resource` present
   and ≠ `<origin>/api/mcp` → `invalid_target`.
3. No session → redirect to `/login?from=/oauth/authorize?<original query>`, a relative path because `safeRedirectTarget` in `src/app/login/page.tsx` only allows those (the existing
   Google flow; the allowlist gate applies).
4. Signed in → consent page: client name, redirect **host**, the user's email,
   "Allow" / "Deny" buttons.

Allow/Deny are **server actions** (Next's built-in origin check covers CSRF).
The action re-runs the full validation from the submitted hidden fields and
re-reads the session before issuing anything.

Allow: creates an authorization code (`hta_` + random, stored hashed, 5-minute
TTL) bound to `{clientId, redirectUri, codeChallenge, userEmail, resource}`,
then redirects to `redirect_uri?code=…&state=…` (plus `iss=<origin>`).

### `POST /api/oauth/token`

`application/x-www-form-urlencoded` (JSON also accepted). Client auth: `none`
(public client, `client_id` in body), `client_secret_post`, or
`client_secret_basic`; a client must authenticate with the method it
registered.

- `grant_type=authorization_code`: atomically `findOneAndDelete` the code by
  hash (single use, whether it passes or fails), then check it's not expired,
  that `client_id` and `redirect_uri` match, and that
  `BASE64URL(SHA256(code_verifier)) === code_challenge`. Success: upsert the
  `(userEmail, clientId)` grant with a fresh token pair.
- `grant_type=refresh_token`: find the grant by refresh-token hash + client.
  Strict rotation: issue a new access + refresh token, and the old refresh
  token stops working.
- Response: `{ access_token: "hto_…", token_type: "Bearer", expires_in: 3600,
  refresh_token: "htr_…", scope: "mcp" }`, `Cache-Control: no-store`.
- Errors per RFC 6749: 400 `invalid_request` / `invalid_grant` /
  `unsupported_grant_type`, 401 `invalid_client`.

Lifetimes: access token 1 h, refresh token 30 days (resets on every rotation).

### `POST /api/oauth/revoke` (RFC 7009)

`token` (access or refresh) + client auth. Deletes the matching grant. Always
200, even for an unknown token.

### `/api/mcp` changes

- `resolveCaller`: `Bearer htm_…` → existing key path; `Bearer hto_…` → look up
  the grant by access-token hash, reject if expired, then build the same
  `ApiKeyOwner`-shaped caller (`userEmail`, `userName`, and
  `defaultCoffeeFavoriteId` read from `userApiSettings` if a row exists).
  Update `lastUsedAt` in `after()`.
- 401 responses add `WWW-Authenticate: Bearer resource_metadata="…"`, plus
  `error="invalid_token"` when a token was presented but was expired, revoked
  or unknown.
- `initialize` negotiation: if the client's `protocolVersion` is one of
  `2025-06-18`, `2025-03-26` or `2024-11-05`, echo it back; otherwise answer
  `2025-06-18`.

### Connected apps (user-facing)

- `GET /api/user/oauth-grants` (session only) →
  `[{ id, clientName, redirectHost, createdAt, lastUsedAt }]`.
- `DELETE /api/user/oauth-grants?id=…` (session only, must own the grant).
- `ApiSettingsDialog`: a "Connected apps" section listing these, each with a
  Revoke button. Empty state: "No connected apps."

### CORS

`Access-Control-Allow-Origin: *` plus an `OPTIONS` handler on the metadata
documents, `register`, `token` and `revoke`. This only matters for tools that
run in a browser (MCP Inspector). No cookies are involved.

## Storage

Typed-function models, one file per collection:

| Collection     | File                        | Shape |
|----------------|-----------------------------|-------|
| `oauthClients` | `src/models/OAuthClient.ts` | `clientId` (unique), `clientName`, `redirectUris[]`, `tokenEndpointAuthMethod`, `clientSecretHash?`, `createdAt` |
| `oauthCodes`   | `src/models/OAuthCode.ts`   | `codeHash` (unique), `clientId`, `redirectUri`, `codeChallenge`, `userEmail`, `resource?`, `expiresAt` (**TTL index**) |
| `oauthGrants`  | `src/models/OAuthGrant.ts`  | `userEmail`, `clientId` (unique pair), `accessTokenHash` (unique), `accessExpiresAt`, `refreshTokenHash` (unique), `refreshExpiresAt` (**TTL index**), `createdAt`, `lastUsedAt` |

All tokens, codes and secrets are stored as SHA-256 hex hashes. (Unlike
`htm_` keys, there's no need to reveal them later.) Revoking a grant deletes
its document. Connecting the same client again replaces its grant, so one
client has at most one grant per user.

## Module layout

- `src/lib/oauth-core.ts`: **import-free** (only `node:crypto`) pure logic:
  token generation + hashing, PKCE verification, redirect-URI rules,
  registration-body parsing, authorize-param validation (returns
  `{ kind: 'render-error' } | { kind: 'redirect-error' } | { kind: 'ok' }`),
  metadata builders, origin derivation from headers, and the protocol-version
  choice.
- `src/lib/oauth-http.ts`: shared CORS/`no-store` response helpers and
  client authentication (Basic/post/none) on top of the models.
- Route handlers: `src/app/.well-known/oauth-protected-resource/route.ts` (+
  `[...path]` variant), `src/app/.well-known/oauth-authorization-server/route.ts`,
  `src/app/.well-known/openid-configuration/route.ts`,
  `src/app/api/oauth/{register,token,revoke}/route.ts`,
  `src/app/api/user/oauth-grants/route.ts`.
- Consent page: `src/app/oauth/authorize/page.tsx` + `actions.ts`.

## Testing

- `src/lib/__tests__/oauth-core.test.ts` (`node:test`, relative `.ts` import):
  - PKCE: RFC 7636 appendix-B vector; wrong verifier fails.
  - Redirect URIs: https ok; http localhost ok; http non-local, fragments,
    `javascript:`, and unparsable URIs rejected.
  - Registration parsing: defaults, >10 URIs, long name, unsupported grant
    type, auth method selection.
  - Authorize validation: each render-error and redirect-error branch; the
    single-URI omission rule.
  - Metadata: issuer/endpoints derived from origin; forwarded-header origin.
  - Protocol-version negotiation.
- Local end-to-end with curl against `npm run dev`: discovery → register →
  (browser) authorize → token → `tools/list` → refresh → revoke → 401. Needs a
  working Mongo URI (local creds are stale; use `.env.workout`).
- Post-deploy manual check (user): add the connector in claude.ai, ChatGPT and
  Copilot, run a read-only tool (e.g. `list_coffee_favorites`), revoke it from
  the dialog, and confirm the next call fails and prompts a reconnect.
