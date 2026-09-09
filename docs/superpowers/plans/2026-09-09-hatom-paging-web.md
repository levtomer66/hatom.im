# Hatom Paging Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permissioned `hatom.im/paging` page and iPhone Shortcut endpoint that create high-urgency incidents in a dedicated PagerDuty service.

**Architecture:** `hatom.im` authenticates callers, validates a small page payload, and creates one PagerDuty REST incident (`POST /incidents`). PagerDuty owns all incident state. The website never reads incidents and creates no paging collection. Web callers use Auth.js; Shortcuts use a stateless HMAC token whose email is checked against the existing permission store on every request.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Auth.js v5, Node `crypto`, PagerDuty REST API v2, Vercel

## Global Constraints

- Follow `docs/superpowers/specs/2026-09-09-paging-system-design.md`.
- Do not add a paging MongoDB collection, ntfy integration, webhook, or incident history.
- Do not add dependencies; use `node:crypto` for UUIDs and HMAC.
- Do not add automated tests or test files unless the user explicitly requests them.
- Do not modify `CLAUDE.md`, `AGENTS.md`, README files, or other documentation without separate user approval.
- Do not stage the existing untracked `AGENTS.md` or `scripts/backfill-bodyweight.mjs`.
- Keep `PAGERDUTY_API_KEY`, optional `PAGERDUTY_SERVICE_ID`, optional
  `PAGERDUTY_FROM_EMAIL`, and `PAGING_SHORTCUT_SECRET` server-only.
- Use `NEXT_PUBLIC_PAGING_SHORTCUT_URL` only for the non-secret iCloud
  installation link; never put a paging token in that URL.
- Accept at most one emoji grapheme and 280 normalized message characters.
- PagerDuty `incident.body.details` is a JSON string whose keys are exactly
  `schema_version`, `emoji`, `message`, `caller_email`, `source`, and `page_id`.
- The successful create response is exactly
  `{ incidentId: string, pageId: string, status: "accepted" }` with HTTP `201`.
- Manual verification replaces new automated tests.

---

### Task 1: Add the paging permission and navigation

**Files:**
- Modify: `src/types/permissions.ts`
- Modify: `src/middleware.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/components/Navbar.tsx`

**Interfaces:**
- Produces: `PermissionKey` value `'paging'`
- Produces: authenticated route gate for `/paging`
- Consumes: existing `hasPermission(session, key)` and permission matrix rendering

- [ ] **Step 1: Add the permission key and metadata**

Add `'paging'` after `'valentine'` in the `PermissionKey` union and
`PERMISSION_KEYS`, then add:

```ts
paging: { label: 'Paging', emoji: '📟' },
```

to `PERMISSIONS`. Do not change `AuthorizedEmail`, `AllowlistManager`, or the
Auth.js session augmentation; they already consume `PermissionKey`
generically.

- [ ] **Step 2: Gate the page in middleware**

Add this entry to `GATES`:

```ts
{ pattern: /^\/paging(?:\/|$)/, permission: 'paging' },
```

Add this matcher:

```ts
'/paging/:path*',
```

API routes remain outside middleware and must authenticate inside their route
handlers.

- [ ] **Step 3: Add homepage and drawer links**

Import `FaBell` from `react-icons/fa`. Add this homepage feature:

```ts
{
  icon: FaBell,
  title: 'פייג׳ר',
  description: 'שליחת התראה דחופה לאייפון ול-Mac',
  href: '/paging',
  linkText: 'שלח פייג׳',
  permission: 'paging',
},
```

Add this drawer item before the admin items:

```ts
{
  href: '/paging',
  label: 'פייג׳ר',
  icon: FaBell,
  visibility: { permission: 'paging' },
},
```

- [ ] **Step 4: Type-check the permission changes**

Run:

```bash
npx tsc --noEmit --incremental false --pretty false
```

Expected: exit code `0`.

- [ ] **Step 5: Commit the permission slice**

```bash
git add src/types/permissions.ts src/middleware.ts src/app/page.tsx src/components/Navbar.tsx
git commit -m "feat(paging): add page permission and navigation"
```

Expected: the pre-commit hook passes and the commit contains only these four
files.

