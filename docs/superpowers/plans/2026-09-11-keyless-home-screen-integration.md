# Keyless Home-Screen Integration — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a one-tap "order my favorite coffee" iPhone home-screen button — a session-authed PWA page that places a saved favorite's order on load — plus the standalone-install metadata and the favorites affordance that make it discoverable.

**Architecture:** No new auth. A saved `CoffeeFavorite` is turned into an order by a new session-gated endpoint that reuses the *existing* order-creation + ntfy push. A fire-on-load client page calls it once. Adding that page to the iOS home screen (it declares `appleWebApp`) is the button. Everything is same-origin, so no CSP or env change.

**Tech Stack:** Next.js 15 App Router, TypeScript, native `mongodb` driver, Auth.js session, `next/og` icons (already present), `node:test` for the one pure helper.

## Global Constraints

- **No custom API key, no new collections, no new env vars, no CSP change.** (Keyless design — see `docs/superpowers/specs/2026-09-11-keyless-home-screen-integration-design.md`.)
- **Identity = the Auth.js session email**, server-derived. Never trust a client-supplied email. Ordering another user's favorite is refused (404) unless the caller is a site owner (`isOwnerEmail`), mirroring `deleteCoffeeFavorite`.
- **One push implementation.** The from-favorite endpoint must reuse the same `notifyCoffeeOrder` helper as `POST /api/coffee-order/orders` — do not write a second ntfy call.
- **A favorite has no `deliveryType`** (`CoffeeFavorite extends CoffeeDrinkConfig` + `{id,userEmail,name,createdAt}`). A one-tap order is always `deliveryType: 'now'`.
- **Pure helpers stay import-free** so `node --test` can load `src/types/coffee-order.ts` via a relative `.ts` path.
- Verify per task with `npx tsc --noEmit --incremental false --pretty false`; the full gate (`npm test`, tsc, lint, `npm run build`) runs before ship. The MongoDB "bad auth" lines during `build` are the known stale-local-creds noise and do not fail the build.

---

### Task 1: Pure `orderDtoFromFavorite` mapper (TDD)

**Files:**
- Modify: `src/types/coffee-order.ts` (add one exported function; keep the file import-free)
- Test: `src/lib/__tests__/coffee-order-from-favorite.test.ts`

**Interfaces:**
- Consumes: `CoffeeDrinkConfig`, `CreateCoffeeOrderDto` (already defined in the file).
- Produces: `orderDtoFromFavorite(fav: CoffeeDrinkConfig): CreateCoffeeOrderDto` — used by Task 4.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/coffee-order-from-favorite.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderDtoFromFavorite } from '../../types/coffee-order.ts';
import type { CoffeeDrinkConfig } from '../../types/coffee-order.ts';

const sample: CoffeeDrinkConfig = {
  drink: 'cappuccino',
  milk: 'oat',
  sugar: '2',
  source: 'tomer-coffee',
  capsule: 'caramel',
  glassColor: 'green',
  vanillaPumps: 1,
  caramelPumps: 3,
  notes: 'extra hot',
};

test('carries every drink-config field through unchanged', () => {
  const dto = orderDtoFromFavorite(sample);
  for (const k of Object.keys(sample) as (keyof CoffeeDrinkConfig)[]) {
    assert.deepEqual(dto[k], sample[k]);
  }
});

