# Shopping: households

Status: approved design, 2026-11-18. Branch `claude/shopping-home` → PR #10.

## Goal

Today one fixed `shoppingHome` doc (`_id: 'home'`) holds My items, the list,
the favorite stores and (through `listId: 'home'`) the trips of everyone
with the `shopping` permission. Make households real so other families can
use /shopping with their own data, without changing anything for the
current household.

## What the owner decided

- **Households are for separate families; a person belongs to exactly one.**
- **A member adds someone by email**, and the person **must accept**: an
  add is an invite, shown on their next visit.
- **Someone with `shopping` access and no household gets their own, empty,
  on first visit.** Search and prices work at once.
- **Today's household keeps its data and starts with the two owners**
  (`OWNER_EMAILS`). Anyone else with `shopping` gets an empty household on
  their next visit and can be invited in.

## Data

`shoppingHome` stays the collection; each doc is one household:

```ts
interface Household {
  _id: string;            // 'home' for today's, new ones: ObjectId hex
  members: string[];      // lowercase emails, 1..MAX_MEMBERS
  invites: { email: string; by: string; at: string }[]; // ≤ MAX_INVITES
  items: MyItem[]; list: ListLine[]; favStores: number[]; updatedAt: string;
}
```

- `MAX_MEMBERS = 10`, `MAX_INVITES = 10`.
- Indexes: unique multikey on `members` (one household per person, enforced
  by Mongo), multikey on `invites.email` (an invitee's pending invites).
- **Migration on read:** if the `home` doc has no `members`, set
  `members: OWNER_EMAILS, invites: []` (one atomic update guarded by
  `members: { $exists: false }`). Nothing is copied; open trips with
  `listId: 'home'` keep working because the household id is `'home'`.
- `ShoppingHome.ts` keeps the read model; `HOME_LIST_ID` goes away in
  favour of the household's `_id`.

## Which household

- `householdFor(email): Promise<Household>` (model) replaces `getHome()`:
  find `{ members: email }`; none → insert `{ members: [email], invites: [],
  items: [], list: [], favStores: [] }`. A duplicate-key race (two first
  requests) re-reads instead of failing.
- Every caller uses it with the caller's email: `/home`, `/home/list`,
  `/stores` (favorites), `/here` (My items, recent trips), `/trips`
  (open trip, start: `listId = household._id`), `/trips/[id]` (the trip must
  have `listId === household._id`, else 404 — same as unknown), and
  `mcp-tools.ts` (`caller.userEmail`).
- Writers (`setHome`, `addLines`, `ensureMyItems`, `pullBought`) take the
  household id.
- Per-user settings (`ShoppingUserSettings`) and typed shop prices
  (`ShoppingManualPrice`, per store) are unchanged.

## Invites

Pure rules in `src/lib/shopping/household.ts` (import-free, unit-tested):

- `parseInviteEmail(v)`: trimmed, lowercased, a plausible email, ≤ 200.
- `canInvite(h, email, inviter)`: not already a member, not already invited
  here, `h.invites.length < MAX_INVITES`, `h.members.length < MAX_MEMBERS`.
- `acceptPlan(from, to, email)`: `{ deleteFrom: boolean, loses: { items, list } }`
  — `from` is deleted when `email` is its only member; `loses` counts what
  goes with it (for the warning).

Routes (`/api/shopping/household`):

- `GET` → `{ id, members: { email, name }[], invites: { email, by, at }[],
  incoming: { id, by, byName, at }[] }` (`incoming` = invites to the caller
  from other households). Names via `getUserDisplayName`.
- `POST { invite: email }` — the email must have `shopping` access (an owner,
  or an allowlist entry whose `allowedPages` includes `shopping`);
  400 "אין לכתובת הזו גישה לקניות" otherwise; 409 for `canInvite` failures.
- `POST { cancel: email }` — remove a pending invite (any member).
- `POST { accept: householdId }` / `{ decline: householdId }` — the caller
  answers an invite. Accept, in one transaction-free sequence guarded by
  filters: `$pull` the caller from their current household (delete it when
  `acceptPlan.deleteFrom`), `$addToSet` into the new one and `$pull` the
  invite there (filter: the invite still exists and members < MAX). If the
  second step fails, put the caller back (or recreate their empty
  household) and return 409.
- `POST { leave: true }` — only when the household has other members:
  `$pull` the caller and give them a new empty household.
- No one removes another member.

## UI

- **Incoming invite card** at the top of /shopping (above the search):
  "‹name› הזמין/ה אותך למשק הבית שלו/ה" · "הצטרפות" · "לא תודה". When
  `acceptPlan` says the caller's household would be deleted with items:
  "המוצרים והרשימה שלך (N) יימחקו" under it. After accepting, the page
  reloads its home data.
- **"משק הבית" in the ⚙ menu** opens a sheet: members (name, email), pending
  invites with "ביטול", "+ הזמנה במייל" (an email field), and "עזיבת משק
  הבית" (hidden when the caller is the only member; confirms first).
- Errors show as the sheet's one-line error; the cap/duplicate/no-access
  messages are the server's text.

## Not in this spec

- Removing another member, household names, more than one household per
  person, moving data between households.
- Admin tooling on /admin/allowlist (the owners use the same sheet).

## Testing

- `node --test`: `parseInviteEmail`, `canInvite` (member, duplicate, caps),
  `acceptPlan` (alone → delete with counts; with others → keep).
- Browser against Docker Mongo with two dev users: the usual `dev:local`
  server (an owner) and a second one on another port started with
  `LOCAL_DEV_LOGIN_EMAIL=<test email>` (an allowlist entry with `shopping`
  added to the Docker DB for the test and removed after): first visit creates an empty household; invite → card →
  accept (old one deleted, data now shared) → leave → new empty household;
  decline; cancel; a trip id from another household → 404; the `home`
  doc migrated with the owners and its data intact.

## Review focus

- The unique `members` index and the first-visit insert racing.
- Accept failing half way (caller pulled, add refused): the caller must
  never end up in no household.
- Every shopping route and MCP tool goes through `householdFor` — none still
  reads `_id: 'home'` directly.
- An invite to an email without `shopping`, or to oneself.
- Trips: `listId` of a new household's trip, and `/trips/[id]` from another
  household.
