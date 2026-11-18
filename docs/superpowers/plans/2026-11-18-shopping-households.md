# Shopping households Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each family has its own household (My items, list, favorites, trips); people join by an accepted email invite, and today's household becomes the owners'.

**Architecture:** `shoppingHome` docs become households with `members` and `invites`. Pure rules in `src/lib/shopping/household.ts` carry the logic and the tests; the model resolves the caller's household (`householdFor`) and every shopping route and MCP tool goes through it. A `/household` route and a "משק הבית" sheet manage invites.

**Tech Stack:** Next.js 15 App Router, MongoDB native driver, `node --test` for import-free modules.

**Spec:** `docs/superpowers/specs/2026-11-18-shopping-households-design.md`

## Global Constraints

- `MAX_MEMBERS = 10`, `MAX_INVITES = 10`; emails stored lowercase.
- Today's household keeps `_id: 'home'`; its `members` start as `OWNER_EMAILS` (set once, guarded by `members: { $exists: false }`).
- A person is in exactly one household (unique multikey index on `members`); someone with `shopping` and no household gets an empty one on first request.
- An invite needs the invitee to have `shopping` (owner, or allowlist `allowedPages` includes `shopping`); else 400 "אין לכתובת הזו גישה לקניות".
- Accept never leaves the caller in no household; no one removes another member.
- Copy: card "‹name› הזמין/ה אותך למשק הבית שלו/ה" · "הצטרפות" · "לא תודה"; warning "המוצרים והרשימה שלך (N) יימחקו"; sheet title "משק הבית", "+ הזמנה במייל", "ביטול", "עזיבת משק הבית".
- Tested modules stay import-free (relative `.ts` imports only). Node by absolute path `/opt/homebrew/bin/node`; build with `MONGODB_URI=mongodb://127.0.0.1:27018/hatom-shopping-test`.
- Commits end with the session's `Co-Authored-By` trailer; push only when the owner says so.

## Review Focus

- Two first requests from a new user at once → one household (duplicate-key retry) → Task 2 verification step runs two parallel GETs.
- Accept when the target household filled up or withdrew the invite between steps → caller is back in a household, 409 → Task 4 verification cancels the invite mid-flow.
- A route still reading `_id: 'home'` directly → Task 3 ends with a grep that must return nothing outside the model.
- Inviting yourself or a current member → 409 from `canInvite` → Task 1 test.
- A trip of another household opened by id → 404 → Task 6 browser check.

---

### Task 1: Pure household rules

**Files:**
- Create: `src/lib/shopping/household.ts`
- Test: `src/lib/__tests__/shopping-household.test.ts`

**Interfaces:**
- Produces: `MAX_MEMBERS`, `MAX_INVITES`; `interface Invite { email: string; by: string; at: string }`; `interface Household extends ShoppingHome { id: string; members: string[]; invites: Invite[] }`; `parseInviteEmail(v: unknown): Result<string>`; `canInvite(h: Pick<Household, 'members' | 'invites'>, email: string): Result<true>` (errors: "כבר במשק הבית", "כבר הוזמנ/ה", "אפשר עד 10 הזמנות", "אפשר עד 10 בני בית"); `acceptPlan(from: Pick<Household, 'members' | 'items' | 'list'>, email: string): { deleteFrom: boolean; loses: number }` (`loses` = items + list lines when deleted, else 0).

- [ ] **Step 1: Write the failing tests**

```ts
test('parseInviteEmail trims, lowercases and rejects non-emails', () => {
  assert.deepEqual(parseInviteEmail('  Dana@Example.COM '), { ok: true, value: 'dana@example.com' });
  assert.equal(parseInviteEmail('dana').ok, false);
  assert.equal(parseInviteEmail(42).ok, false);
});
test('canInvite refuses a member, a duplicate and the caps', () => {
  const h = { members: ['a@x.com'], invites: [{ email: 'b@x.com', by: 'a@x.com', at: 't' }] };
  assert.equal(canInvite(h, 'a@x.com').ok, false);
  assert.equal(canInvite(h, 'b@x.com').ok, false);
  assert.deepEqual(canInvite(h, 'c@x.com'), { ok: true, value: true });
  const full = { members: Array.from({ length: 10 }, (_, i) => `m${i}@x.com`), invites: [] };
  assert.equal(canInvite(full, 'c@x.com').ok, false);
});
test('acceptPlan deletes a household its only member leaves, counting what goes', () => {
  const line = { key: '1', name: 'x', qty: 1, w: false };
  assert.deepEqual(acceptPlan({ members: ['a@x.com'], items: [{ ...line, addedBy: '', addedAt: '' }], list: [line] }, 'a@x.com'), { deleteFrom: true, loses: 2 });
  assert.deepEqual(acceptPlan({ members: ['a@x.com', 'b@x.com'], items: [], list: [] }, 'a@x.com'), { deleteFrom: false, loses: 0 });
});
```