---

### Task 2: Define the page payload and PagerDuty incident module

**Files:**
- Create: `src/types/paging.ts`
- Create: `src/lib/pagerduty.ts`
- Create: `src/app/api/paging/pages/route.ts`

**Interfaces:**
- Produces: `parsePageRequest(value): NormalizedPageRequest | null`
- Produces: `createPageIncident(input): Promise<CreatePageIncidentResult>`
- Produces: `POST /api/paging/pages`
- Consumes: `requirePagePermission('paging')`

- [ ] **Step 1: Create the input parser**

Create `src/types/paging.ts`:

```ts
export const DEFAULT_PAGE_EMOJI = '📟';
export const MAX_PAGE_MESSAGE_LENGTH = 280;

export type PageSource = 'web' | 'shortcut';

export interface NormalizedPageRequest {
  emoji: string;
  message: string;
}

export interface StoredPagePayload {
  schema_version: number;
  emoji: string;
  message: string;
  caller_email: string;
  source: PageSource;
  page_id: string;
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/gu;
const EMOJI = /\p{Extended_Pictographic}/u;

export function parsePageRequest(value: unknown): NormalizedPageRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;

  const rawEmoji = body.emoji == null ? '' : body.emoji;
  const rawMessage = body.message == null ? '' : body.message;
  if (typeof rawEmoji !== 'string' || typeof rawMessage !== 'string') return null;

  const emojiInput = rawEmoji.trim();
  let emoji = DEFAULT_PAGE_EMOJI;
  if (emojiInput) {
    const graphemes = Array.from(
      new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(emojiInput),
      ({ segment }) => segment
    );
    if (graphemes.length !== 1 || !EMOJI.test(graphemes[0])) return null;
    emoji = graphemes[0];
  }

  const message = rawMessage.replace(CONTROL_CHARS, ' ').replace(/\s+/gu, ' ').trim();
  if (message.length > MAX_PAGE_MESSAGE_LENGTH) return null;
  return { emoji, message };
}
```

- [ ] **Step 2: Create the PagerDuty REST adapter**

Create `src/lib/pagerduty.ts`:

```ts
import { OWNER_EMAILS } from '@/types/auth';
import type { PageSource, StoredPagePayload } from '@/types/paging';

const PAGERDUTY_BASE_URL = 'https://api.pagerduty.com';
const HATOM_PAGING_SERVICE_NAME = 'Hatom Paging';

export interface CreatePageIncidentInput {
  emoji: string;
  message: string;
  callerEmail: string;
  source: PageSource;
  pageId: string;
}

export interface CreatePageIncidentResult {
  incidentId: string;
  pageId: string;
  status: 'accepted';
}

export class PagerDutyConfigurationError extends Error {}
export class PagerDutyUpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

let cachedServiceId: string | null = null;

function apiKey(): string {
  const key = process.env.PAGERDUTY_API_KEY;
  if (!key) {
    throw new PagerDutyConfigurationError('PAGERDUTY_API_KEY is not configured');
  }
  return key;
}

function fromEmail(): string {
  return process.env.PAGERDUTY_FROM_EMAIL ?? OWNER_EMAILS[0];
}

function pagerDutyHeaders(): Record<string, string> {
  return {
    Authorization: `Token token=${apiKey()}`,
    Accept: 'application/vnd.pagerduty+json;version=2',
  };
}

async function resolveServiceId(): Promise<string> {
  const configured = process.env.PAGERDUTY_SERVICE_ID;
  if (configured) return configured;
  if (cachedServiceId) return cachedServiceId;

  const url = `${PAGERDUTY_BASE_URL}/services?query=Hatom%20Paging&limit=100`;
  const response = await fetch(url, {
    headers: pagerDutyHeaders(),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new PagerDutyConfigurationError(
      `PagerDuty service discovery failed with HTTP ${response.status}`
    );
  }
  const body = (await response.json()) as { services: { id: string; name: string }[] };
  const matches = body.services.filter((s) => s.name === HATOM_PAGING_SERVICE_NAME);
  if (matches.length !== 1) {
    throw new PagerDutyConfigurationError(
      `Expected exactly one "${HATOM_PAGING_SERVICE_NAME}" service, found ${matches.length}`
    );
  }
  cachedServiceId = matches[0].id;
  return cachedServiceId;
}

function buildStoredPayload(input: CreatePageIncidentInput): StoredPagePayload {
  return {
    schema_version: 1,
    emoji: input.emoji,
    message: input.message,
    caller_email: input.callerEmail,
    source: input.source,
    page_id: input.pageId,
  };
}

export async function createPageIncident(
  input: CreatePageIncidentInput
): Promise<CreatePageIncidentResult> {
  const serviceId = await resolveServiceId();
  const title = input.message
    ? `${input.emoji} ${input.message}`
    : `${input.emoji} Page from ${input.callerEmail}`;
  const storedPayload = buildStoredPayload(input);

  const response = await fetch(`${PAGERDUTY_BASE_URL}/incidents`, {
    method: 'POST',
    headers: {
      ...pagerDutyHeaders(),
      'Content-Type': 'application/json',
      From: fromEmail(),
    },
    body: JSON.stringify({
      incident: {
        type: 'incident',
        title,
        service: { id: serviceId, type: 'service_reference' },
        urgency: 'high',
        incident_key: input.pageId,
        body: {
          type: 'incident_body',
          details: JSON.stringify(storedPayload),
        },
      },
    }),
    cache: 'no-store',
  });

  if (response.status !== 201) {
    throw new PagerDutyUpstreamError(
      `PagerDuty rejected the page with HTTP ${response.status}`,
      response.status
    );
  }

  const body = (await response.json()) as {
    incident: { id: string; incident_key: string };
  };
  const incidentId = body.incident?.id;
  const incidentKey = body.incident?.incident_key;
  if (!incidentId || incidentKey !== input.pageId) {
    throw new PagerDutyUpstreamError('Unexpected PagerDuty response', 502);
  }
  return { incidentId, pageId: input.pageId, status: 'accepted' };
}
```

