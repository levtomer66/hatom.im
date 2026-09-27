'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import {
  AUTHORIZE_PARAM_NAMES,
  buildRedirectUrl,
  mcpResourceUrl,
  originFromHeaders,
  validateAuthorizeParams,
} from '@/lib/oauth-core';
import { getOAuthClient } from '@/models/OAuthClient';
import { createAuthorizationCode } from '@/models/OAuthCode';

// The consent form round-trips the original query as hidden fields; both
// actions re-run the page's full validation on them (never trust the form)
// and re-read the session before any redirect can happen (see the ordering
// note in revalidate). Next's server-action origin check covers CSRF.
async function revalidate(formData: FormData) {
  const params: Record<string, string | undefined> = {};
  for (const name of AUTHORIZE_PARAM_NAMES) {
    const value = formData.get(name);
    if (typeof value === 'string' && value !== '') params[name] = value;
  }
  const h = await headers();
  const origin = originFromHeaders((name) => h.get(name), 'https://www.hatom.im');
  const client = params.client_id ? await getOAuthClient(params.client_id) : null;
  const validation = validateAuthorizeParams(params, client, mcpResourceUrl(origin));
  if (validation.kind === 'render-error') throw new Error(validation.message);

  // Authenticate before any redirect — RFC 9700 §4.11.2 — so a
  // DCR-registered redirect_uri can't be used as an anonymous open redirector
  // via a protocol-error bounce. Same ordering as the page.
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    redirect(`/login?from=${encodeURIComponent(`/oauth/authorize?${query}`)}`);
  }

  // Only reachable by tampering with the hidden fields — the page never
  // renders a form whose params fail this check. Never redirect here: that
  // would recreate, in the server action, the exact open-redirect this gate
  // exists to close on the page (RFC 9700 §4.11.2).
  if (validation.kind === 'redirect-error') {
    throw new Error(`OAuth protocol error: ${validation.error} — ${validation.description}`);
  }
  return {
    origin,
    request: validation.request,
    email,
    userName: session?.user?.name?.trim() || email.split('@')[0],
  };
}

export async function approveAuthorization(formData: FormData): Promise<void> {
  const { origin, request, email, userName } = await revalidate(formData);
  const code = await createAuthorizationCode({
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    codeChallenge: request.codeChallenge,
    userEmail: email,
    userName,
    resource: request.resource,
  });
  redirect(buildRedirectUrl(request.redirectUri, { code, state: request.state, iss: origin }));
}

export async function denyAuthorization(formData: FormData): Promise<void> {
  const { origin, request } = await revalidate(formData);
  redirect(
    buildRedirectUrl(request.redirectUri, {
      error: 'access_denied',
      error_description: 'The user declined',
      state: request.state,
      iss: origin,
    })
  );
}
