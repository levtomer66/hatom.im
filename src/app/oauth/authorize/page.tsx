import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Navbar from '@/components/Navbar';
import {
  AUTHORIZE_PARAM_NAMES,
  buildRedirectUrl,
  mcpResourceUrl,
  originFromHeaders,
  validateAuthorizeParams,
} from '@/lib/oauth-core';
import { getOAuthClient } from '@/models/OAuthClient';
import { approveAuthorization, denyAuthorization } from './actions';
import './authorize.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Connect an app · hatom.im',
  robots: { index: false, follow: false },
};

interface AuthorizePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function pickParams(
  raw: Record<string, string | string[] | undefined>
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const name of AUTHORIZE_PARAM_NAMES) {
    const value = raw[name];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) out[name] = first;
  }
  return out;
}

function ErrorCard({
  message,
  returnUrl,
  returnHost,
}: {
  message: string;
  returnUrl?: string;
  returnHost?: string;
}) {
  return (
    <>
      <Navbar />
      <main className="oauth-page">
        <div className="oauth-card">
          <h1 className="oauth-title">Can&apos;t connect this app</h1>
          <p className="oauth-sub">{message}</p>
          {returnUrl ? (
            <p className="oauth-fine">
              <a href={returnUrl}>Return to {returnHost}</a>
            </p>
          ) : (
            <p className="oauth-fine">Go back to the app and try adding hatom.im again.</p>
          )}
        </div>
      </main>
    </>
  );
}

// OAuth consent for MCP clients. Order matters:
//   1. render-error (untrusted client_id / redirect_uri) renders here and
//      never redirects (RFC 6749 §4.1.2.1).
//   2. the user must be authenticated before rendering anything derived
//      from an untrusted redirect_uri — RFC 9700 §4.11.2 requires
//      authenticating the user before redirecting the user agent, and
//      registration is open (DCR) so the redirect_uri itself is
//      attacker-controlled.
//   3. never auto-redirect to a redirect_uri except on Allow/Deny; protocol
//      errors render a click-through link back to the client instead
//      (RFC 9700 §4.11.2) — a signed-in user clicking a crafted link (e.g.
//      response_type=token) must not be silently bounced to evil.example.
export default async function AuthorizePage({ searchParams }: AuthorizePageProps) {
  const params = pickParams(await searchParams);
  const h = await headers();
  const origin = originFromHeaders((name) => h.get(name), 'https://www.hatom.im');
  const client = params.client_id ? await getOAuthClient(params.client_id) : null;
  const validation = validateAuthorizeParams(params, client, mcpResourceUrl(origin));

  if (validation.kind === 'render-error') return <ErrorCard message={validation.message} />;

  const session = await auth();
  if (!session?.user?.email) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    redirect(`/login?from=${encodeURIComponent(`/oauth/authorize?${query}`)}`);
  }

  if (validation.kind === 'redirect-error') {
    const returnHost = new URL(validation.redirectUri).host;
    const returnUrl = buildRedirectUrl(validation.redirectUri, {
      error: validation.error,
      error_description: validation.description,
      state: validation.state,
      iss: origin,
    });
    return (
      <ErrorCard
        message={`${validation.error}: ${validation.description}`}
        returnUrl={returnUrl}
        returnHost={returnHost}
      />
    );
  }

  const clientName = client!.clientName;
  const redirectHost = new URL(validation.request.redirectUri).host;

  return (
    <>
      <Navbar />
      <main className="oauth-page">
        <div className="oauth-card">
          <h1 className="oauth-title">Connect {clientName}?</h1>
          <p className="oauth-sub">
            <strong>{clientName}</strong>{' '}
            <span className="oauth-host">({redirectHost})</span> wants to use your hatom.im
            account as <strong>{session.user.email}</strong>.
          </p>
          <p className="oauth-fine">
            It will be able to do anything you can do here — order coffee, send pages, edit
            to-dos. You can disconnect it anytime from your avatar → API settings.
          </p>
          <form action={approveAuthorization} className="oauth-actions">
            {Object.entries(params).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <button type="submit" className="oauth-btn oauth-btn--primary">
              Allow
            </button>
            <button type="submit" formAction={denyAuthorization} className="oauth-btn">
              Deny
            </button>
          </form>
          <p className="oauth-fine">
            Only allow this if you just added hatom.im in {clientName}. The address above is
            where you&apos;ll be sent back.
          </p>
        </div>
      </main>
    </>
  );
}