- [ ] **Step 2: Run** `/opt/homebrew/bin/node --test src/lib/__tests__/shopping-household.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** in `household.ts` (imports only `./home.ts` types). Email check: one `@`, a dot in the domain, no spaces, ≤ 200.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(shopping): household rules (invite, accept)`.

### Task 2: The model resolves the caller's household

**Files:**
- Modify: `src/models/ShoppingHome.ts`

**Interfaces:**
- Consumes: `Household`, `Invite` (Task 1).
- Produces: `householdFor(email: string): Promise<Household>`; writers keyed by id — `setHome(id, fields)`, `addLines(id, lines)`, `ensureMyItems(id, lines, by)`, `pullBought(id, ticked, notThere)`, `setList(id, list)`; `withMeta(h: Household)` returns `ShoppingHomeView = Household & { meta }`; `getHome()` and `HOME_ID` stop being exported.

- [ ] **Step 1: Implement.** Indexes once per process: `{ members: 1 }` unique, `{ 'invites.email': 1 }`. `householdFor`: run today's `getHome()` creation for `'home'` (old-list migration) and the owners backfill (`updateOne({ _id: 'home', members: { $exists: false } }, { $set: { members: OWNER_EMAILS, invites: [] } })`), then `findOne({ members: email })`; none → `insertOne` a new empty household with an ObjectId-hex `_id`; on duplicate key (11000) read again. `plain()` maps `_id` → `id` and defaults `invites ?? []`, `favStores ?? []`.
- [ ] **Step 2: Verify** with tsc (callers will fail to compile until Task 3 — run Task 3 before committing; commit them together if needed and record it).

### Task 3: Every caller uses the caller's household

**Files:**
- Modify: `src/app/api/shopping/{home,home/list,stores,here,trips}/route.ts`, `src/app/api/shopping/trips/[id]/route.ts`, `src/lib/shopping/mcp-tools.ts`, `src/lib/shopping/home.ts` (drop `HOME_LIST_ID`), `src/app/shopping/page.tsx`, `src/app/shopping/home-client.ts` (`HomeView` gains `id`)

**Interfaces:**
- Consumes: Task 2.
- Produces: GET/PATCH `/home` return `ShoppingHomeView` with `id`; trips use `listId = household.id`; `/trips/[id]` returns 404 unless `trip.listId === household.id`; `getRecentTicked([household.id])`; the page names its trip cache key by `home.id` and passes it to `tripSnapshot`.

