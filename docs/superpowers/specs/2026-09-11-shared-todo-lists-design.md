# Shared ToDo Lists (`/todo`) — Design

**Date:** 2026-09-11
**Status:** Approved

## Goal

A new feature at `/todo`: **shared** to-do lists that look like the paper
"Things To Do" notepad in the reference photo — a colourful bordered notepad
where each task is a line of handwriting with a checkbox at the end.

Members are other accounts on the app. A user creates a list, picks which
members belong to it, and anyone in the list can add tasks, assign them, and
check them off. The page stays visually clean: **only text and checkmarks**,
with the decorative notepad border faithfully reproduced from the photo.

## Decisions (locked with the user)

1. **Collaborative editing.** Every member of a list can add / edit / complete /
   assign / delete any task, and rename or renew the list. Only the **creator**
   manages membership (add/remove members) and can delete the whole list.
2. **Renew archives history.** "Renew list" snapshots *all* current tasks into a
   `todoArchives` document, then deletes the done tasks and keeps the rest. Past
   renewals are browsable per list. Nothing is lost.
3. **100% faithful notepad visual.** Rainbow diagonal-striped top & bottom
   borders, teal chevron side columns, a handwriting "Things To Do" title, white
   ruled content lines each ending in a checkbox square. Handwriting font is
   **Caveat** via `next/font/google` (self-hosted — no CSP change).
4. **Line density = initials + faint due date.** Each line shows: checkbox ·
   task text (handwriting) · small coloured assignee initial(s) · faint due date
   at the end (**red if overdue**). Strike-through when done. Everything else
   (description, full assignee list, delete) lives in the task modal.
5. **Tasks are their own documents**, not an embedded array on the list. Multiple
   members edit the same list concurrently; per-task documents let two people
   edit different tasks without the whole-array `$set` races an embedded model
   would suffer. (Embedded array considered and rejected for that reason.)
6. **Identity = signed-in Google account**, exactly like `/workout`: `UserId` is
   the session email, display via `getUserDisplayName(email)`. Any client-supplied
   identity is ignored; the server derives it from the Auth.js session.

## Included extras (agreed)

- **"My tasks" view** on `/todo`: every task assigned to me across all my lists,
  ordered by due date.
- **Refresh on focus + light polling** so members see each other's changes
  without a manual reload.
- **Optimistic checkbox** — completing/uncompleting feels instant, reconciled
  against the server response.
- **Overdue red** — folded into the line design (decision 4).
- **ntfy.sh topic push** — each list has a server-stored random `notifyTopic`;
  publishing a task assignment posts to it. Members subscribe once via the ntfy
  app (link/QR surfaced on the list). Scheduled "due today" pushes need a cron
  the repo doesn't have yet — out of MVP scope, noted as follow-up; due-today is
  surfaced client-side on load instead.
- **Quick-add parsing** — the add-task input parses `@name` (assignee) and
  `!date` (due date) tokens and strips them from the text, e.g.
  `Buy milk @tomer !friday`.

## Architecture

Standard repo feature shape (mirrors `/mekafkefim` + `/workout`):

- **Types + pure helpers** — `src/types/todo.ts` (import-free public types/DTOs)
  and `src/lib/todo-*.ts` pure modules (quick-add parser, sort comparator,
  overdue/date helpers), each unit-tested with `node --test` via relative `.ts`
  imports (mirrors `src/lib/__tests__/coffee-score.test.ts`).
- **Model** — `src/models/Todo.ts`, native MongoDB driver (`clientPromise`,
  `id↔_id` mapping, ISO-string timestamps, free `get*/create*/update*/delete*`
  helpers). Three collections: `todoLists`, `todoTasks`, `todoArchives`.
- **API** — App Router route handlers under `src/app/api/todo/…`, every mutating
  verb gated by `requirePagePermission('todo')` then a per-list membership check.
- **Pages** — `src/app/todo/{layout.tsx, page.tsx, todo.css, icon.svg}` +
  `src/app/todo/[listId]/page.tsx`. Layout sets metadata and imports `todo.css`;
  pages are `'use client'` with `useSession()` + `hasPermission(session,'todo')`.
- **Registry** — add the `todo` permission to the four coupled files:
  `src/types/permissions.ts`, `src/app/page.tsx`, `src/components/Navbar.tsx`,
  `src/middleware.ts` (both `GATES` and `config.matcher`).

### Access model

One permission, `todo`, gates the whole feature ("can use ToDo at all"); owners
get it automatically, allowlisted users get it via the `/admin/allowlist` matrix.
Within the feature, **list membership** — not a second permission — governs who
can edit a given list. So there is no `todo:write`: collaboration is per-list.

## Data model

### `todoLists`
```
{
  _id,
  name: string,
  createdBy: string,          // email
  members: string[],          // emails, always includes createdBy
  sortBy: 'created' | 'dueDate' | 'assignee',   // persisted per-list, default 'created'
  notifyTopic: string,        // random, unguessable; ntfy.sh topic for this list
  createdAt: string,          // ISO
  updatedAt: string,
}
```

### `todoTasks`
```
{
  _id,
  listId: string,
  text: string,
  description?: string,
  assignees: string[],        // emails, subset of the list's members
  dueDate?: string,           // 'YYYY-MM-DD' (bare local date; parse with parseLocalDate, never new Date(str))
  done: boolean,
  doneAt?: string,            // ISO, set when done flips true
  doneBy?: string,            // email
  createdBy: string,          // email
  createdAt: string,          // ISO — the 'created' sort key
  updatedAt: string,
}
```