test('a one-tap order is always delivery "now" with no scheduledAt', () => {
  const dto = orderDtoFromFavorite(sample);
  assert.equal(dto.deliveryType, 'now');
  assert.equal('scheduledAt' in dto, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `/opt/homebrew/bin/node --test "src/lib/__tests__/coffee-order-from-favorite.test.ts"`
Expected: FAIL — `orderDtoFromFavorite` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/types/coffee-order.ts`, immediately after the `CreateCoffeeOrderDto` interface, add:

```ts
// A saved favorite → a "place it now" order DTO. Favorites carry no
// deliveryType, so a one-tap order is always immediate. Pure (import-free)
// so it stays node:test-able and shared by the from-favorite endpoint.
export function orderDtoFromFavorite(fav: CoffeeDrinkConfig): CreateCoffeeOrderDto {
  return {
    drink: fav.drink,
    milk: fav.milk,
    sugar: fav.sugar,
    source: fav.source,
    capsule: fav.capsule,
    glassColor: fav.glassColor,
    vanillaPumps: fav.vanillaPumps,
    caramelPumps: fav.caramelPumps,
    notes: fav.notes,
    deliveryType: 'now',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `/opt/homebrew/bin/node --test "src/lib/__tests__/coffee-order-from-favorite.test.ts"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/types/coffee-order.ts src/lib/__tests__/coffee-order-from-favorite.test.ts
git commit -m "feat(coffee): pure favorite→order DTO mapper"
```

---

### Task 2: `getCoffeeFavoriteById` model read

**Files:**
- Modify: `src/models/CoffeeFavorite.ts`

**Interfaces:**
- Produces: `getCoffeeFavoriteById(id: string): Promise<CoffeeFavorite | null>` — used by Task 4. Returns `null` for a missing doc *and* for a malformed id (never throws on a bad ObjectId).

- [ ] **Step 1: Add the function**

In `src/models/CoffeeFavorite.ts`, after `getCoffeeFavoritesForUser`, add (the file already imports `ObjectId` and defines the private `docToFavorite`):

```ts
// Single favorite by id. Returns null for a missing doc or a malformed id
// (a bad ObjectId must 404, not 500). Ownership is enforced by the caller.
export async function getCoffeeFavoriteById(
  id: string
): Promise<CoffeeFavorite | null> {
  const collection = await getCoffeeFavoritesCollection();
  try {
    const doc = await collection.findOne({ _id: new ObjectId(id) });
    return doc ? docToFavorite(doc) : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --incremental false --pretty false`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/models/CoffeeFavorite.ts
git commit -m "feat(coffee): getCoffeeFavoriteById model read"
```

---

### Task 3: Extract the ntfy push into one shared helper

**Files:**
- Create: `src/lib/coffee-notify.ts`
- Modify: `src/app/api/coffee-order/orders/route.ts`

**Interfaces:**
- Produces: `notifyCoffeeOrder(order: CoffeeOrder): Promise<void>` — used by Task 4 and the existing orders route. Never throws.

- [ ] **Step 1: Create the helper (move, don't rewrite)**

Create `src/lib/coffee-notify.ts` by moving the existing `NTFY_TOPIC` const and `notifyCoffeeOrder` function verbatim out of `orders/route.ts`:

```ts
import { CoffeeOrder, drinkSummary } from '@/types/coffee-order';

const NTFY_TOPIC = 'hatomim_coffee';

// Push so whoever is making coffee sees the order land. Call inside next/server
// `after()` — a bare fire-and-forget fetch dies when Vercel freezes the
// function right after the response. Failure is logged, never thrown.
export async function notifyCoffeeOrder(order: CoffeeOrder): Promise<void> {
  const when =
    order.deliveryType === 'scheduled' && order.scheduledAt
      ? new Date(order.scheduledAt).toLocaleString('he-IL', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Jerusalem',
        })
      : 'עכשיו';
  const bodyLines = [order.userName, drinkSummary(order), `מתי: ${when}`];
  if (order.notes.trim()) bodyLines.push(`הערות: ${order.notes.trim()}`);

  const asciiName =
    order.userName.replace(/[^\x20-\x7E]/g, '').trim() ||
    order.userEmail.split('@')[0];

  await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: 'POST',
    body: bodyLines.join('\n'),
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      Title: `New coffee order: ${asciiName}`,
      Tags: 'coffee',
    },
  }).catch((err) => {
    console.error('ntfy coffee notify failed', err);
  });
}
```

- [ ] **Step 2: Point the orders route at the helper**

In `src/app/api/coffee-order/orders/route.ts`: delete the local `NTFY_TOPIC` const and the whole `notifyCoffeeOrder` function, and add the import (alongside the other imports):

```ts
import { notifyCoffeeOrder } from '@/lib/coffee-notify';
```

The `after(() => notifyCoffeeOrder(order));` call in `POST` stays as-is. Remove `CoffeeOrder` and `drinkSummary` from the route's `@/types/coffee-order` import **only if** they are now unused there (check first — leave any still referenced).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit --incremental false --pretty false`
Expected: no errors (no unused-import complaints).

- [ ] **Step 4: Commit**

```bash
git add src/lib/coffee-notify.ts src/app/api/coffee-order/orders/route.ts
git commit -m "refactor(coffee): share notifyCoffeeOrder across order routes"
```

---

### Task 4: The from-favorite order endpoint

**Files:**
- Create: `src/app/api/coffee-order/orders/from-favorite/[favoriteId]/route.ts`

**Interfaces:**
- Consumes: `getCoffeeFavoriteById` (T2), `orderDtoFromFavorite` (T1), `notifyCoffeeOrder` (T3), existing `createCoffeeOrder`, `requirePagePermission`, `isOwnerEmail`.
- Produces: `POST /api/coffee-order/orders/from-favorite/:favoriteId` → 201 `CoffeeOrder` | 404 | 500. Used by Task 5.

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { isOwnerEmail } from '@/types/auth';
import { getCoffeeFavoriteById } from '@/models/CoffeeFavorite';
import { createCoffeeOrder } from '@/models/CoffeeOrder';
import { notifyCoffeeOrder } from '@/lib/coffee-notify';
import { orderDtoFromFavorite } from '@/types/coffee-order';

// POST — place a saved favorite as an order, right now. Session identity only;
// a caller may order their own favorite (owners may order anyone's). This is
// what the one-tap home-screen PWA page calls.
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ favoriteId: string }> }
) {
  const gate = await requirePagePermission('coffee-order');
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email;
  const userName = gate.session.user.name ?? email;

  const { favoriteId } = await ctx.params;
  try {
    const fav = await getCoffeeFavoriteById(favoriteId);
    // 404 on missing OR someone else's favorite — but site owners may order any.
    if (!fav || (fav.userEmail !== email.toLowerCase() && !isOwnerEmail(email))) {
      return NextResponse.json({ error: 'Favorite not found' }, { status: 404 });
    }
    const order = await createCoffeeOrder({
      userEmail: email,
      userName,
      ...orderDtoFromFavorite(fav),
    });
    after(() => notifyCoffeeOrder(order));
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Error ordering from favorite:', error);
    return NextResponse.json({ error: 'Failed to place order' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --incremental false --pretty false`
Expected: no errors. If `createCoffeeOrder`'s parameter type rejects the spread, open `src/models/CoffeeOrder.ts` and confirm its input is `Omit<CoffeeOrder,'id'|'createdAt'|'status'>` (config + userEmail + userName + deliveryType + optional scheduledAt); the spread of `orderDtoFromFavorite(fav)` supplies config + `deliveryType:'now'` and omits `scheduledAt`, which is valid.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/coffee-order/orders/from-favorite/[favoriteId]/route.ts"
git commit -m "feat(coffee): order-from-favorite endpoint"
```

---

### Task 5: The fire-on-load quick page (the button target)

**Files:**
- Create: `src/app/coffee-order/quick/[favoriteId]/page.tsx` (server — exports metadata)
- Create: `src/app/coffee-order/quick/[favoriteId]/QuickOrderClient.tsx` (client — fires the order)
- Create: `src/app/coffee-order/quick/[favoriteId]/quick.css`

**Interfaces:**
- Consumes: `POST /api/coffee-order/orders/from-favorite/:favoriteId` (T4), `CoffeeOrder` + `drinkSummary` types.
- A client component can't export `metadata`, so the **server** page owns metadata and renders the client child. `appleWebApp` on this page is what makes iOS open it standalone when added to the home screen.

- [ ] **Step 1: Server page with standalone metadata**

`src/app/coffee-order/quick/[favoriteId]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import QuickOrderClient from './QuickOrderClient';
import './quick.css';

// appleWebApp → iOS emits apple-mobile-web-app-capable etc., so adding THIS
// page to the home screen opens it chrome-less. The coffee apple-icon (already
// at /coffee-order/apple-icon) is the home-screen glyph.
export const metadata: Metadata = {
  title: '☕ הקפה שלי',
  appleWebApp: { capable: true, title: 'קפה', statusBarStyle: 'black-translucent' },
};

export default async function QuickOrderPage({
  params,
}: {
  params: Promise<{ favoriteId: string }>;
}) {
  const { favoriteId } = await params;
  return <QuickOrderClient favoriteId={favoriteId} />;
}
```

- [ ] **Step 2: Client component — single-shot fire-on-load**

`src/app/coffee-order/quick/[favoriteId]/QuickOrderClient.tsx`:

```tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CoffeeOrder, drinkSummary } from '@/types/coffee-order';

type State =
  | { phase: 'ordering' }
  | { phase: 'done'; order: CoffeeOrder }
  | { phase: 'error'; message: string };

export default function QuickOrderClient({ favoriteId }: { favoriteId: string }) {
  const [state, setState] = useState<State>({ phase: 'ordering' });
  // Guard React's dev double-mount so we never place two orders per open.
  const firedRef = useRef(false);

  async function placeOrder() {
    setState({ phase: 'ordering' });
    try {
      const res = await fetch(
        `/api/coffee-order/orders/from-favorite/${encodeURIComponent(favoriteId)}`,
        { method: 'POST' }
      );
      if (res.status === 401) {
        setState({ phase: 'error', message: 'צריך להתחבר קודם' });
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setState({ phase: 'error', message: body.error ?? 'ההזמנה נכשלה' });
        return;
      }
      const order = (await res.json()) as CoffeeOrder;
      setState({ phase: 'done', order });
    } catch {
      setState({ phase: 'error', message: 'אין חיבור לרשת' });
    }
  }

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    void placeOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="quick-order" dir="rtl">
      {state.phase === 'ordering' && (
        <>
          <div className="quick-spinner" aria-hidden />
          <p className="quick-status">מזמין…</p>
        </>
      )}
      {state.phase === 'done' && (
        <>
          <div className="quick-check" aria-hidden>✓</div>
          <p className="quick-status">הוזמן!</p>
          <p className="quick-summary">{drinkSummary(state.order)}</p>
          <button type="button" className="quick-again" onClick={() => void placeOrder()}>
            הזמן שוב
          </button>
          <Link href="/coffee-order" className="quick-link">לעמוד הקפה</Link>
        </>
      )}
      {state.phase === 'error' && (
        <>
          <div className="quick-x" aria-hidden>✕</div>
          <p className="quick-status">{state.message}</p>
          <button type="button" className="quick-again" onClick={() => void placeOrder()}>
            נסה שוב
          </button>
          <Link href="/coffee-order" className="quick-link">לעמוד הקפה</Link>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Styling**

`src/app/coffee-order/quick/[favoriteId]/quick.css`:

```css
.quick-order {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  text-align: center;
  background: #f6efe6;
  color: #3a2e22;
  font-size: 1.15rem;
}
.quick-status { font-size: 1.6rem; font-weight: 700; margin: 0; }
.quick-summary { opacity: 0.8; margin: 0; }
.quick-check, .quick-x {
  width: 84px; height: 84px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 3rem; color: #fff;
}
.quick-check { background: #3f9d5a; }
.quick-x { background: #c0503f; }
.quick-spinner {
  width: 64px; height: 64px; border-radius: 50%;
  border: 6px solid #d9c9b3; border-top-color: #8a6a45;
  animation: quick-spin 0.9s linear infinite;
}
@keyframes quick-spin { to { transform: rotate(360deg); } }
.quick-again {
  border: 0; border-radius: 999px; padding: 0.7rem 1.6rem;
  background: #8a6a45; color: #fff; font-size: 1.05rem; font-weight: 700;
}
.quick-link { color: #8a6a45; text-decoration: underline; }
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit --incremental false --pretty false && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "src/app/coffee-order/quick/[favoriteId]"
git commit -m "feat(coffee): one-tap quick-order PWA page"
```

---

### Task 6: "Add to Home Screen" affordance on favorites

**Files:**
- Modify: `src/app/coffee-order/page.tsx`
- Modify: `src/app/coffee-order/coffee-order.css` (one small rule)

**Interfaces:**
- Consumes: the quick page route (T5). `Link` is already imported at the top of `page.tsx`.

- [ ] **Step 1: Add the link into each favorite card**

In `src/app/coffee-order/page.tsx`, inside `<div className="coffee-fav-actions">`, between the "⚡ הזמן עכשיו" button and the delete button, add:

```tsx
<Link
  href={`/coffee-order/quick/${f.id}`}
  className="coffee-fav-homescreen"
  title="פתח כפתור מסך בית"
>
  📲 מסך בית
</Link>
```

- [ ] **Step 2: Add a one-time hint above the favorites list**

Directly before `<div className="coffee-fav-list">` (the `favorites.map` container), add a hint paragraph so users know the last step is manual (iOS can't add to the home screen programmatically):

```tsx
<p className="coffee-fav-hint">
  לחיצה על 📲 פותחת עמוד הזמנה מהיר — שם: שיתוף → הוספה למסך הבית, וקיבלת כפתור קפה בנגיעה אחת.
</p>
```

- [ ] **Step 3: Style the pieces**

Append to `src/app/coffee-order/coffee-order.css`:

```css
.coffee-fav-homescreen {
  display: inline-flex; align-items: center; gap: 0.25rem;
  padding: 0.35rem 0.7rem; border-radius: 999px;
  background: #efe4d4; color: #6f553a; font-size: 0.85rem; text-decoration: none;
}
.coffee-fav-hint { font-size: 0.8rem; opacity: 0.75; margin: 0 0 0.6rem; }
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit --incremental false --pretty false && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/coffee-order/page.tsx src/app/coffee-order/coffee-order.css
git commit -m "feat(coffee): add-to-home-screen affordance on favorites"
```

---

### Task 7: Full verification gate + manual acceptance

**Files:** none (verification only)

- [ ] **Step 1: Run the whole gate**

```bash
npm test
npx tsc --noEmit --incremental false --pretty false
npm run lint
npm run build
```

Expected: tests pass (now including the 2 new mapper tests), tsc clean, lint clean, build renders all pages. The MongoDB "bad auth" lines during build are expected local noise, not a failure. Confirm the build route list includes `ƒ /coffee-order/quick/[favoriteId]` and `ƒ /api/coffee-order/orders/from-favorite/[favoriteId]`.

- [ ] **Step 2: Manual acceptance (user's iPhone — the real test)**

Document these steps for the user in the ship report:
1. Sign in on the phone; open `/coffee-order`, save a favorite if none exists.
2. Tap **📲 מסך בית** on that favorite → the quick page opens and shows **הוזמן!** + the drink summary; confirm the order appears on `/coffee-order/board` and the `hatomim_coffee` ntfy push arrives.
3. On the quick page, use Safari **Share → Add to Home Screen**.
4. Launch from the new home-screen icon → it opens **standalone** (no Safari chrome) and places a fresh order. (Reopening = a new order, by design.)

- [ ] **Step 3: Ship**

Hand off to `/ship` (verify → commit already done per-task → `/code-review` against `origin/main` → address findings → push). Do not push before the review.

## Self-Review

- **Spec coverage:** flagship one-tap coffee (T1–T5), standalone install metadata (T5 step 1), discoverability affordance (T6), single shared push (T3), session-only auth with owner exception (T4), pure-helper unit test (T1). Google-token gate, pager migration, and MCP are explicitly Phase 2–4 in the spec — not in this plan. ✓
- **Placeholder scan:** none — every step has concrete code or an exact command. ✓
- **Type consistency:** `orderDtoFromFavorite` (T1) ↔ consumed in T4; `getCoffeeFavoriteById` (T2) ↔ T4; `notifyCoffeeOrder` (T3) ↔ T4; `CoffeeOrder`/`drinkSummary` (T5) match the file. Favorite has no `deliveryType`, handled in T1. ✓