- [ ] **Step 1: Implement.** Each route calls `householdFor(caller.userEmail)` once and passes `h.id` to writers. `mcp-tools.ts` `theList()` and the add/remove tools take the caller.
- [ ] **Step 2: Verify:** `grep -rnE "getHome\(|HOME_LIST_ID|'home'" src | grep -v __tests__` → only lines in `src/models/ShoppingHome.ts`. tsc 0, lint clean, `npm test` all pass. On :3300 (owner, Docker DB): `/home` returns `id: 'home'` with the same items/list/favStores as before; the open trip still loads.
- [ ] **Step 3: Commit** `feat(shopping): every route uses the caller's household` (with Task 2's model change).

### Task 4: Invite, accept, decline, cancel, leave

**Files:**
- Modify: `src/models/ShoppingHome.ts`
- Create: `src/app/api/shopping/household/route.ts`
- Modify: `src/lib/shopping/api-types.ts` (`HouseholdResponse`)

**Interfaces:**
- Consumes: Task 1 rules, Task 2 model, `getAuthorizedEmailEntry`, `isOwnerEmail`, `getUserDisplayName`.
- Produces: model `addInvite(id, invite)`, `cancelInvite(id, email)`, `incomingInvites(email): Promise<{ id: string; by: string; at: string }[]>`, `acceptInvite(email, toId): Promise<Household | null>` (null → 409), `declineInvite(email, toId)`, `leaveHousehold(email): Promise<Household | null>` (null when alone); `GET /household` → `HouseholdResponse = { id; members: { email; name }[]; invites: Invite[]; incoming: { id; by; byName; at; loses: number }[] }`; `POST /household` with one of `{ invite }`, `{ cancel }`, `{ accept }`, `{ decline }`, `{ leave: true }` → the fresh `HouseholdResponse`.

- [ ] **Step 1: Implement.** `acceptInvite`: (1) `findOneAndUpdate({ _id: toId, 'invites.email': email, 'members.9': { $exists: false } }, { $pull: { invites: { email } } })` — claims the invite; null → 409. (2) `$pull` the caller from their current household, deleting it when `acceptPlan(...).deleteFrom` (`deleteOne` guarded by `members: [email]`). (3) `$addToSet: { members: email }` on `toId`. If (3) fails, insert the caller into a new empty household and return null. `loses` in `incoming` comes from `acceptPlan` on the caller's current household.
- [ ] **Step 2: Verify** with two dev servers on the Docker DB (owner on :3300; a second `dev:local` on :3301 with `LOCAL_DEV_LOGIN_EMAIL=<test email>`, after adding that email to `authorizedEmails` with `allowedPages: ['shopping']` in the Docker DB): the test user's first GET creates its household (two parallel GETs → one doc); owner invites them → their GET shows `incoming` with `loses`; invite to an email without `shopping` → 400 with the copy; invite to self → 409; accept → their old household deleted, members `[owners…, test]`; cancel/decline remove invites; cancel an invite while the invitee accepts → 409 and the invitee still has a household; leave → a new empty household.
- [ ] **Step 3: Commit** `feat(shopping): household invites, accept and leave`.

### Task 5: The invite card and the "משק הבית" sheet

**Files:**
- Create: `src/app/shopping/Household.tsx` (`HouseholdSheet`, `InviteCard`)
- Modify: `src/app/shopping/Nutrition.tsx` (`SettingsMenu` gains an `extra?: ReactNode` slot for the "משק הבית" item), `src/app/shopping/page.tsx`, `src/app/shopping/shopping.css`

**Interfaces:**
- Consumes: Task 4 routes and `HouseholdResponse`.
- Produces: `InviteCard({ invite, onAnswer })`, `HouseholdSheet({ onClose, onChanged })`; the page loads `GET /household` with the home, shows `InviteCard` per `incoming` above the search, and calls `refreshHome()` after accept/leave.

- [ ] **Step 1: Implement** with the Global Constraints copy. Leave asks `confirm('לעזוב את משק הבית? המוצרים והרשימה נשארים לשאר בני הבית.')`. Errors show the server's text in the sheet's one-line error.
- [ ] **Step 2: Verify** in the browser at 375 px, light and dark, with both servers: the card appears for the test user, with the warning when they have items; accept shows the owners' list; the sheet lists members and pending invites; cancel works; leave hides when alone.
- [ ] **Step 3: Commit** `feat(shopping): משק הבית — invite card and household sheet`.

### Task 6: Cross-household check, docs, cleanup

**Files:**
- Modify: `CLAUDE.md` (shopping section: households), `docs/shopping-api.md` (`/household`, household-scoped routes)

- [ ] **Step 1: Verify:** the test user, in their own household, opens the owners' open trip id via `GET /api/shopping/trips/<id>` → 404; `/home` shows only their data. Then remove the test email from the Docker `authorizedEmails` and delete its household; the `home` doc keeps the owners and its data.
- [ ] **Step 2: Write** the doc changes.
- [ ] **Step 3: Run** `npm test`, tsc, `npm run lint`, the build (Docker URI) → all pass.
- [ ] **Step 4: Commit** `docs(shopping): households`.