This module is the only website seam that knows PagerDuty's wire format.
Never log the API key or upstream request body.

- [ ] **Step 3: Add the session-authenticated create route**

Create `src/app/api/paging/pages/route.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import {
  PagerDutyConfigurationError,
  PagerDutyUpstreamError,
  createPageIncident,
} from '@/lib/pagerduty';
import { parsePageRequest } from '@/types/paging';

export async function POST(request: NextRequest) {
  const gate = await requirePagePermission('paging');
  if (gate instanceof NextResponse) return gate;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const page = parsePageRequest(body);
  if (!page) {
    return NextResponse.json(
      { error: 'Use one emoji and a message of at most 280 characters' },
      { status: 400 }
    );
  }

  try {
    const result = await createPageIncident({
      ...page,
      pageId: randomUUID(),
      callerEmail: gate.session.user.email.toLowerCase(),
      source: 'web',
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PagerDutyConfigurationError) {
      console.error('[paging] PagerDuty is not configured');
      return NextResponse.json({ error: 'Paging is not configured' }, { status: 503 });
    }
    if (error instanceof PagerDutyUpstreamError) {
      console.error('[paging] PagerDuty create failed', error.status);
      return NextResponse.json({ error: 'PagerDuty rejected the page' }, { status: 502 });
    }
    console.error('[paging] Unexpected create failure');
    return NextResponse.json({ error: 'Failed to send page' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Type-check and inspect the route**

Run:

```bash
npx tsc --noEmit --incremental false --pretty false
git diff --check
```

Expected: both commands exit `0`.

- [ ] **Step 5: Commit the incident slice**

```bash
git add src/types/paging.ts src/lib/pagerduty.ts src/app/api/paging/pages/route.ts
git commit -m "feat(paging): create PagerDuty incidents"
```

---

### Task 3: Add stateless iPhone Shortcut authentication

**Files:**
- Create: `src/lib/paging-shortcut-token.ts`
- Create: `src/lib/paging-auth.ts`
- Create: `src/app/api/paging/shortcut-token/route.ts`
- Modify: `src/app/api/paging/pages/route.ts`

**Interfaces:**
- Produces: `signPagingShortcutToken(email): string`
- Produces: `verifyPagingShortcutToken(token): PagingShortcutClaims | null`
- Produces: `requirePagingCaller(request): Promise<PagingCaller | NextResponse>`
- Produces: `POST /api/paging/shortcut-token`
- Consumes: current `paging` permission from `AuthorizedEmail`

- [ ] **Step 1: Create the HMAC token module**

Create `src/lib/paging-shortcut-token.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_VERSION = 1;

