# Coffee Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permission-gated `/coffee-order` SPA page where a granted user composes a coffee, orders it now or schedules it, gets the order pushed to ntfy.sh, and saves favorites for one-tap reordering.

**Architecture:** Mirror the existing `/spa` feature end-to-end — a client-component page gated by `useSession()` + `hasPermission`, posting to `src/app/api/coffee-order/*` route handlers that gate with `requirePagePermission('coffee-order')`, backed by two native-driver "typed functions" Mongo models (`coffeeOrders`, `coffeeFavorites`). The order create handler fires a fire-and-forget ntfy.sh push, exactly like `notifySpaSchedule`.

**Tech Stack:** Next.js 15 App Router, TypeScript, MongoDB native driver, Auth.js v5 (`next-auth@5`), `react-icons/fa`. No test framework in this repo — verification is `tsc` + `next lint` + `next build` + manual.

## Global Constraints

- **No Vercel CLI / deploy operations this session.** Deliverable is a PR to `origin`; the user merges.
- **Every commit runs `next build` via the Husky pre-commit hook and must pass.** Tasks are ordered so the tree always builds. If the Next cache wedges (`Cannot find module for page: /_document`), `rm -rf .next` and retry.
- **Verification per task:** `npx tsc --noEmit --incremental false --pretty false` then `npm run lint` (both must be clean) before committing; the commit itself triggers `next build`.
- **`userEmail` / `userName` always come from the Auth.js session, never the client body.**
- **Single permission key `coffee-order`** gates both read and write (ordering *is* the write), same as `spa`.
- Drink list is exactly: Espresso, Lungo, Cappuccino. Milk: None, Regular, Soy, Lactose-free, Oat. Sugar: None/1/2/3. Vanilla & Caramel pumps: integer 0–6. Notes ≤ 500 chars.
- UI copy is static English (no i18n dictionary); the page/nav title is Hebrew `☕ הזמנת קפה`, matching the Spa convention.
- `ntfy.sh` is already on the CSP `connect-src` allowlist in `next.config.js` — **do not** modify CSP.
- Branch `feat/coffee-order` already exists and holds the design spec commit. Work on that branch.

---

### Task 1: Types + permission key

**Files:**
- Create: `src/types/coffee-order.ts`
- Modify: `src/types/permissions.ts` (union ~line 9, `PERMISSION_KEYS` ~line 33, `PERMISSIONS` ~line 55)

**Interfaces:**
- Consumes: nothing (leaf types).
- Produces: types `CoffeeDrink`, `CoffeeMilk`, `CoffeeSugar`, `DeliveryType`, `CoffeeDrinkConfig`, `CoffeeOrder`, `CoffeeFavorite`, `CreateCoffeeOrderDto`, `CreateCoffeeFavoriteDto`; constants `COFFEE_DRINKS`, `COFFEE_MILKS`, `COFFEE_SUGARS`, `MAX_PUMPS`; helpers `isValidDrink`, `isValidMilk`, `isValidSugar`, `clampPumps`, `drinkLabel`, `milkLabel`, `drinkSummary`, `defaultDrinkConfig`. New `PermissionKey` member `'coffee-order'`.

- [ ] **Step 1: Create `src/types/coffee-order.ts`**

```ts
// Domain types + option constants + validation helpers for the /coffee-order
// feature. Mirrors src/types/spa.ts: string-literal unions, option arrays the
// UI maps over, and coercion/validation helpers the API uses so a stale or
// malicious client can't smuggle bad values into Mongo.

export type CoffeeDrink = 'espresso' | 'lungo' | 'cappuccino';
export type CoffeeMilk = 'none' | 'regular' | 'soy' | 'lactose-free' | 'oat';
export type CoffeeSugar = 'none' | '1' | '2' | '3';
export type DeliveryType = 'now' | 'scheduled';

export interface CoffeeOption<T extends string> {
  id: T;
  label: string;
  emoji?: string;
}

export const COFFEE_DRINKS: readonly CoffeeOption<CoffeeDrink>[] = [
  { id: 'espresso',   label: 'Espresso',   emoji: '⚡' },
  { id: 'lungo',      label: 'Lungo',      emoji: '🫗' },
  { id: 'cappuccino', label: 'Cappuccino', emoji: '☕' },
];

export const COFFEE_MILKS: readonly CoffeeOption<CoffeeMilk>[] = [
  { id: 'none',         label: 'None'         },
  { id: 'regular',      label: 'Regular'      },
  { id: 'soy',          label: 'Soy'          },
  { id: 'lactose-free', label: 'Lactose-free' },
  { id: 'oat',          label: 'Oat'          },
];

export const COFFEE_SUGARS: readonly CoffeeOption<CoffeeSugar>[] = [
  { id: 'none', label: 'None' },
  { id: '1',    label: '1'    },
  { id: '2',    label: '2'    },
  { id: '3',    label: '3'    },
];

export const MAX_PUMPS = 6;

// The shared drink-config subset — "an order minus identity and time". Both
// CoffeeOrder and CoffeeFavorite extend it so they stay in lockstep.
export interface CoffeeDrinkConfig {
  drink: CoffeeDrink;
  milk: CoffeeMilk;
  sugar: CoffeeSugar;
  vanillaPumps: number;
  caramelPumps: number;
  notes: string;
}

export interface CoffeeOrder extends CoffeeDrinkConfig {
  id: string;
  userEmail: string;
  userName: string;
  deliveryType: DeliveryType;
  scheduledAt?: string; // ISO 8601, present iff deliveryType === 'scheduled'
  createdAt: string;    // ISO 8601
}

export interface CoffeeFavorite extends CoffeeDrinkConfig {
  id: string;
  userEmail: string;
  name: string;
  createdAt: string;    // ISO 8601
}

export interface CreateCoffeeOrderDto extends CoffeeDrinkConfig {
  deliveryType: DeliveryType;
  scheduledAt?: string;
}

export interface CreateCoffeeFavoriteDto extends CoffeeDrinkConfig {
  name: string;
}

const DRINK_IDS = new Set<string>(COFFEE_DRINKS.map((d) => d.id));
const MILK_IDS = new Set<string>(COFFEE_MILKS.map((m) => m.id));
const SUGAR_IDS = new Set<string>(COFFEE_SUGARS.map((s) => s.id));

export function isValidDrink(v: unknown): v is CoffeeDrink {
  return typeof v === 'string' && DRINK_IDS.has(v);
}
export function isValidMilk(v: unknown): v is CoffeeMilk {
  return typeof v === 'string' && MILK_IDS.has(v);
}
export function isValidSugar(v: unknown): v is CoffeeSugar {
  return typeof v === 'string' && SUGAR_IDS.has(v);
}

// Clamp an arbitrary client value into an integer in [0, MAX_PUMPS].
export function clampPumps(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_PUMPS, Math.max(0, Math.round(n)));
}

export function drinkLabel(id: CoffeeDrink): string {
  return COFFEE_DRINKS.find((d) => d.id === id)?.label ?? id;
}
export function milkLabel(id: CoffeeMilk): string {
  return COFFEE_MILKS.find((m) => m.id === id)?.label ?? id;
}

// One-line human summary used in the ntfy push body, the post-submit recap,
// and the favorite/history cards, e.g.
//   "Cappuccino · Oat milk · 1 sugar · Vanilla x2"
export function drinkSummary(c: CoffeeDrinkConfig): string {
  const parts: string[] = [drinkLabel(c.drink)];
  parts.push(c.milk === 'none' ? 'No milk' : `${milkLabel(c.milk)} milk`);
  if (c.sugar !== 'none') parts.push(`${c.sugar} sugar`);
  if (c.vanillaPumps > 0) parts.push(`Vanilla x${c.vanillaPumps}`);
  if (c.caramelPumps > 0) parts.push(`Caramel x${c.caramelPumps}`);
  return parts.join(' · ');
}

// The default config the form starts from.
export function defaultDrinkConfig(): CoffeeDrinkConfig {
  return {
    drink: 'cappuccino',
    milk: 'regular',
    sugar: 'none',
    vanillaPumps: 0,
    caramelPumps: 0,
    notes: '',
  };
}
```

