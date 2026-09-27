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

function ErrorCard({ message }: { message: string }) {
  return (
    <>
      <Navbar />
      <main className="oauth-page">
        <div className="oauth-card">
          <h1 className="oauth-title">Can&apos;t connect this app</h1>
          <p className="oauth-sub">{message}</p>
          <p className="oauth-fine">Go back to the app and try adding hatom.im again.</p>
        </div>
      </main>
    </>
  );
}

// OAuth consent for MCP clients. Order matters:
//   1. render-error (untrusted client_id / redirect_uri) renders here and
//      never redirects (RFC 6749 §4.1.2.1).
//   2. the user must be authenticated before ANY redirect — RFC 9700
//      §4.11.2 requires authenticating the user before redirecting the
//      user agent. Registration is open (DCR), so without this gate an
//      attacker-registered redirect_uri could bounce an anonymous visitor
//      off hatom.im via a protocol-error redirect (an open redirect).
//   3. only once signed in do protocol errors redirect back to the client.
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
    redirect(
      buildRedirectUrl(validation.redirectUri, {
        error: validation.error,
        error_description: validation.description,
        state: validation.state,
        iss: origin,
      })
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