### `todoArchives`
```
{
  _id,
  listId: string,
  name: string,               // list name at renewal time
  renewedAt: string,          // ISO
  renewedBy: string,          // email
  tasks: ArchivedTask[],      // full snapshot of every task at renewal (done + open)
}
```

## API routes

All under `src/app/api/todo/`. Every handler starts with
`const gate = await requirePagePermission('todo'); if (gate instanceof NextResponse) return gate;`
then, for a specific list, loads the list and 404s if
`!list.members.includes(gate.session.user.email)`. Membership mutations and list
deletion additionally require `list.createdBy === email`.

| Method + path | Purpose |
|---|---|
| `GET /api/todo/lists` | Lists where I'm a member (index cards). |
| `POST /api/todo/lists` | Create `{ name, members }`; creator auto-added; generates `notifyTopic`. |
| `GET /api/todo/lists/[id]` | One list **plus its tasks** (one round-trip) + `archiveCount`. |
| `PATCH /api/todo/lists/[id]` | Update `name` / `sortBy` (any member); `members` (creator only). |
| `DELETE /api/todo/lists/[id]` | Delete list + its tasks + its archives (creator only). |
| `POST /api/todo/lists/[id]/renew` | Snapshot all tasks → `todoArchives`; delete done tasks. |
| `GET /api/todo/lists/[id]/archives` | Renewal history for the list. |
| `POST /api/todo/lists/[id]/tasks` | Create a task `{ text, assignees?, dueDate?, description? }`. |
| `PATCH /api/todo/lists/[id]/tasks/[taskId]` | Update any field incl. `done` (assignees must be current members). |
| `DELETE /api/todo/lists/[id]/tasks/[taskId]` | Delete a task. |
| `GET /api/todo/members` | Allowlisted users `{ email, name }[]` for the member/assignee picker (signed-in; the existing `/api/admin/allowlist` is owner-only, so this is a new slim, non-owner endpoint). |

Assignment push: when a `PATCH`/`POST` adds an assignee, the route fires a
best-effort `fetch('https://ntfy.sh/<notifyTopic>', …)` server-side (failure is
logged, never blocks the response). Server-side fetch, so browser CSP doesn't
apply; `connect-src` already lists `https://ntfy.sh` anyway.

## Pure helpers (unit-tested)

- `src/lib/todo-quickadd.ts` — `parseQuickAdd(raw, members): { text, assignees, dueDate? }`.
  `@token` → match a member by display-name / email local-part (case-insensitive
  prefix; unambiguous match only). `!token` → `today`, `tomorrow`, weekday names
  (next occurrence), and ISO `YYYY-MM-DD`. Unmatched tokens stay as literal text.
- `src/lib/todo-sort.ts` — `sortTasks(tasks, sortBy)`: `created` (createdAt asc),
  `dueDate` (asc, undated last), `assignee` (group by first assignee's display
  name, then createdAt). Done tasks always sink to the bottom, preserving order.
- `src/lib/todo-date.ts` — `parseLocalDate` / `isOverdue(dueDate, today)` /
  `formatDueLabel` (short, e.g. "Fri", "Sep 20", "Overdue"). Reuse the
  `parseLocalDate` approach from the workout weeks helper — never `new Date(str)`.

## UI

### `/todo` index
Grid of colourful mini-notepad cards (name, member initials, open-task count,
progress). **New list** opens a modal: name + member multi-select fed by
`GET /api/todo/members`. A **"My tasks"** panel/toggle lists my assigned tasks
across lists by due date, each linking into its list.

### `/todo/[listId]` — the notepad
Faithful reproduction of the photo, built in `todo.css` with CSS gradients +
a small repeating SVG for the chevrons (no images):

- Rainbow diagonal-striped top & bottom borders (`repeating-linear-gradient(45deg,…)`).
- Teal chevron side columns.
- Handwriting **"Things To Do"** title (Caveat) + editable list name.
- Ruled content lines; each task line = checkbox (at the line's *end*, RTL-aware)
  · text · assignee initial chip(s) · faint due date (red if overdue) ·
  strike-through when `done`.
- Bottom **add-task input** (handwriting placeholder); Enter adds. Runs
  `parseQuickAdd` so `@`/`!` tokens set assignee/due.
- **Sort** control (created / due / assignee) — persists via `PATCH … sortBy`.
- **Renew** button (confirm) and a **history** affordance (opens archived snapshots).
- Click a task → **modal**: assignee multi-select (list members), due date,
  description, mark done, delete. All optional.

Hebrew note: Caveat is Latin-only, so Hebrew task text falls back to the site
font (Rubik). Accepted limitation — the decorative chrome ("Things To Do", the
border) is Latin and stays in handwriting.

Data freshness: refetch on window focus + a light interval poll while a list is
open. Checkbox toggles are optimistic, reconciled against the server response.

## Testing

`node --test` unit tests (no path aliases) for the pure helpers:
`src/lib/__tests__/todo-quickadd.test.ts`, `todo-sort.test.ts`, `todo-date.test.ts`.
Cover: quick-add token parsing incl. ambiguous/unknown `@`, each `!date` form and
literal fallthrough; the three sort orders incl. done-sink and undated-last;
overdue boundary at "today". Manual/live verification of the DB + notifications
happens against the Vercel deploy (local Mongo creds here are stale).

## Out of scope (MVP)

Manual drag-reorder (only the 3 named sorts); scheduled "due today" cron pushes
(assignment push only, plus client-side due-today surfacing); per-list colour
themes; real-time websockets (polling + focus refetch instead).