- [ ] **Step 2: Add `'coffee-order'` to the `PermissionKey` union in `src/types/permissions.ts`**

Replace:
```ts
  | 'family-tree'
  | 'mekafkefim'
  | 'instomit'
```
with:
```ts
  | 'family-tree'
  | 'mekafkefim'
  | 'coffee-order'
  | 'instomit'
```

- [ ] **Step 3: Add `'coffee-order'` to the `PERMISSION_KEYS` array**

Replace:
```ts
  'mekafkefim',
  'mekafkefim:write',
  'instomit',
```
with:
```ts
  'mekafkefim',
  'mekafkefim:write',
  'coffee-order',
  'instomit',
```

- [ ] **Step 4: Add the `coffee-order` entry to the `PERMISSIONS` meta map**

Replace:
```ts
  'mekafkefim:write':  { label: 'Mekafkefim write',  emoji: '✏️' },
  instomit:            { label: 'InsTomit',          emoji: '🎥' },
```
with:
```ts
  'mekafkefim:write':  { label: 'Mekafkefim write',  emoji: '✏️' },
  'coffee-order':      { label: 'Coffee Order',      emoji: '🧾' },
  instomit:            { label: 'InsTomit',          emoji: '🎥' },
```

(Distinct `🧾` emoji so the admin matrix doesn't show two identical ☕ cups next to Mekafkefim.)

- [ ] **Step 5: Verify types + lint**

Run: `npx tsc --noEmit --incremental false --pretty false && npm run lint`
Expected: no output from tsc; lint passes. The `Record<PermissionKey, PermissionMeta>` now compiles because every key (including the new one) has a meta entry.

- [ ] **Step 6: Commit**

```bash
git add src/types/coffee-order.ts src/types/permissions.ts
git commit -m "feat(coffee-order): domain types + coffee-order permission key"
```

---

### Task 2: Mongo models

**Files:**
- Create: `src/models/CoffeeOrder.ts`
- Create: `src/models/CoffeeFavorite.ts`

**Interfaces:**
- Consumes: `CoffeeOrder`, `CoffeeFavorite` from `@/types/coffee-order`; `clientPromise` from `@/lib/mongodb`.
- Produces:
  - `getCoffeeOrdersForUser(userEmail: string): Promise<CoffeeOrder[]>`
  - `createCoffeeOrder(data: Omit<CoffeeOrder, 'id' | 'createdAt'>): Promise<CoffeeOrder>`
  - `deleteCoffeeOrder(id: string, userEmail: string, isOwner: boolean): Promise<boolean>`
  - `getCoffeeFavoritesForUser(userEmail: string): Promise<CoffeeFavorite[]>`
  - `createCoffeeFavorite(data: Omit<CoffeeFavorite, 'id' | 'createdAt'>): Promise<CoffeeFavorite>`
  - `deleteCoffeeFavorite(id: string, userEmail: string, isOwner: boolean): Promise<boolean>`

- [ ] **Step 1: Create `src/models/CoffeeOrder.ts`**

```ts
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import type { CoffeeOrder } from '@/types/coffee-order';

const COLLECTION_NAME = 'coffeeOrders';

interface CoffeeOrderDocument extends Omit<CoffeeOrder, 'id'> {
  _id?: ObjectId;
}

export async function getCoffeeOrdersCollection() {
  const client = await clientPromise;
  const db = client.db();
  return db.collection<CoffeeOrderDocument>(COLLECTION_NAME);
}

function docToOrder(doc: CoffeeOrderDocument): CoffeeOrder {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id!.toString() } as CoffeeOrder;
}

// One user's orders, newest first.
export async function getCoffeeOrdersForUser(
  userEmail: string
): Promise<CoffeeOrder[]> {
  const collection = await getCoffeeOrdersCollection();
  const docs = await collection
    .find({ userEmail: userEmail.toLowerCase() })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(docToOrder);
}

export async function createCoffeeOrder(
  data: Omit<CoffeeOrder, 'id' | 'createdAt'>
): Promise<CoffeeOrder> {
  const collection = await getCoffeeOrdersCollection();
  const newDoc: Omit<CoffeeOrderDocument, '_id'> = {
    ...data,
    userEmail: data.userEmail.toLowerCase(),
    createdAt: new Date().toISOString(),
  };
  const result = await collection.insertOne(newDoc);
  return { ...newDoc, id: result.insertedId.toString() } as CoffeeOrder;
}

// Delete one order. A non-owner may only delete their own (the userEmail
// filter scopes it); owners may delete any. Returns true when a doc was removed.
export async function deleteCoffeeOrder(
  id: string,
  userEmail: string,
  isOwner: boolean
): Promise<boolean> {
  const collection = await getCoffeeOrdersCollection();
  try {
    const filter: Record<string, unknown> = { _id: new ObjectId(id) };
    if (!isOwner) filter.userEmail = userEmail.toLowerCase();
    const result = await collection.deleteOne(filter);
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting coffee order:', error);
    return false;
  }
}
```

- [ ] **Step 2: Create `src/models/CoffeeFavorite.ts`**

```ts
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import type { CoffeeFavorite } from '@/types/coffee-order';

const COLLECTION_NAME = 'coffeeFavorites';

interface CoffeeFavoriteDocument extends Omit<CoffeeFavorite, 'id'> {
  _id?: ObjectId;
}

export async function getCoffeeFavoritesCollection() {
  const client = await clientPromise;
  const db = client.db();
  return db.collection<CoffeeFavoriteDocument>(COLLECTION_NAME);
}

function docToFavorite(doc: CoffeeFavoriteDocument): CoffeeFavorite {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id!.toString() } as CoffeeFavorite;
}

export async function getCoffeeFavoritesForUser(
  userEmail: string
): Promise<CoffeeFavorite[]> {
  const collection = await getCoffeeFavoritesCollection();
  const docs = await collection
    .find({ userEmail: userEmail.toLowerCase() })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(docToFavorite);
}

export async function createCoffeeFavorite(
  data: Omit<CoffeeFavorite, 'id' | 'createdAt'>
): Promise<CoffeeFavorite> {
  const collection = await getCoffeeFavoritesCollection();
  const newDoc: Omit<CoffeeFavoriteDocument, '_id'> = {
    ...data,
    userEmail: data.userEmail.toLowerCase(),
    createdAt: new Date().toISOString(),
  };
  const result = await collection.insertOne(newDoc);
  return { ...newDoc, id: result.insertedId.toString() } as CoffeeFavorite;
}

export async function deleteCoffeeFavorite(
  id: string,
  userEmail: string,
  isOwner: boolean
): Promise<boolean> {
  const collection = await getCoffeeFavoritesCollection();
  try {
    const filter: Record<string, unknown> = { _id: new ObjectId(id) };
    if (!isOwner) filter.userEmail = userEmail.toLowerCase();
    const result = await collection.deleteOne(filter);
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting coffee favorite:', error);
    return false;
  }
}
```

- [ ] **Step 3: Verify types + lint**

Run: `npx tsc --noEmit --incremental false --pretty false && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/models/CoffeeOrder.ts src/models/CoffeeFavorite.ts
git commit -m "feat(coffee-order): coffeeOrders + coffeeFavorites Mongo models"
```

---

### Task 3: Orders API (GET, POST, DELETE) + ntfy push

**Files:**
- Create: `src/app/api/coffee-order/orders/route.ts`
- Create: `src/app/api/coffee-order/orders/[id]/route.ts`

**Interfaces:**
- Consumes: `requirePagePermission` from `@/lib/auth-helpers`; `isOwnerEmail` from `@/types/auth`; `getCoffeeOrdersForUser`, `createCoffeeOrder`, `deleteCoffeeOrder` from `@/models/CoffeeOrder`; types + helpers from `@/types/coffee-order`.
- Produces HTTP endpoints: `GET /api/coffee-order/orders`, `POST /api/coffee-order/orders`, `DELETE /api/coffee-order/orders/[id]`.

- [ ] **Step 1: Create `src/app/api/coffee-order/orders/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { getCoffeeOrdersForUser, createCoffeeOrder } from '@/models/CoffeeOrder';
import {
  CreateCoffeeOrderDto,
  CoffeeOrder,
  isValidDrink,
  isValidMilk,
  isValidSugar,
  clampPumps,
  drinkSummary,
} from '@/types/coffee-order';

const NTFY_TOPIC = 'hatomim_coffee';

// Fire-and-forget push so whoever is making coffee sees the order land. Same
// pattern as notifySpaSchedule. ntfy.sh is already on the CSP connect-src
// allowlist (and this runs server-side anyway). Failure is logged, never
// blocks the response.
function notifyCoffeeOrder(order: CoffeeOrder): void {
  const when =
    order.deliveryType === 'scheduled' && order.scheduledAt
      ? order.scheduledAt
      : 'now';
  const bodyLines = [order.userName, drinkSummary(order), `When: ${when}`];
  if (order.notes.trim()) bodyLines.push(`Notes: ${order.notes.trim()}`);

  fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: 'POST',
    body: bodyLines.join('\n'),
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Title must be ASCII for ntfy.sh.
      Title: `New coffee order: ${order.userName}`,
      Tags: 'coffee',
    },
  }).catch((err) => {
    console.error('ntfy coffee notify failed', err);
  });
}

// GET — the signed-in user's own order history, newest first.
export async function GET() {
  const gate = await requirePagePermission('coffee-order');
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email;

  try {
    const orders = await getCoffeeOrdersForUser(email);
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching coffee orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coffee orders' },
      { status: 500 }
    );
  }
}

// POST — place an order. Identity comes from the session; drink config is
// validated + clamped before persisting.
export async function POST(request: NextRequest) {
  const gate = await requirePagePermission('coffee-order');
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email;
  const userName = gate.session.user.name ?? email;

  try {
    const data = (await request.json()) as Partial<CreateCoffeeOrderDto>;

    if (!isValidDrink(data.drink)) {
      return NextResponse.json({ error: 'Invalid drink' }, { status: 400 });
    }
    if (!isValidMilk(data.milk)) {
      return NextResponse.json({ error: 'Invalid milk' }, { status: 400 });
    }
    if (!isValidSugar(data.sugar)) {
      return NextResponse.json({ error: 'Invalid sugar' }, { status: 400 });
    }
    if (data.deliveryType !== 'now' && data.deliveryType !== 'scheduled') {
      return NextResponse.json(
        { error: 'deliveryType must be "now" or "scheduled"' },
        { status: 400 }
      );
    }

    let scheduledAt: string | undefined;
    if (data.deliveryType === 'scheduled') {
      if (typeof data.scheduledAt !== 'string' || !data.scheduledAt.trim()) {
        return NextResponse.json(
          { error: 'scheduledAt is required for scheduled orders' },
          { status: 400 }
        );
      }
      const parsed = new Date(data.scheduledAt);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: 'scheduledAt is not a valid date' },
          { status: 400 }
        );
      }
      scheduledAt = parsed.toISOString();
    }

    const notes = typeof data.notes === 'string' ? data.notes.slice(0, 500) : '';

    const order = await createCoffeeOrder({
      userEmail: email,
      userName,
      drink: data.drink,
      milk: data.milk,
      sugar: data.sugar,
      vanillaPumps: clampPumps(data.vanillaPumps),
      caramelPumps: clampPumps(data.caramelPumps),
      notes,
      deliveryType: data.deliveryType,
      // Only attach scheduledAt for scheduled orders so "now" docs stay clean.
      ...(scheduledAt ? { scheduledAt } : {}),
    });

    notifyCoffeeOrder(order);
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Error creating coffee order:', error);
    return NextResponse.json(
      { error: 'Failed to create coffee order' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create `src/app/api/coffee-order/orders/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { isOwnerEmail } from '@/types/auth';
import { deleteCoffeeOrder } from '@/models/CoffeeOrder';

// DELETE — cancel an order. A user can delete their own; owners can delete any.
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePagePermission('coffee-order');
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email;

  try {
    const { id } = await context.params;
    const ok = await deleteCoffeeOrder(id, email, isOwnerEmail(email));
    if (!ok) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting coffee order:', error);
    return NextResponse.json(
      { error: 'Failed to delete coffee order' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Verify types + lint**

Run: `npx tsc --noEmit --incremental false --pretty false && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/coffee-order/orders
git commit -m "feat(coffee-order): orders API (list/create/delete) + ntfy push"
```

---

### Task 4: Favorites API (GET, POST, DELETE)

**Files:**
- Create: `src/app/api/coffee-order/favorites/route.ts`
- Create: `src/app/api/coffee-order/favorites/[id]/route.ts`

**Interfaces:**
- Consumes: `requirePagePermission`; `isOwnerEmail`; `getCoffeeFavoritesForUser`, `createCoffeeFavorite`, `deleteCoffeeFavorite` from `@/models/CoffeeFavorite`; validators from `@/types/coffee-order`.
- Produces HTTP endpoints: `GET /api/coffee-order/favorites`, `POST /api/coffee-order/favorites`, `DELETE /api/coffee-order/favorites/[id]`.

- [ ] **Step 1: Create `src/app/api/coffee-order/favorites/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import {
  getCoffeeFavoritesForUser,
  createCoffeeFavorite,
} from '@/models/CoffeeFavorite';
import {
  CreateCoffeeFavoriteDto,
  isValidDrink,
  isValidMilk,
  isValidSugar,
  clampPumps,
} from '@/types/coffee-order';

// GET — the signed-in user's own favorites, newest first.
export async function GET() {
  const gate = await requirePagePermission('coffee-order');
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email;

  try {
    const favorites = await getCoffeeFavoritesForUser(email);
    return NextResponse.json(favorites);
  } catch (error) {
    console.error('Error fetching coffee favorites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coffee favorites' },
      { status: 500 }
    );
  }
}

// POST — save a favorite drink config under a user-given name.
export async function POST(request: NextRequest) {
  const gate = await requirePagePermission('coffee-order');
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email;

  try {
    const data = (await request.json()) as Partial<CreateCoffeeFavoriteDto>;

    if (typeof data.name !== 'string' || !data.name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!isValidDrink(data.drink)) {
      return NextResponse.json({ error: 'Invalid drink' }, { status: 400 });
    }
    if (!isValidMilk(data.milk)) {
      return NextResponse.json({ error: 'Invalid milk' }, { status: 400 });
    }
    if (!isValidSugar(data.sugar)) {
      return NextResponse.json({ error: 'Invalid sugar' }, { status: 400 });
    }

    const favorite = await createCoffeeFavorite({
      userEmail: email,
      name: data.name.trim().slice(0, 60),
      drink: data.drink,
      milk: data.milk,
      sugar: data.sugar,
      vanillaPumps: clampPumps(data.vanillaPumps),
      caramelPumps: clampPumps(data.caramelPumps),
      notes: typeof data.notes === 'string' ? data.notes.slice(0, 500) : '',
    });

    return NextResponse.json(favorite, { status: 201 });
  } catch (error) {
    console.error('Error creating coffee favorite:', error);
    return NextResponse.json(
      { error: 'Failed to create coffee favorite' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create `src/app/api/coffee-order/favorites/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { isOwnerEmail } from '@/types/auth';
import { deleteCoffeeFavorite } from '@/models/CoffeeFavorite';

// DELETE — remove a favorite. A user can delete their own; owners can delete any.
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePagePermission('coffee-order');
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email;

  try {
    const { id } = await context.params;
    const ok = await deleteCoffeeFavorite(id, email, isOwnerEmail(email));
    if (!ok) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting coffee favorite:', error);
    return NextResponse.json(
      { error: 'Failed to delete coffee favorite' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Verify types + lint**

Run: `npx tsc --noEmit --incremental false --pretty false && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/coffee-order/favorites
git commit -m "feat(coffee-order): favorites API (list/create/delete)"
```

---

### Task 5: Page + layout + CSS

**Files:**
- Create: `src/app/coffee-order/layout.tsx`
- Create: `src/app/coffee-order/coffee-order.css`
- Create: `src/app/coffee-order/page.tsx`

**Interfaces:**
- Consumes: `Navbar` from `@/components/Navbar`; `hasPermission` from `@/lib/permissions`; types + constants + `drinkSummary`/`defaultDrinkConfig` from `@/types/coffee-order`; the four API endpoints from Tasks 3–4.
- Produces: the `/coffee-order` route. No exports other tasks consume.

- [ ] **Step 1: Create `src/app/coffee-order/layout.tsx`**

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '☕ הזמנת קפה',
};

export default function CoffeeOrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

- [ ] **Step 2: Create `src/app/coffee-order/coffee-order.css`**

```css
/* Coffee Order — warm, cozy palette. Everything is scoped under .coffee-page
   so it never leaks into the rest of the site. English LTR UI (the page title
   in layout metadata is Hebrew, matching the Spa feature). */

.coffee-page-blank {
  min-height: 100vh;
  background: #f3e9dd;
}

.coffee-page {
  min-height: 100vh;
  background: linear-gradient(160deg, #f3e9dd 0%, #e7d3bd 100%);
  color: #3a2a1d;
  direction: ltr;
  text-align: start;
  padding-bottom: 4rem;
}

.coffee-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1.5rem 1rem 0;
}

.coffee-hero {
  text-align: center;
  padding: 2rem 0 1.5rem;
}
.coffee-hero-overline {
  text-transform: uppercase;
  letter-spacing: 0.25em;
  font-size: 0.7rem;
  color: #9c6f44;
  margin: 0 0 0.5rem;
}
.coffee-hero-title {
  font-size: 2.2rem;
  margin: 0;
  color: #4a2f1b;
}

.coffee-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
}
@media (min-width: 820px) {
  .coffee-grid {
    grid-template-columns: 1.15fr 0.85fr;
    align-items: start;
  }
}

.coffee-card {
  background: #fffaf3;
  border: 1px solid #e3cdb1;
  border-radius: 16px;
  padding: 1.25rem;
  box-shadow: 0 8px 24px rgba(74, 47, 27, 0.08);
}

.coffee-side {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.coffee-section-title {
  font-size: 1.05rem;
  margin: 0 0 0.75rem;
  color: #6b4423;
}
.coffee-form-card .coffee-section-title:not(:first-child) {
  margin-top: 1.25rem;
}

.coffee-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 0.9rem;
  flex: 1;
}
.coffee-field > label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #8a6240;
}
.coffee-row {
  display: flex;
  gap: 1rem;
}

.coffee-field select,
.coffee-field input,
.coffee-field textarea {
  font: inherit;
  padding: 0.55rem 0.65rem;
  border: 1px solid #d8bd9c;
  border-radius: 10px;
  background: #fff;
  color: #3a2a1d;
}
.coffee-field textarea {
  resize: vertical;
}

.coffee-segmented {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.coffee-seg-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.8rem;
  border: 1px solid #d8bd9c;
  border-radius: 999px;
  background: #fff;
  color: #6b4423;
  cursor: pointer;
  font: inherit;
  transition: all 0.15s ease;
}
.coffee-seg-btn:hover {
  border-color: #b9854f;
}
.coffee-seg-btn.active {
  background: #6b4423;
  border-color: #6b4423;
  color: #fff7ec;
}
.coffee-when {
  margin-bottom: 0.9rem;
}

.coffee-stepper {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
}
.coffee-stepper button {
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 50%;
  border: 1px solid #d8bd9c;
  background: #fff;
  color: #6b4423;
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
}
.coffee-stepper button:hover {
  border-color: #b9854f;
}
.coffee-stepper span {
  min-width: 1.5rem;
  text-align: center;
  font-weight: 600;
}

.coffee-form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}
.coffee-btn-primary,
.coffee-btn-secondary {
  flex: 1;
  min-width: 8rem;
  padding: 0.7rem 1rem;
  border-radius: 12px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
}
.coffee-btn-primary {
  background: #6b4423;
  color: #fff7ec;
}
.coffee-btn-primary:disabled {
  opacity: 0.6;
  cursor: default;
}
.coffee-btn-secondary {
  background: #fff;
  border-color: #d8bd9c;
  color: #6b4423;
}

.coffee-error {
  margin-top: 0.75rem;
  padding: 0.6rem 0.8rem;
  border-radius: 10px;
  background: #fdecea;
  color: #a4332a;
  font-size: 0.85rem;
}

.coffee-result {
  margin-top: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  background: #efe1cf;
  border: 1px dashed #c69b6d;
}
.coffee-result h3 {
  margin: 0 0 0.3rem;
  color: #4a2f1b;
}
.coffee-result p {
  margin: 0;
  font-size: 0.9rem;
}

.coffee-empty {
  color: #9c7a57;
  font-size: 0.9rem;
  margin: 0;
}

.coffee-fav-list,
.coffee-order-list {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.coffee-fav-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border: 1px solid #e3cdb1;
  border-radius: 12px;
  padding: 0.7rem 0.8rem;
  background: #fffaf3;
}
.coffee-fav-body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  text-align: start;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font: inherit;
  color: inherit;
}
.coffee-fav-name {
  font-weight: 700;
  color: #4a2f1b;
}
.coffee-fav-summary {
  font-size: 0.82rem;
  color: #8a6240;
}
.coffee-fav-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: space-between;
}
.coffee-quick-btn {
  padding: 0.4rem 0.7rem;
  border-radius: 999px;
  border: 1px solid #c69b6d;
  background: #f6e7d3;
  color: #6b4423;
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
}
.coffee-quick-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.coffee-order-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  border: 1px solid #e3cdb1;
  border-radius: 12px;
  padding: 0.7rem 0.8rem;
  background: #fffaf3;
}
.coffee-order-main {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.coffee-order-summary {
  font-weight: 600;
  color: #4a2f1b;
  font-size: 0.9rem;
}
.coffee-order-when {
  font-size: 0.78rem;
  color: #8a6240;
}
.coffee-order-notes {
  font-size: 0.8rem;
  color: #9c7a57;
  font-style: italic;
}

.coffee-delete {
  flex-shrink: 0;
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 50%;
  border: 1px solid #e0c4a3;
  background: #fff;
  color: #a4332a;
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
}
.coffee-delete:hover {
  background: #fdecea;
}
```

- [ ] **Step 3: Create `src/app/coffee-order/page.tsx`**

```tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import { hasPermission } from '@/lib/permissions';
import {
  CoffeeOrder,
  CoffeeFavorite,
  CoffeeDrinkConfig,
  CreateCoffeeOrderDto,
  CoffeeSugar,
  COFFEE_DRINKS,
  COFFEE_MILKS,
  COFFEE_SUGARS,
  MAX_PUMPS,
  drinkSummary,
  defaultDrinkConfig,
} from '@/types/coffee-order';
import './coffee-order.css';

// datetime-local default: tomorrow 09:00 local.
function defaultScheduledValue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CoffeeOrderPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Middleware already gates, but this covers soft-nav edge cases — same shape
  // as family-tree/page.tsx and spa/page.tsx.
  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) {
      router.replace('/login?from=/coffee-order');
      return;
    }
    if (!hasPermission(session, 'coffee-order')) {
      router.replace('/');
    }
  }, [session, status, router]);

  // ---- form state ----
  const [config, setConfig] = useState<CoffeeDrinkConfig>(defaultDrinkConfig);
  const [deliveryNow, setDeliveryNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState<string>(defaultScheduledValue());

  // ---- data ----
  const [orders, setOrders] = useState<CoffeeOrder[]>([]);
  const [favorites, setFavorites] = useState<CoffeeFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<CoffeeOrder | null>(null);

  const canRead =
    status === 'authenticated' && hasPermission(session, 'coffee-order');

  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    Promise.all([
      fetch('/api/coffee-order/orders').then((r) =>
        r.ok ? r.json() : Promise.reject(r)
      ),
      fetch('/api/coffee-order/favorites').then((r) =>
        r.ok ? r.json() : Promise.reject(r)
      ),
    ])
      .then(([o, f]: [CoffeeOrder[], CoffeeFavorite[]]) => {
        if (cancelled) return;
        setOrders(o);
        setFavorites(f);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError('Could not load your orders.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canRead]);

  function setField<K extends keyof CoffeeDrinkConfig>(
    key: K,
    value: CoffeeDrinkConfig[K]
  ) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function adjustPump(key: 'vanillaPumps' | 'caramelPumps', delta: number) {
    setConfig((prev) => {
      const next = Math.min(MAX_PUMPS, Math.max(0, prev[key] + delta));
      return { ...prev, [key]: next };
    });
  }

  async function placeOrder(dto: CreateCoffeeOrderDto) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/coffee-order/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const created = (await res.json()) as CoffeeOrder;
      setOrders((prev) => [created, ...prev]);
      setPlaced(created);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to place order.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    placeOrder({
      ...config,
      deliveryType: deliveryNow ? 'now' : 'scheduled',
      ...(deliveryNow ? {} : { scheduledAt: new Date(scheduledAt).toISOString() }),
    });
  }

  async function saveFavorite() {
    const name = window.prompt('Name this favorite (e.g. "Morning"):');
    if (!name || !name.trim()) return;
    setError(null);
    try {
      const res = await fetch('/api/coffee-order/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, name: name.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const created = (await res.json()) as CoffeeFavorite;
      setFavorites((prev) => [created, ...prev]);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save favorite.');
    }
  }

  function configFromFavorite(f: CoffeeFavorite): CoffeeDrinkConfig {
    return {
      drink: f.drink,
      milk: f.milk,
      sugar: f.sugar,
      vanillaPumps: f.vanillaPumps,
      caramelPumps: f.caramelPumps,
      notes: f.notes,
    };
  }

  function loadFavorite(f: CoffeeFavorite) {
    setConfig(configFromFavorite(f));
    setPlaced(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function orderFavoriteNow(f: CoffeeFavorite) {
    placeOrder({ ...configFromFavorite(f), deliveryType: 'now' });
  }

  async function deleteFavorite(id: string) {
    try {
      const res = await fetch(`/api/coffee-order/favorites/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setFavorites((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error(err);
      setError('Failed to delete favorite.');
    }
  }

  async function deleteOrder(id: string) {
    try {
      const res = await fetch(`/api/coffee-order/orders/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      if (placed?.id === id) setPlaced(null);
    } catch (err) {
      console.error(err);
      setError('Failed to cancel order.');
    }
  }

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [orders]
  );

  // Blank wrapper while loading / before the redirect for a no-permission user.
  if (
    status === 'loading' ||
    !session?.user ||
    !hasPermission(session, 'coffee-order')
  ) {
    return <div className="coffee-page-blank" />;
  }

  return (
    <div>
      <Navbar />
      <div className="coffee-page">
        <div className="coffee-container">
          <header className="coffee-hero">
            <p className="coffee-hero-overline">— freshly brewed —</p>
            <h1 className="coffee-hero-title">☕ Coffee Order</h1>
          </header>

          <div className="coffee-grid">
            {/* ---- order form ---- */}
            <form className="coffee-card coffee-form-card" onSubmit={handleSubmit}>
              <h2 className="coffee-section-title">Your drink</h2>

              <div className="coffee-field">
                <label>Type</label>
                <div className="coffee-segmented">
                  {COFFEE_DRINKS.map((d) => (
                    <button
                      type="button"
                      key={d.id}
                      className={`coffee-seg-btn ${config.drink === d.id ? 'active' : ''}`}
                      onClick={() => setField('drink', d.id)}
                      aria-pressed={config.drink === d.id}
                    >
                      {d.emoji && <span className="emoji">{d.emoji}</span>}
                      <span>{d.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="coffee-field">
                <label>Milk</label>
                <div className="coffee-segmented">
                  {COFFEE_MILKS.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      className={`coffee-seg-btn ${config.milk === m.id ? 'active' : ''}`}
                      onClick={() => setField('milk', m.id)}
                      aria-pressed={config.milk === m.id}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="coffee-row">
                <div className="coffee-field">
                  <label htmlFor="coffee-sugar">Sugar</label>
                  <select
                    id="coffee-sugar"
                    value={config.sugar}
                    onChange={(e) =>
                      setField('sugar', e.target.value as CoffeeSugar)
                    }
                  >
                    {COFFEE_SUGARS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="coffee-row">
                <div className="coffee-field">
                  <label>Vanilla pumps</label>
                  <div className="coffee-stepper">
                    <button
                      type="button"
                      onClick={() => adjustPump('vanillaPumps', -1)}
                      aria-label="Less vanilla"
                    >
                      −
                    </button>
                    <span>{config.vanillaPumps}</span>
                    <button
                      type="button"
                      onClick={() => adjustPump('vanillaPumps', 1)}
                      aria-label="More vanilla"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="coffee-field">
                  <label>Caramel pumps</label>
                  <div className="coffee-stepper">
                    <button
                      type="button"
                      onClick={() => adjustPump('caramelPumps', -1)}
                      aria-label="Less caramel"
                    >
                      −
                    </button>
                    <span>{config.caramelPumps}</span>
                    <button
                      type="button"
                      onClick={() => adjustPump('caramelPumps', 1)}
                      aria-label="More caramel"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="coffee-field">
                <label htmlFor="coffee-notes">Notes</label>
                <textarea
                  id="coffee-notes"
                  value={config.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  placeholder="Extra hot, oat foam, …"
                  rows={2}
                  maxLength={500}
                />
              </div>

              <h2 className="coffee-section-title">When</h2>
              <div className="coffee-segmented coffee-when">
                <button
                  type="button"
                  className={`coffee-seg-btn ${deliveryNow ? 'active' : ''}`}
                  onClick={() => setDeliveryNow(true)}
                  aria-pressed={deliveryNow}
                >
                  Now
                </button>
                <button
                  type="button"
                  className={`coffee-seg-btn ${!deliveryNow ? 'active' : ''}`}
                  onClick={() => setDeliveryNow(false)}
                  aria-pressed={!deliveryNow}
                >
                  Later
                </button>
              </div>
              {!deliveryNow && (
                <div className="coffee-field">
                  <label htmlFor="coffee-when">Scheduled time</label>
                  <input
                    id="coffee-when"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required
                  />
                </div>
              )}

              {error && <div className="coffee-error">{error}</div>}

              <div className="coffee-form-actions">
                <button
                  type="button"
                  className="coffee-btn-secondary"
                  onClick={saveFavorite}
                >
                  ★ Save as favorite
                </button>
                <button
                  type="submit"
                  className="coffee-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Sending…' : 'Order'}
                </button>
              </div>

              {placed && (
                <div className="coffee-result">
                  <h3>Order placed ☕</h3>
                  <p>
                    {drinkSummary(placed)}
                    {' · '}
                    {placed.deliveryType === 'scheduled' && placed.scheduledAt
                      ? formatWhen(placed.scheduledAt)
                      : 'now'}
                  </p>
                </div>
              )}
            </form>

            {/* ---- favorites + history ---- */}
            <aside className="coffee-side">
              <div className="coffee-card">
                <h2 className="coffee-section-title">★ Favorites</h2>
                {favorites.length === 0 ? (
                  <p className="coffee-empty">
                    No favorites yet — build a drink and tap “Save as favorite”.
                  </p>
                ) : (
                  <div className="coffee-fav-list">
                    {favorites.map((f) => (
                      <article key={f.id} className="coffee-fav-card">
                        <button
                          type="button"
                          className="coffee-fav-body"
                          onClick={() => loadFavorite(f)}
                          title="Load into form"
                        >
                          <span className="coffee-fav-name">{f.name}</span>
                          <span className="coffee-fav-summary">
                            {drinkSummary(f)}
                          </span>
                        </button>
                        <div className="coffee-fav-actions">
                          <button
                            type="button"
                            className="coffee-quick-btn"
                            onClick={() => orderFavoriteNow(f)}
                            disabled={submitting}
                          >
                            ⚡ Order now
                          </button>
                          <button
                            type="button"
                            className="coffee-delete"
                            onClick={() => deleteFavorite(f.id)}
                            aria-label="Delete favorite"
                          >
                            ✕
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="coffee-card">
                <h2 className="coffee-section-title">Recent orders</h2>
                {loading ? (
                  <p className="coffee-empty">Loading…</p>
                ) : sortedOrders.length === 0 ? (
                  <p className="coffee-empty">No orders yet.</p>
                ) : (
                  <div className="coffee-order-list">
                    {sortedOrders.map((o) => (
                      <article key={o.id} className="coffee-order-card">
                        <div className="coffee-order-main">
                          <span className="coffee-order-summary">
                            {drinkSummary(o)}
                          </span>
                          <span className="coffee-order-when">
                            {o.deliveryType === 'scheduled' && o.scheduledAt
                              ? `⏰ ${formatWhen(o.scheduledAt)}`
                              : `now · ${formatWhen(o.createdAt)}`}
                          </span>
                          {o.notes && (
                            <span className="coffee-order-notes">“{o.notes}”</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="coffee-delete"
                          onClick={() => deleteOrder(o.id)}
                          aria-label="Cancel order"
                        >
                          ✕
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify types + lint, then build**

Run: `npx tsc --noEmit --incremental false --pretty false && npm run lint && npm run build`
Expected: clean tsc/lint; build emits a `/coffee-order` route in the route table. (If the Next cache wedges, `rm -rf .next` and rebuild.)

- [ ] **Step 5: Commit**

```bash
git add src/app/coffee-order
git commit -m "feat(coffee-order): order page, layout, and styles"
```

---

### Task 6: Wire into navigation, home grid, and middleware

**Files:**
- Modify: `src/middleware.ts` (`GATES` ~line 31, `matcher` ~line 78)
- Modify: `src/app/page.tsx` (react-icons import ~line 8, `allFeatures` ~line 30)
- Modify: `src/components/Navbar.tsx` (react-icons import ~line 7, `allNavItems` ~line 41)

**Interfaces:**
- Consumes: the `coffee-order` permission key (Task 1) and the `/coffee-order` route (Task 5).
- Produces: nothing other tasks consume — this is the final wiring.

- [ ] **Step 1: Add the middleware gate + matcher entry in `src/middleware.ts`**

In the `GATES` array, replace:
```ts
  { pattern: /^\/mekafkefim(?:\/|$)/,        permission: 'mekafkefim'  },
  { pattern: /^\/instomit(?:\/|$)/,          permission: 'instomit'    },
```
with:
```ts
  { pattern: /^\/mekafkefim(?:\/|$)/,        permission: 'mekafkefim'  },
  { pattern: /^\/coffee-order(?:\/|$)/,      permission: 'coffee-order' },
  { pattern: /^\/instomit(?:\/|$)/,          permission: 'instomit'    },
```

In the `config.matcher` array, replace:
```ts
    '/mekafkefim/:path*',
    '/instomit/:path*',
```
with:
```ts
    '/mekafkefim/:path*',
    '/coffee-order/:path*',
    '/instomit/:path*',
```

- [ ] **Step 2: Add `FaMugHot` + the home feature card in `src/app/page.tsx`**

Replace the import line:
```ts
import { FaDog, FaCoffee, FaVideo, FaDumbbell, FaRing, FaPlane, FaSpa, FaHeart, FaSignInAlt } from 'react-icons/fa';
```
with:
```ts
import { FaDog, FaCoffee, FaMugHot, FaVideo, FaDumbbell, FaRing, FaPlane, FaSpa, FaHeart, FaSignInAlt } from 'react-icons/fa';
```

In `allFeatures`, replace the Mekafkefim line:
```ts
  { icon: FaCoffee,   title: 'מקפקפים',           description: 'ביקורות על קפה מאת תומית ותומרינדי',  href: '/mekafkefim',               linkText: 'צפה במקפקפים',       permission: 'mekafkefim'  },
```
with (Mekafkefim line unchanged, new Coffee Order line added directly after):
```ts
  { icon: FaCoffee,   title: 'מקפקפים',           description: 'ביקורות על קפה מאת תומית ותומרינדי',  href: '/mekafkefim',               linkText: 'צפה במקפקפים',       permission: 'mekafkefim'  },
  { icon: FaMugHot,   title: 'הזמנת קפה',         description: 'הזמינו קפה — עכשיו או לעתיד',          href: '/coffee-order',             linkText: 'להזמנת קפה',         permission: 'coffee-order' },
```

- [ ] **Step 3: Add `FaMugHot` + the navbar item in `src/components/Navbar.tsx`**

In the `react-icons/fa` import block, replace:
```ts
  FaDog,
  FaCoffee,
  FaVideo,
```
with:
```ts
  FaDog,
  FaCoffee,
  FaMugHot,
  FaVideo,
```

In `allNavItems`, replace the Mekafkefim line:
```ts
  { href: '/mekafkefim',               label: 'מקפקפים',       icon: FaCoffee,     visibility: { permission: 'mekafkefim'  } },
```
with (Mekafkefim line unchanged, new Coffee Order line added directly after):
```ts
  { href: '/mekafkefim',               label: 'מקפקפים',       icon: FaCoffee,     visibility: { permission: 'mekafkefim'  } },
  { href: '/coffee-order',             label: 'הזמנת קפה',     icon: FaMugHot,     visibility: { permission: 'coffee-order' } },
```

- [ ] **Step 4: Verify types + lint, then build**

Run: `npx tsc --noEmit --incremental false --pretty false && npm run lint && npm run build`
Expected: clean; `/coffee-order` still present in the route table; no unused-import warnings for `FaMugHot`.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/app/page.tsx src/components/Navbar.tsx
git commit -m "feat(coffee-order): wire route into middleware, home grid, and navbar"
```

---

### Task 7: Manual verification + open PR

**Files:** none (verification + delivery).

- [ ] **Step 1: Run the dev server and smoke-test**

Run: `npm run dev` (needs a populated `.env.local` — `MONGODB_URI`, Auth.js Google vars). Then, signed in as **an owner** (`levtomer66@gmail.com`):
- `/coffee-order` renders the form + empty favorites/history.
- Place a "Now" order → it appears at the top of Recent orders; an ntfy push lands on topic `hatomim_coffee` (subscribe at `https://ntfy.sh/hatomim_coffee` to watch).
- Place a "Later" order → shows the scheduled time with a ⏰.
- Save a favorite → it appears under Favorites; **⚡ Order now** places it instantly; tapping the card body loads it into the form; ✕ deletes it.
- Cancel an order with ✕ → it disappears.

- [ ] **Step 2: Verify the gate (no-permission path)**

With a signed-in **non-owner who lacks the grant**: confirm `/coffee-order` 307-redirects to `/`, and neither the home card nor the navbar item appears. Then, as an owner at `/admin/allowlist`, toggle **Coffee Order** on for that user, wait for the ~10-min token TTL (or sign out/in), and confirm the card, navbar item, and route access all appear. (If you can't test a second account, at minimum confirm the **Coffee Order** toggle is present in the `/admin/allowlist` matrix.)

- [ ] **Step 3: Push the branch and open the PR (no Vercel operations)**

```bash
git push -u origin feat/coffee-order
gh pr create --base main --head feat/coffee-order \
  --title "feat(coffee-order): permission-gated coffee ordering page" \
  --body "$(cat <<'EOF'
## Summary
Adds a permission-gated `/coffee-order` SPA page modeled on `/spa`: compose a
coffee (drink / milk / sugar / vanilla + caramel pumps / notes), order it now or
schedule it, and save favorites for one-tap reordering. Placing an order fires an
ntfy.sh push (topic `hatomim_coffee`) and saves to per-user history.

Gated by a new `coffee-order` permission key — hidden by default; an owner grants
it from `/admin/allowlist`. Wired into middleware, the home grid, and the navbar.

Spec: `docs/superpowers/specs/2026-06-24-coffee-order-design.md`
Plan: `docs/superpowers/plans/2026-06-24-coffee-order.md`

## Test plan
- tsc + lint + build pass.
- Manual: place now/later orders, save/load/quick-order favorites, cancel orders.
- Gate: route + card + navbar hidden without the grant; visible after granting in /admin/allowlist.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Milk None/Regular/Soy/Lactose-free/Oat → Task 1 `COFFEE_MILKS`. ✅
- Drink Espresso/Lungo/Cappuccino → Task 1 `COFFEE_DRINKS`. ✅
- Sugar (default none) + vanilla/caramel `−/+` steppers (default 0) + notes → Task 1 types, Task 5 controls. ✅
- Delivery now / future datetime → Task 3 validation, Task 5 Now/Later toggle + `datetime-local`. ✅
- Save favorites for quick reorder → Tasks 2/4 (favorites model + API), Task 5 (save / load / ⚡ order now). ✅
- ntfy push like Spa → Task 3 `notifyCoffeeOrder`. ✅
- Permission-gated, no default visibility → Task 1 key, Task 6 middleware + home + navbar, Task 5 client redirect. ✅
- Per-user history → Task 2 `getCoffeeOrdersForUser` (filters by `userEmail`), Task 3 GET. ✅
- PR to origin, no Vercel → Task 7. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete file content or an exact replace block. ✅

**Type consistency:** `CoffeeOrder`/`CoffeeFavorite` both `extends CoffeeDrinkConfig`, so `drinkSummary(order)` and `drinkSummary(favorite)` typecheck. Model signatures (`getCoffeeOrdersForUser`, `createCoffeeOrder(Omit<…,'id'|'createdAt'>)`, `deleteCoffeeOrder(id, email, isOwner)`) match their call sites in Tasks 3–4. `setField(key, value)` is generic over `keyof CoffeeDrinkConfig`; `d.id`/`m.id` are already the literal union types (no cast); only the `<select>` casts `e.target.value as CoffeeSugar`. Permission key string `'coffee-order'` is identical across permissions.ts, middleware, home, navbar, page, and all four route handlers. ✅