export interface PagingShortcutClaims {
  v: 1;
  sub: string;
  iat: number;
}

function secret(): string {
  const value = process.env.PAGING_SHORTCUT_SECRET;
  if (!value) throw new Error('PAGING_SHORTCUT_SECRET is not configured');
  return value;
}

function signature(payload: string): Buffer {
  return createHmac('sha256', secret()).update(payload).digest();
}

export function signPagingShortcutToken(email: string): string {
  const claims: PagingShortcutClaims = {
    v: TOKEN_VERSION,
    sub: email.trim().toLowerCase(),
    iat: Math.floor(Date.now() / 1000),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${signature(payload).toString('base64url')}`;
}

export function verifyPagingShortcutToken(
  token: string
): PagingShortcutClaims | null {
  try {
    const [payload, encodedSignature, extra] = token.split('.');
    if (!payload || !encodedSignature || extra) return null;
    const actual = Buffer.from(encodedSignature, 'base64url');
    const expected = signature(payload);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return null;
    }
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as Partial<PagingShortcutClaims>;
    if (
      claims.v !== TOKEN_VERSION ||
      typeof claims.sub !== 'string' ||
      !claims.sub.includes('@') ||
      typeof claims.iat !== 'number'
    ) {
      return null;
    }
    return claims as PagingShortcutClaims;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Create the dual-auth gate**

Create `src/lib/paging-auth.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { getAuthorizedEmailEntry } from '@/models/AuthorizedEmail';
import { verifyPagingShortcutToken } from '@/lib/paging-shortcut-token';
import { isOwnerEmail } from '@/types/auth';
import type { PageSource } from '@/types/paging';

export interface PagingCaller {
  email: string;
  source: PageSource;
}

async function hasFreshPagingPermission(email: string): Promise<boolean> {
  if (isOwnerEmail(email)) return true;
  const entry = await getAuthorizedEmailEntry(email);
  return entry?.allowedPages.includes('paging') === true;
}

export async function requirePagingCaller(
  request: NextRequest
): Promise<PagingCaller | NextResponse> {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    const claims = verifyPagingShortcutToken(authorization.slice(7).trim());
    if (!claims) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const email = claims.sub.toLowerCase();
    if (!(await hasFreshPagingPermission(email))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return { email, source: 'shortcut' };
  }

  const gate = await requirePagePermission('paging');
  if (gate instanceof NextResponse) return gate;
  return { email: gate.session.user.email.toLowerCase(), source: 'web' };
}
```

This fresh Mongo lookup applies only to Shortcut calls and is what makes
permission removal revoke a token without storing the token itself.

- [ ] **Step 3: Add the token issuance route**

Create `src/app/api/paging/shortcut-token/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { signPagingShortcutToken } from '@/lib/paging-shortcut-token';

export async function POST() {
  const gate = await requirePagePermission('paging');
  if (gate instanceof NextResponse) return gate;
  try {
    const token = signPagingShortcutToken(gate.session.user.email);
    return NextResponse.json(
      { token },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[paging] Shortcut token signing is not configured', error);
    return NextResponse.json(
      { error: 'Shortcut setup is not configured' },
      { status: 503 }
    );
  }
}
```

- [ ] **Step 4: Switch the create route to the dual-auth gate**

Replace `requirePagePermission` with `requirePagingCaller(request)`. Build the
incident input from:

```ts
const caller = await requirePagingCaller(request);
if (caller instanceof NextResponse) return caller;

const result = await createPageIncident({
  ...page,
  pageId: randomUUID(),
  callerEmail: caller.email,
  source: caller.source,
});
```

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit --incremental false --pretty false
git diff --check
git add src/lib/paging-shortcut-token.ts src/lib/paging-auth.ts \
  src/app/api/paging/shortcut-token/route.ts src/app/api/paging/pages/route.ts
git commit -m "feat(paging): authorize iPhone Shortcut pages"
```

Expected: type-check and pre-commit hook pass.

---

### Task 4: Build the paging page

**Files:**
- Create: `src/app/paging/layout.tsx`
- Create: `src/app/paging/page.tsx`
- Create: `src/app/paging/paging.css`

**Interfaces:**
- Consumes: `POST /api/paging/pages`
- Consumes: `POST /api/paging/shortcut-token`
- Consumes: `DEFAULT_PAGE_EMOJI` and `MAX_PAGE_MESSAGE_LENGTH`

- [ ] **Step 1: Add route metadata**

Create `src/app/paging/layout.tsx`:

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '📟 פייג׳ר',
};

export default function PagingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

- [ ] **Step 2: Build the authenticated page form**

Create `src/app/paging/page.tsx` as a client module with:

```tsx
'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import { hasPermission } from '@/lib/permissions';
import {
  DEFAULT_PAGE_EMOJI,
  MAX_PAGE_MESSAGE_LENGTH,
} from '@/types/paging';
import './paging.css';

type SendState = 'idle' | 'sending' | 'sent' | 'error';
const shortcutInstallURL = process.env.NEXT_PUBLIC_PAGING_SHORTCUT_URL;

export default function PagingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [emoji, setEmoji] = useState(DEFAULT_PAGE_EMOJI);
  const [message, setMessage] = useState('');
  const [sendState, setSendState] = useState<SendState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [shortcutToken, setShortcutToken] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) router.replace('/login?from=/paging');
    else if (!hasPermission(session, 'paging')) router.replace('/');
  }, [router, session, status]);

  async function sendPage(event: FormEvent) {
    event.preventDefault();
    setSendState('sending');
    setError(null);
    try {
      const response = await fetch('/api/paging/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, message }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? `Failed (${response.status})`);
      setSendState('sent');
      setMessage('');
    } catch (sendError) {
      setSendState('error');
      setError(sendError instanceof Error ? sendError.message : 'שליחת הפייג׳ נכשלה');
    }
  }

  async function createShortcutToken() {
    setError(null);
    const response = await fetch('/api/paging/shortcut-token', { method: 'POST' });
    const body = (await response.json().catch(() => ({}))) as {
      token?: string;
      error?: string;
    };
    if (!response.ok || !body.token) {
      setError(body.error ?? 'יצירת הטוקן נכשלה');
      return;
    }
    setShortcutToken(body.token);
    await navigator.clipboard.writeText(body.token).catch(() => undefined);
  }

  async function copyShortcutToken() {
    if (!shortcutToken) return;
    await navigator.clipboard.writeText(shortcutToken);
  }

  if (
    status === 'loading' ||
    !session?.user ||
    !hasPermission(session, 'paging')
  ) {
    return <div className="paging-page-blank" />;
  }

  return (
    <div>
      <Navbar />
      <main className="paging-page">
        <section className="paging-card">
          <p className="paging-overline">HATOM PAGER</p>
          <h1>📟 שליחת פייג׳</h1>
          <form onSubmit={sendPage}>
            <label htmlFor="paging-emoji">אימוג׳י</label>
            <input
              id="paging-emoji"
              value={emoji}
              onChange={(event) => setEmoji(event.target.value)}
              placeholder={DEFAULT_PAGE_EMOJI}
              inputMode="text"
            />
            <label htmlFor="paging-message">הודעה אופציונלית</label>
            <textarea
              id="paging-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={MAX_PAGE_MESSAGE_LENGTH}
              rows={3}
            />
            {error && <p className="paging-error">{error}</p>}
            {sendState === 'sent' && <p className="paging-success">הפייג׳ נשלח ✓</p>}
            <button type="submit" disabled={sendState === 'sending'}>
              {sendState === 'sending' ? 'שולח…' : 'שלח פייג׳'}
            </button>
          </form>
        </section>

        <section className="paging-card paging-shortcut">
          <h2>קיצור דרך באייפון</h2>
          <p>
            צור טוקן, ואז הגדר ב-Shortcuts בקשת POST אל
            <code>https://www.hatom.im/api/paging/pages</code>.
          </p>
          <button type="button" onClick={createShortcutToken}>
            צור והעתק טוקן
          </button>
          {shortcutToken && (
            <div className="paging-token-ready">
              <label htmlFor="paging-shortcut-token">הטוקן הועתק</label>
              <input
                id="paging-shortcut-token"
                type="password"
                readOnly
                value={shortcutToken}
              />
              <button type="button" onClick={copyShortcutToken}>
                העתק שוב
              </button>
              {shortcutInstallURL ? (
                <a className="paging-install-link" href={shortcutInstallURL}>
                  פתח והתקן או עדכן את הקיצור
                </a>
              ) : (
                <p>קישור ההתקנה עדיין לא הוגדר.</p>
              )}
              <p>
                הוסף כותרת Authorization שמתחילה ב-
                <code>Bearer</code> ואחריה הטוקן שהועתק.
              </p>
              <ol>
                <li>
                  הוסף פעולת URL עם
                  <code>https://www.hatom.im/api/paging/pages</code>
                </li>
                <li>הוסף Get Contents of URL מסוג POST עם גוף JSON.</li>
                <li>
                  בגוף שלח <code>emoji</code> בערך <code>📟</code> ואת
                  <code>message</code> כמחרוזת ריקה.
                </li>
                <li>
                  הוסף כותרת <code>Authorization</code> עם
                  <code>Bearer</code>, רווח, והטוקן שהועתק.
                </li>
              </ol>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
```

Do not put the token in a URL query string.

- [ ] **Step 3: Add scoped responsive styling**

Create `src/app/paging/paging.css`. Scope every selector under `.paging-page`
or `.paging-page-blank`; use the site's dark/gold palette. The required layout
contract is:

```css
.paging-page-blank {
  min-height: 100vh;
  background: #0b0b0f;
}

.paging-page {
  min-height: calc(100vh - 64px);
  padding: 3rem 1rem;
  color: #f8f2e8;
  background:
    radial-gradient(circle at top, rgba(201, 169, 110, 0.18), transparent 40%),
    #0b0b0f;
  direction: rtl;
  text-align: start;
}

.paging-card {
  width: min(100%, 680px);
  margin: 0 auto 1.25rem;
  padding: 1.5rem;
  border: 1px solid rgba(201, 169, 110, 0.35);
  border-radius: 20px;
  background: rgba(20, 20, 26, 0.94);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
}

.paging-card form {
  display: grid;
  gap: 0.8rem;
}

.paging-card input,
.paging-card textarea {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 12px;
  padding: 0.9rem 1rem;
  color: inherit;
  background: rgba(255, 255, 255, 0.06);
  font: inherit;
}

.paging-card button {
  min-height: 48px;
  border: 0;
  border-radius: 999px;
  padding: 0.8rem 1.2rem;
  color: #111;
  background: #c9a96e;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.paging-card button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.paging-install-link {
  display: inline-flex;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0.8rem 1.2rem;
  color: #111;
  background: #f1d49b;
  font-weight: 700;
}

.paging-error { color: #ff9b9b; }
.paging-success { color: #99e6b3; }
.paging-shortcut code {
  display: block;
  direction: ltr;
  overflow-wrap: anywhere;
  margin-block: 0.5rem;
}
```

Add focus-visible outlines, mobile spacing below `600px`, overline/title
styles, and masked token styling without introducing global selectors.

- [ ] **Step 4: Type-check, build, and inspect manually**

Run:

```bash
npx tsc --noEmit --incremental false --pretty false
npm run build
git diff --check
```

Expected: all commands exit `0`. Existing stale local Mongo credentials may
emit known warnings during static generation, but the build must still exit
`0`.

Run `npm run dev`, sign in, and verify `/paging` redirects or renders according
to the permission matrix. Do not create automated test files.

- [ ] **Step 5: Commit the UI slice**

```bash
git add src/app/paging/layout.tsx src/app/paging/page.tsx src/app/paging/paging.css
git commit -m "feat(paging): add PagerDuty page form"
```

---

### Task 5: Configure PagerDuty and Vercel, then verify end to end

**Files:**
- No repository files

**Interfaces:**
- Produces: dedicated PagerDuty service ID and REST API key
- Produces: Vercel secrets consumed by Tasks 2 and 3

- [ ] **Step 1: Configure the PagerDuty service**

In PagerDuty:

1. Create the service **Hatom Paging**.
2. Assign its escalation policy to the intended iPhone user.
3. Set incident urgency to high.
4. Disable **Re-trigger acknowledged incidents after**.
5. In the iPhone PagerDuty app, enable **Critical Alerts for High-Urgency**.
6. Record the service ID for Vercel (`PAGERDUTY_SERVICE_ID`) and the separate
   `hatom-pager` plan.
7. Create a REST API key with permission to create incidents on that service.

- [ ] **Step 2: Create and share the installable iPhone Shortcut**

In the Shortcuts app, create **Hatom Pager** with:

1. A Text value for the paging token and an Import Question named
   **Paging token** so each installer pastes their own generated token.
2. A URL action containing
   `https://www.hatom.im/api/paging/pages`.
3. A Get Contents of URL action using POST with JSON keys `emoji` = `📟` and
   `message` = an empty string.
4. An `Authorization` header composed of `Bearer ` followed by the imported
   token.
5. A Show Result action that reports whether the request succeeded.

Share the Shortcut through iCloud and copy its public installation URL. The
shared Shortcut contains no live token; each user supplies one through the
Import Question.

- [ ] **Step 3: Add production and preview environment values**

From the linked `hatom.im` checkout, run the interactive commands and paste
the PagerDuty REST API key only when prompted:

```bash
vercel env add PAGERDUTY_API_KEY production
vercel env add PAGERDUTY_API_KEY preview ""
vercel env add PAGERDUTY_SERVICE_ID production
vercel env add PAGERDUTY_SERVICE_ID preview ""
vercel env add PAGERDUTY_FROM_EMAIL production
vercel env add PAGERDUTY_FROM_EMAIL preview ""
```

`PAGERDUTY_SERVICE_ID` and `PAGERDUTY_FROM_EMAIL` are optional; omit them to
use service discovery and the first owner email respectively.

Generate the Shortcut secret without printing it:

```bash
openssl rand -hex 32 | pbcopy
vercel env add PAGING_SHORTCUT_SECRET production
vercel env add PAGING_SHORTCUT_SECRET preview ""
```

Paste from the clipboard at each Shortcut-secret prompt. Pull development
values only if local live PagerDuty verification is required:

```bash
vercel env add NEXT_PUBLIC_PAGING_SHORTCUT_URL production
vercel env add NEXT_PUBLIC_PAGING_SHORTCUT_URL preview ""
vercel env pull .env.local
```

Paste the non-secret iCloud installation URL at the two
`NEXT_PUBLIC_PAGING_SHORTCUT_URL` prompts.

- [ ] **Step 4: Perform manual channel verification**

Verify in this order:

1. An owner can see `/paging`; a user without `paging` cannot.
2. Granting `paging` in `/admin/allowlist` makes the page visible after the
   session permission refresh.
3. Blank emoji becomes `📟`; two graphemes and messages over 280 characters
   return `400`.
4. A valid web page returns HTTP `201` with `{ incidentId, pageId, status:
   "accepted" }` and creates one high-urgency PagerDuty incident whose
   `body.details` JSON string contains the six exact payload keys including
   `schema_version`.
5. PagerDuty rejection produces HTTP `502` and a visible failure, not a false
   success.
6. Missing `PAGERDUTY_API_KEY` or failed service discovery returns HTTP `503`.
7. Generate a Shortcut token and send the default JSON body with its Bearer
   header.
8. Revoke `paging`; the same Shortcut token now returns `403`.
9. Rotate `PAGING_SHORTCUT_SECRET`; the previous token now returns `401`.

- [ ] **Step 5: Final repository verification**

```bash
npx tsc --noEmit --incremental false --pretty false
npm run lint
npm run build
git status --short
```

Expected: validation succeeds, with no new automated tests and no staged or
modified files outside the paging implementation. Do not commit environment
files or secrets.
