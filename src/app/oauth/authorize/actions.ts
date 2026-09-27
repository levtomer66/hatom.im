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
// and re-read the session before issuing anything. Next's server-action
// origin check covers CSRF.
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
  if (validation.kind === 'redirect-error') {
    redirect(
      buildRedirectUrl(validation.redirectUri, {
        error: validation.error,
        error_description: validation.description,
        state: validation.state,
        iss: origin,
      })
    );
  }
  return { origin, request: validation.request };
}

export async function approveAuthorization(formData: FormData): Promise<void> {
  const { origin, request } = await revalidate(formData);
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) redirect('/login');
  const code = await createAuthorizationCode({
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    codeChallenge: request.codeChallenge,
    userEmail: email,
    userName: session?.user?.name?.trim() || email.split('@')[0],
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
