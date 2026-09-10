# Shared ToDo Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `/todo` feature: shared, collaborative to-do lists styled as the colourful "Things To Do" paper notepad, with assignable tasks, a task modal, complete/strike-through, renew-with-archive, three sort orders, quick-add parsing, ntfy push, and a "My tasks" view.

**Architecture:** Standard repo feature shape — import-free types + pure `node --test`ed helpers in `src/lib`, a native-driver Mongo model (`src/models/Todo.ts`, collections `todoLists`/`todoTasks`/`todoArchives`), App Router route handlers under `src/app/api/todo/*` gated by `requirePagePermission('todo')` then per-list membership, and `'use client'` pages under `src/app/todo/*` with a co-located `todo.css`. Identity is the Auth.js session email; access inside the feature is by list membership.

**Tech Stack:** Next.js 15 App Router, TypeScript, native `mongodb` driver, Auth.js v5, `next/font/google` (Caveat), `node --test`, ntfy.sh.

## Global Constraints

- **Node binary:** the shell `node`/`npx` wrapper is broken on this machine — run Node via `/opt/homebrew/bin/node` by absolute path. `npm run …` scripts are fine.
- **Identity:** `UserId` is the session email; never trust a client-supplied identity — derive it server-side from the gate (`gate.session.user.email`).
- **Access model:** one permission key `todo` gates the whole feature; per-list edit rights are governed by `list.members`, not a second permission. Membership changes and list deletion are creator-only (`list.createdBy`).
- **Dates:** store due dates as bare `YYYY-MM-DD`; parse with `parseLocalDate`, never `new Date(str)` (UTC drift).
- **Import-free rule:** `src/types/todo.ts` and every `src/lib/todo-*.ts` helper must not use the `@/…` alias (they're imported by `node --test` via relative `.ts` paths). Models/routes/pages use `@/…` freely.
- **Timestamps:** ISO strings via `new Date().toISOString()`.
- **Mongo mapping:** `_id: ObjectId` on disk ↔ `id: string` in the API type; ISO timestamps; free `get*/create*/update*/delete*` functions (no ODM).
- **Test command:** `npm test` runs `node --test "src/**/*.test.ts"`. Pre-commit (Husky) runs `npm test` then `next build`.
- **Verify before commit (non-pure tasks):** `npx tsc --noEmit --incremental false --pretty false` (or `/opt/homebrew/bin/node` equivalents), `npm run lint`, `npm run build`. If `.next` is stuck (`Cannot find module for page: /_document`), `rm -rf .next` and retry.

---

### Task 1: Domain types

**Files:**
- Create: `src/types/todo.ts`

**Interfaces:**
- Produces: `TodoSortBy`, `isTodoSortBy`, `TODO_SORT_OPTIONS`, `TodoList`, `TodoTask`, `ArchivedTask`, `TodoArchive`, `TodoMember`, `TodoListDetail`, `CreateListDto`, `UpdateListDto`, `CreateTaskDto`, `UpdateTaskDto`.

- [ ] **Step 1: Write the type module** (import-free)

```ts
// Public types + DTOs for the Shared ToDo feature. Import-free so the pure
// helpers (todo-quickadd, todo-sort, todo-date) and their node --test suites
// can import it via a relative `.ts` path without the `@/` alias.

export type TodoSortBy = 'created' | 'dueDate' | 'assignee';

export const TODO_SORT_OPTIONS: readonly TodoSortBy[] = ['created', 'dueDate', 'assignee'];

export function isTodoSortBy(v: unknown): v is TodoSortBy {
  return v === 'created' || v === 'dueDate' || v === 'assignee';
}

export interface TodoList {
  id: string;
  name: string;
  createdBy: string;          // email
  members: string[];          // emails, always includes createdBy
  sortBy: TodoSortBy;
  notifyTopic: string;        // ntfy.sh topic for this list (unguessable)
  createdAt: string;          // ISO
  updatedAt: string;          // ISO
}

export interface TodoTask {
  id: string;
  listId: string;
  text: string;
  description?: string;
  assignees: string[];        // emails, subset of the list's members
  dueDate?: string;           // 'YYYY-MM-DD'
  done: boolean;
  doneAt?: string;            // ISO, set when done flips true
  doneBy?: string;            // email
  createdBy: string;          // email
  createdAt: string;          // ISO — the 'created' sort key
  updatedAt: string;          // ISO
}

// Snapshot of a task at renewal time (no ids — it's frozen history).
export interface ArchivedTask {
  text: string;
  description?: string;
  assignees: string[];
  dueDate?: string;
  done: boolean;
  doneAt?: string;
  doneBy?: string;
  createdBy: string;
  createdAt: string;
}

export interface TodoArchive {
  id: string;
  listId: string;
  name: string;               // list name at renewal time
  renewedAt: string;          // ISO
  renewedBy: string;          // email
  tasks: ArchivedTask[];      // full snapshot of every task at renewal
}

// Slim member record for the picker (from /api/todo/members).
export interface TodoMember {
  email: string;
  name: string;
}

// GET /api/todo/lists/[id] response: the list plus its live tasks.
export interface TodoListDetail {
  list: TodoList;
  tasks: TodoTask[];
  archiveCount: number;
}

// --- DTOs (request bodies) ---
export interface CreateListDto {
  name: string;
  members: string[];          // emails; server always adds the creator
}

export interface UpdateListDto {
  name?: string;
  sortBy?: TodoSortBy;
  members?: string[];         // creator-only
}

export interface CreateTaskDto {
  text: string;
  assignees?: string[];
  dueDate?: string;
  description?: string;
}

export interface UpdateTaskDto {
  text?: string;
  assignees?: string[];
  dueDate?: string | null;    // null clears the due date
  description?: string | null;// null clears the description
  done?: boolean;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit --incremental false --pretty false` (via `/opt/homebrew/bin/node` if the wrapper errors)
Expected: no errors mentioning `src/types/todo.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/types/todo.ts
git commit -m "feat(todo): domain types and DTOs"
```

---

### Task 2: Quick-add parser (pure, TDD)

**Files:**
- Create: `src/lib/todo-quickadd.ts`
- Test: `src/lib/__tests__/todo-quickadd.test.ts`

**Interfaces:**
- Consumes: `TodoMember` from `../types/todo.ts` (relative import — import-free rule).
- Produces: `parseQuickAdd(raw, members, today?) → { text, assignees, dueDate? }`, `resolveDueToken(token, today) → string|null`, `resolveAssigneeToken(token, members) → string|null`, `QuickAddResult`.

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/todo-quickadd.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickAdd, resolveDueToken } from '../todo-quickadd.ts';
import type { TodoMember } from '../../types/todo.ts';

const MEMBERS: TodoMember[] = [
  { email: 'tomzari347@gmail.com', name: 'Tom' },
  { email: 'levtomer66@gmail.com', name: 'Tomer' },
  { email: 'amitz2002@gmail.com', name: 'Amit' },
];
// A Wednesday.
const WED = new Date(2026, 8, 9); // 2026-09-09

test('plain text passes through untouched', () => {
  const r = parseQuickAdd('Buy milk and eggs', MEMBERS, WED);
  assert.equal(r.text, 'Buy milk and eggs');
  assert.deepEqual(r.assignees, []);
  assert.equal(r.dueDate, undefined);
});

test('@name matches a member by unique name prefix and strips the token', () => {
  const r = parseQuickAdd('Buy milk @amit', MEMBERS, WED);
  assert.equal(r.text, 'Buy milk');
  assert.deepEqual(r.assignees, ['amitz2002@gmail.com']);
});

test('@ ambiguous prefix (tom → Tom & Tomer) stays literal', () => {
  const r = parseQuickAdd('Call @tom', MEMBERS, WED);
  assert.equal(r.text, 'Call @tom');
  assert.deepEqual(r.assignees, []);
});

test('@ unknown stays literal', () => {
  const r = parseQuickAdd('Ping @nobody', MEMBERS, WED);
  assert.equal(r.text, 'Ping @nobody');
  assert.deepEqual(r.assignees, []);
});

test('@ matches by email local-part', () => {
  const r = parseQuickAdd('x @amitz2002', MEMBERS, WED);
  assert.deepEqual(r.assignees, ['amitz2002@gmail.com']);
});

test('!today / !tomorrow / weekday / iso resolve; last valid due wins', () => {
  assert.equal(resolveDueToken('today', WED), '2026-09-09');
  assert.equal(resolveDueToken('tomorrow', WED), '2026-09-10');
  assert.equal(resolveDueToken('friday', WED), '2026-09-11'); // next Fri
  assert.equal(resolveDueToken('wed', WED), '2026-09-09');    // same-day = today
  assert.equal(resolveDueToken('2026-12-25', WED), '2026-12-25');
  assert.equal(resolveDueToken('2026-13-40', WED), null);     // invalid calendar date
  assert.equal(resolveDueToken('someday', WED), null);
  const r = parseQuickAdd('Pay rent !today !2026-10-01', MEMBERS, WED);
  assert.equal(r.text, 'Pay rent');
  assert.equal(r.dueDate, '2026-10-01');
});

test('invalid !token stays literal text', () => {
  const r = parseQuickAdd('Read !later', MEMBERS, WED);
  assert.equal(r.text, 'Read !later');
  assert.equal(r.dueDate, undefined);
});

test('duplicate @assignee is de-duplicated', () => {
  const r = parseQuickAdd('x @amit @amit', MEMBERS, WED);
  assert.deepEqual(r.assignees, ['amitz2002@gmail.com']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../todo-quickadd.ts`.

- [ ] **Step 3: Write the implementation**

`src/lib/todo-quickadd.ts`:
```ts
import type { TodoMember } from '../types/todo.ts';

export interface QuickAddResult {
  text: string;
  assignees: string[];        // emails
  dueDate?: string;           // 'YYYY-MM-DD'
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Resolve a `!token` (without the '!') to 'YYYY-MM-DD', or null if not a date.
// A weekday equal to `today` resolves to today (offset 0), not next week.
export function resolveDueToken(token: string, today: Date): string | null {
  const t = token.toLowerCase();
  if (t === 'today') return ymd(today);
  if (t === 'tomorrow') {
    return ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
  }
  if (t in WEEKDAYS) {
    const offset = (WEEKDAYS[t] - today.getDay() + 7) % 7;
    return ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, d] = t.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) return t;
    return null;
  }
  return null;
}

// Match an `@token` (without the '@') to exactly one member. Returns the email,
// or null when zero or multiple members match (ambiguous → left as literal text).
export function resolveAssigneeToken(token: string, members: TodoMember[]): string | null {
  const t = token.toLowerCase();
  if (!t) return null;
  const matches = members.filter((m) => {
    const local = m.email.toLowerCase().split('@')[0];
    const name = m.name.toLowerCase().replace(/\s+/g, '');
    return m.email.toLowerCase() === t || local.startsWith(t) || name.startsWith(t);
  });
  const emails = [...new Set(matches.map((m) => m.email))];
  return emails.length === 1 ? emails[0] : null;
}

export function parseQuickAdd(
  raw: string,
  members: TodoMember[],
  today: Date = new Date(),
): QuickAddResult {
  const assignees: string[] = [];
  let dueDate: string | undefined;
  const textParts: string[] = [];

  for (const token of raw.split(/\s+/)) {
    if (!token) continue;
    if (token.startsWith('@') && token.length > 1) {
      const email = resolveAssigneeToken(token.slice(1), members);
      if (email) {
        if (!assignees.includes(email)) assignees.push(email);
        continue;
      }
    } else if (token.startsWith('!') && token.length > 1) {
      const due = resolveDueToken(token.slice(1), today);
      if (due) {
        dueDate = due;          // last valid !date wins
        continue;
      }
    }
    textParts.push(token);
  }

  return { text: textParts.join(' ').trim(), assignees, dueDate };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all todo-quickadd tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/todo-quickadd.ts src/lib/__tests__/todo-quickadd.test.ts
git commit -m "feat(todo): quick-add @assignee/!date parser"
```

---

### Task 3: Bare-date helpers (pure, TDD)

**Files:**
- Create: `src/lib/todo-date.ts`
- Test: `src/lib/__tests__/todo-date.test.ts`

**Interfaces:**
- Produces: `parseLocalDate(ymd)`, `todayYmd(now?)`, `isOverdue(dueYmd?, now?)`, `formatDueLabel(dueYmd, now?)`.

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/todo-date.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOverdue, formatDueLabel, todayYmd } from '../todo-date.ts';

const WED = new Date(2026, 8, 9); // 2026-09-09, a Wednesday

test('todayYmd formats local date', () => {
  assert.equal(todayYmd(WED), '2026-09-09');
});

test('isOverdue: yesterday overdue, today not, tomorrow not, undated not', () => {
  assert.equal(isOverdue('2026-09-08', WED), true);
  assert.equal(isOverdue('2026-09-09', WED), false);
  assert.equal(isOverdue('2026-09-10', WED), false);
  assert.equal(isOverdue(undefined, WED), false);
});

test('formatDueLabel: today/tomorrow/yesterday/weekday/far', () => {
  assert.equal(formatDueLabel('2026-09-09', WED), 'Today');
  assert.equal(formatDueLabel('2026-09-10', WED), 'Tomorrow');
  assert.equal(formatDueLabel('2026-09-08', WED), 'Yesterday');
  assert.equal(formatDueLabel('2026-09-11', WED), 'Fri');   // within a week
  assert.equal(formatDueLabel('2026-12-25', WED), 'Dec 25');
  assert.equal(formatDueLabel('2027-01-02', WED), 'Jan 2 2027');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../todo-date.ts`.

- [ ] **Step 3: Write the implementation**

`src/lib/todo-date.ts`:
```ts
// Bare-date helpers for the ToDo feature. Import-free (unit-tested with
// node --test). `YYYY-MM-DD` is parsed at LOCAL midnight — never `new
// Date(str)`, which is UTC and lands on the previous day west of Greenwich.

export function parseLocalDate(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(ymd);
}

export function todayYmd(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// True when `dueYmd` is strictly before today's local date. Zero-padded YMD
// strings compare correctly with a plain lexical `<`.
export function isOverdue(dueYmd: string | undefined, now: Date = new Date()): boolean {
  if (!dueYmd) return false;
  return dueYmd < todayYmd(now);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Short human label: 'Today' / 'Tomorrow' / 'Yesterday', a weekday within the
// next week, else 'Mon D' ('Sep 20'); the year is appended only when it isn't
// the current year.
export function formatDueLabel(dueYmd: string, now: Date = new Date()): string {
  const due = parseLocalDate(dueYmd);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return WD[due.getDay()];
  const base = `${MONTHS[due.getMonth()]} ${due.getDate()}`;
  return due.getFullYear() === today.getFullYear() ? base : `${base} ${due.getFullYear()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/todo-date.ts src/lib/__tests__/todo-date.test.ts
git commit -m "feat(todo): bare-date overdue + due-label helpers"
```

---

### Task 4: Task sort (pure, TDD)

**Files:**
- Create: `src/lib/todo-sort.ts`
- Test: `src/lib/__tests__/todo-sort.test.ts`

**Interfaces:**
- Consumes: `TodoTask`, `TodoSortBy` from `../types/todo.ts`.
- Produces: `sortTasks(tasks, sortBy, nameOf?) → TodoTask[]`. `nameOf: (email)=>string` maps email→display name (default identity) so the module stays import-free; the page passes `getUserDisplayName`.

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/todo-sort.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortTasks } from '../todo-sort.ts';
import type { TodoTask } from '../../types/todo.ts';

function task(p: Partial<TodoTask> & { id: string; createdAt: string }): TodoTask {
  return {
    listId: 'L', text: p.id, assignees: [], done: false,
    createdBy: 'x@x', updatedAt: p.createdAt,
    ...p,
  } as TodoTask;
}

test('created: ascending by createdAt, done sinks to bottom', () => {
  const tasks = [
    task({ id: 'b', createdAt: '2026-01-02T00:00:00Z' }),
    task({ id: 'a', createdAt: '2026-01-01T00:00:00Z' }),
    task({ id: 'doneOld', createdAt: '2026-01-00T00:00:00Z', done: true }),
  ];
  assert.deepEqual(sortTasks(tasks, 'created').map((t) => t.id), ['a', 'b', 'doneOld']);
});

test('dueDate: dated ascending, undated after dated', () => {
  const tasks = [
    task({ id: 'none', createdAt: '2026-01-01T00:00:00Z' }),
    task({ id: 'late', createdAt: '2026-01-02T00:00:00Z', dueDate: '2026-03-01' }),
    task({ id: 'soon', createdAt: '2026-01-03T00:00:00Z', dueDate: '2026-02-01' }),
  ];
  assert.deepEqual(sortTasks(tasks, 'dueDate').map((t) => t.id), ['soon', 'late', 'none']);
});

test('assignee: grouped by first assignee display name via nameOf', () => {
  const nameOf = (e: string) => ({ 'z@x': 'Zoe', 'a@x': 'Amit' }[e] ?? e);
  const tasks = [
    task({ id: 'zoe', createdAt: '2026-01-01T00:00:00Z', assignees: ['z@x'] }),
    task({ id: 'amit', createdAt: '2026-01-02T00:00:00Z', assignees: ['a@x'] }),
    task({ id: 'none', createdAt: '2026-01-03T00:00:00Z', assignees: [] }),
  ];
  assert.deepEqual(sortTasks(tasks, 'assignee', nameOf).map((t) => t.id), ['amit', 'zoe', 'none']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../todo-sort.ts`.

- [ ] **Step 3: Write the implementation**

`src/lib/todo-sort.ts`:
```ts
import type { TodoTask, TodoSortBy } from '../types/todo.ts';

// Order tasks for display. Done tasks always sink to the bottom (keeping their
// relative order), open tasks sort by the chosen key:
//   'created'  → createdAt ascending (insertion order)
//   'dueDate'  → dueDate ascending; undated tasks after dated ones
//   'assignee' → by first assignee's display name (via nameOf), then createdAt
// `nameOf` maps an email → display name (defaults to identity) so this module
// stays import-free/testable while the page passes getUserDisplayName.
export function sortTasks(
  tasks: TodoTask[],
  sortBy: TodoSortBy,
  nameOf: (email: string) => string = (e) => e,
): TodoTask[] {
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const byCreated = (a: TodoTask, b: TodoTask) => a.createdAt.localeCompare(b.createdAt);

  const cmp: Record<TodoSortBy, (a: TodoTask, b: TodoTask) => number> = {
    created: byCreated,
    dueDate: (a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate) || byCreated(a, b);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return byCreated(a, b);
    },
    assignee: (a, b) => {
      const an = a.assignees[0] ? nameOf(a.assignees[0]).toLowerCase() : '￿';
      const bn = b.assignees[0] ? nameOf(b.assignees[0]).toLowerCase() : '￿';
      return an.localeCompare(bn) || byCreated(a, b);
    },
  };

  return [...open.sort(cmp[sortBy]), ...done];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all pure-helper suites green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/todo-sort.ts src/lib/__tests__/todo-sort.test.ts
git commit -m "feat(todo): task sort (created/due/assignee, done-sink)"
```

---

### Task 5: Register the `todo` permission + route gate

**Files:**
- Modify: `src/types/permissions.ts` (union, `PERMISSION_KEYS`, `PERMISSIONS`)
- Modify: `src/middleware.ts` (`GATES` + `config.matcher`)

**Interfaces:**
- Produces: `'todo'` as a valid `PermissionKey`; `/todo/*` gated by it.

- [ ] **Step 1: Add `todo` to the permission union** — in `src/types/permissions.ts`, add `| 'todo'` to the visibility group of the `PermissionKey` union (after `'paging'`):

```ts
  | 'paging'
  | 'todo'
```

- [ ] **Step 2: Add to `PERMISSION_KEYS`** — append after `'paging'`:

```ts
  'paging',
  'todo',
];
```

- [ ] **Step 3: Add to the `PERMISSIONS` map** — after the `paging` entry:

```ts
  paging:              { label: 'Paging',              emoji: '📟' },
  todo:                { label: 'To-Do',               emoji: '📝' },
};
```

- [ ] **Step 4: Add the middleware gate** — in `src/middleware.ts`, append to `GATES`:

```ts
  { pattern: /^\/paging(?:\/|$)/,            permission: 'paging'      },
  { pattern: /^\/todo(?:\/|$)/,              permission: 'todo'        },
];
```

- [ ] **Step 5: Add to the matcher** — append to `config.matcher`:

```ts
    '/paging/:path*',
    '/todo/:path*',
    '/trip.html',
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit --incremental false --pretty false` then `npm run lint`
Expected: no errors. (The `/admin/allowlist` matrix now shows a "To-Do 📝" column automatically.)

- [ ] **Step 7: Commit**

```bash
git add src/types/permissions.ts src/middleware.ts
git commit -m "feat(todo): register todo permission and route gate"
```

---

### Task 6: Mongo model

**Files:**
- Create: `src/models/Todo.ts`

**Interfaces:**
- Consumes: `clientPromise` (`@/lib/mongodb`), types from `@/types/todo`.
- Produces: `getListsForMember(email)`, `getListById(id)`, `createList({name,members,createdBy})`, `updateList(id,patch)`, `deleteListCascade(id)`, `getTasksForList(listId)`, `getTasksAssignedTo(email)`, `getTaskById(listId,taskId)`, `createTask(listId,input)`, `updateTask(listId,taskId,patch)`, `deleteTask(listId,taskId)`, `renewList(listId,renewedBy)`, `getArchivesForList(listId)`, `countArchives(listId)`.

- [ ] **Step 1: Write the model** (native driver; `listId` stored as the list's hex string, so no ObjectId juggling on task/archive queries)

`src/models/Todo.ts`:
```ts
import { ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import clientPromise from '@/lib/mongodb';
import type { TodoList, TodoTask, TodoArchive, ArchivedTask, TodoSortBy } from '@/types/todo';

const LISTS = 'todoLists';
const TASKS = 'todoTasks';
const ARCHIVES = 'todoArchives';

interface TodoListDocument extends Omit<TodoList, 'id'> { _id?: ObjectId }
interface TodoTaskDocument extends Omit<TodoTask, 'id'> { _id?: ObjectId }
interface TodoArchiveDocument extends Omit<TodoArchive, 'id'> { _id?: ObjectId }

async function listsCol() { const c = await clientPromise; return c.db().collection<TodoListDocument>(LISTS); }
async function tasksCol() { const c = await clientPromise; return c.db().collection<TodoTaskDocument>(TASKS); }
async function archivesCol() { const c = await clientPromise; return c.db().collection<TodoArchiveDocument>(ARCHIVES); }

function toList(d: TodoListDocument): TodoList { const { _id, ...r } = d; return { ...r, id: _id!.toString() }; }
function toTask(d: TodoTaskDocument): TodoTask { const { _id, ...r } = d; return { ...r, id: _id!.toString() }; }
function toArchive(d: TodoArchiveDocument): TodoArchive { const { _id, ...r } = d; return { ...r, id: _id!.toString() }; }

// --- Lists ---
export async function getListsForMember(email: string): Promise<TodoList[]> {
  const col = await listsCol();
  const docs = await col.find({ members: email }).sort({ updatedAt: -1 }).toArray();
  return docs.map(toList);
}

export async function getListById(id: string): Promise<TodoList | null> {
  try {
    const col = await listsCol();
    const doc = await col.findOne({ _id: new ObjectId(id) });
    return doc ? toList(doc) : null;
  } catch { return null; }
}

export async function createList(input: { name: string; members: string[]; createdBy: string }): Promise<TodoList> {
  const col = await listsCol();
  const now = new Date().toISOString();
  const members = [...new Set([input.createdBy, ...input.members])];
  const doc: Omit<TodoListDocument, '_id'> = {
    name: input.name, createdBy: input.createdBy, members,
    sortBy: 'created', notifyTopic: `hatom-todo-${randomUUID()}`,
    createdAt: now, updatedAt: now,
  };
  const res = await col.insertOne(doc);
  return { ...doc, id: res.insertedId.toString() };
}

export async function updateList(
  id: string,
  patch: Partial<{ name: string; sortBy: TodoSortBy; members: string[] }>,
): Promise<TodoList | null> {
  try {
    const col = await listsCol();
    const res = await col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...patch, updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' },
    );
    return res ? toList(res) : null;
  } catch { return null; }
}

export async function deleteListCascade(id: string): Promise<boolean> {
  try {
    const lc = await listsCol();
    const tc = await tasksCol();
    const ac = await archivesCol();
    await tc.deleteMany({ listId: id });
    await ac.deleteMany({ listId: id });
    const res = await lc.deleteOne({ _id: new ObjectId(id) });
    return res.deletedCount > 0;
  } catch { return false; }
}

// --- Tasks ---
export async function getTasksForList(listId: string): Promise<TodoTask[]> {
  const col = await tasksCol();
  const docs = await col.find({ listId }).toArray();
  return docs.map(toTask);
}

// Open tasks assigned to `email` across every list (for the "My tasks" view).
export async function getTasksAssignedTo(email: string): Promise<TodoTask[]> {
  const col = await tasksCol();
  const docs = await col.find({ assignees: email, done: false }).toArray();
  return docs.map(toTask);
}

export async function getTaskById(listId: string, taskId: string): Promise<TodoTask | null> {
  try {
    const col = await tasksCol();
    const doc = await col.findOne({ _id: new ObjectId(taskId), listId });
    return doc ? toTask(doc) : null;
  } catch { return null; }
}

export async function createTask(
  listId: string,
  input: { text: string; assignees: string[]; dueDate?: string; description?: string; createdBy: string },
): Promise<TodoTask> {
  const col = await tasksCol();
  const now = new Date().toISOString();
  const doc: Omit<TodoTaskDocument, '_id'> = {
    listId, text: input.text, assignees: input.assignees,
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    ...(input.description ? { description: input.description } : {}),
    done: false, createdBy: input.createdBy, createdAt: now, updatedAt: now,
  };
  const res = await col.insertOne(doc);
  return { ...doc, id: res.insertedId.toString() };
}

export async function updateTask(
  listId: string,
  taskId: string,
  patch: {
    text?: string;
    assignees?: string[];
    dueDate?: string | null;
    description?: string | null;
    done?: boolean;
    doneBy?: string;
  },
): Promise<TodoTask | null> {
  try {
    const col = await tasksCol();
    const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    const unset: Record<string, ''> = {};
    if (patch.text !== undefined) set.text = patch.text;
    if (patch.assignees !== undefined) set.assignees = patch.assignees;
    if (patch.dueDate !== undefined) {
      if (patch.dueDate === null) unset.dueDate = ''; else set.dueDate = patch.dueDate;
    }
    if (patch.description !== undefined) {
      if (patch.description === null) unset.description = ''; else set.description = patch.description;
    }
    if (patch.done !== undefined) {
      set.done = patch.done;
      if (patch.done) { set.doneAt = new Date().toISOString(); if (patch.doneBy) set.doneBy = patch.doneBy; }
      else { unset.doneAt = ''; unset.doneBy = ''; }
    }
    const update: Record<string, unknown> = { $set: set };
    if (Object.keys(unset).length) update.$unset = unset;
    const res = await col.findOneAndUpdate({ _id: new ObjectId(taskId), listId }, update, { returnDocument: 'after' });
    return res ? toTask(res) : null;
  } catch { return null; }
}

export async function deleteTask(listId: string, taskId: string): Promise<boolean> {
  try {
    const col = await tasksCol();
    const res = await col.deleteOne({ _id: new ObjectId(taskId), listId });
    return res.deletedCount > 0;
  } catch { return false; }
}

// --- Archives / renew ---
// Snapshot every current task into an archive doc, then delete the done tasks
// and keep the rest. Returns the new archive (or null if the list is gone).
export async function renewList(listId: string, renewedBy: string): Promise<TodoArchive | null> {
  const list = await getListById(listId);
  if (!list) return null;
  const tc = await tasksCol();
  const docs = await tc.find({ listId }).toArray();
  const tasks: ArchivedTask[] = docs.map((d) => ({
    text: d.text, description: d.description, assignees: d.assignees,
    dueDate: d.dueDate, done: d.done, doneAt: d.doneAt, doneBy: d.doneBy,
    createdBy: d.createdBy, createdAt: d.createdAt,
  }));
  const now = new Date().toISOString();
  const archiveDoc: Omit<TodoArchiveDocument, '_id'> = {
    listId, name: list.name, renewedAt: now, renewedBy, tasks,
  };
  const res = await (await archivesCol()).insertOne(archiveDoc);
  await tc.deleteMany({ listId, done: true });
  await (await listsCol()).updateOne({ _id: new ObjectId(listId) }, { $set: { updatedAt: now } });
  return { ...archiveDoc, id: res.insertedId.toString() };
}

export async function getArchivesForList(listId: string): Promise<TodoArchive[]> {
  const col = await archivesCol();
  const docs = await col.find({ listId }).sort({ renewedAt: -1 }).toArray();
  return docs.map(toArchive);
}

export async function countArchives(listId: string): Promise<number> {
  const col = await archivesCol();
  return col.countDocuments({ listId });
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit --incremental false --pretty false`
Expected: no errors. (No unit test — Mongo access isn't testable with the stale local creds; the build + type-check is the gate.)

- [ ] **Step 3: Commit**

```bash
git add src/models/Todo.ts
git commit -m "feat(todo): mongo model for lists, tasks, archives"
```

---

### Task 7: Access helper, ntfy helper, members + my-tasks endpoints

**Files:**
- Create: `src/lib/todo-access.ts`
- Create: `src/lib/todo-notify.ts`
- Create: `src/app/api/todo/members/route.ts`
- Create: `src/app/api/todo/my-tasks/route.ts`

**Interfaces:**
- Consumes: `requirePagePermission` (`@/lib/auth-helpers`), `getListById`/`getTasksAssignedTo` (`@/models/Todo`), `getAllAuthorizedEmails` (`@/models/AuthorizedEmail`), `OWNER_EMAILS` (`@/types/auth`), `getUserDisplayName` (`@/types/workout`).
- Produces: `requireListMember(listId) → { session, email, list } | NextResponse`; `notifyAssignment(topic, {taskText, assignees, byEmail})`.

- [ ] **Step 1: Verify the `@/types/auth` export name** — the members endpoint imports `OWNER_EMAILS`. Confirm:

Run: `grep -nE "export const OWNER_EMAILS|export function isOwnerEmail" src/types/auth.ts`
Expected: shows `export const OWNER_EMAILS`. If the name differs, use the actual export in Step 4.

- [ ] **Step 2: Write the access helper**

`src/lib/todo-access.ts`:
```ts
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { requirePagePermission } from '@/lib/auth-helpers';
import { getListById } from '@/models/Todo';
import type { TodoList } from '@/types/todo';

// Gate on the `todo` permission, load the list, and confirm the caller is a
// member — all in one call. A non-member (or missing list) gets a 404, not a
// 403, so list existence isn't leaked to outsiders.
export async function requireListMember(listId: string): Promise<
  | { session: Session & { user: { email: string } }; email: string; list: TodoList }
  | NextResponse
> {
  const gate = await requirePagePermission('todo');
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email;
  const list = await getListById(listId);
  if (!list || !list.members.includes(email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return { session: gate.session, email, list };
}
```

- [ ] **Step 3: Write the ntfy helper** (fire-and-forget; ASCII `Title` header, UTF-8 body so Hebrew names are safe)

`src/lib/todo-notify.ts`:
```ts
import { getUserDisplayName } from '@/types/workout';

// Best-effort ntfy.sh push for a task assignment. Never throws — a failed
// notification must not break the API response. Server-side fetch, so the
// browser CSP doesn't apply (ntfy.sh is on connect-src regardless).
export async function notifyAssignment(
  topic: string,
  opts: { taskText: string; assignees: string[]; byEmail: string },
): Promise<void> {
  try {
    if (!topic || opts.assignees.length === 0) return;
    const who = opts.assignees.map((e) => getUserDisplayName(e)).join(', ');
    const by = getUserDisplayName(opts.byEmail);
    const body = `${who}: ${opts.taskText}${by ? ` (by ${by})` : ''}`;
    await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers: { Title: 'New to-do assigned', Tags: 'memo' },
      body,
    });
  } catch (e) {
    console.error('ntfy notify failed:', e);
  }
}
```

- [ ] **Step 4: Write the members endpoint**

`src/app/api/todo/members/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { getAllAuthorizedEmails } from '@/models/AuthorizedEmail';
import { OWNER_EMAILS } from '@/types/auth';
import { getUserDisplayName } from '@/types/workout';
import type { TodoMember } from '@/types/todo';

// Slim directory of app accounts for the member/assignee picker. The existing
// /api/admin/allowlist is owner-only; this one is available to any signed-in
// user who holds the `todo` permission.
export async function GET() {
  const gate = await requirePagePermission('todo');
  if (gate instanceof NextResponse) return gate;
  try {
    const rows = await getAllAuthorizedEmails();
    const emails = new Set<string>(rows.map((r) => r.email.toLowerCase()));
    for (const o of OWNER_EMAILS) emails.add(o.toLowerCase());
    emails.add(gate.session.user.email.toLowerCase());
    const members: TodoMember[] = [...emails]
      .sort()
      .map((email) => ({ email, name: getUserDisplayName(email) }));
    return NextResponse.json(members);
  } catch (e) {
    console.error('todo members GET failed:', e);
    return NextResponse.json({ error: 'Failed to load members' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Write the my-tasks endpoint**

`src/app/api/todo/my-tasks/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { getTasksAssignedTo } from '@/models/Todo';

// Open tasks assigned to the caller across all lists. The client maps each
// task's listId to a name using the lists it already fetched from /api/todo/lists
// (the caller is always a member of any list they're assigned in).
export async function GET() {
  const gate = await requirePagePermission('todo');
  if (gate instanceof NextResponse) return gate;
  try {
    const tasks = await getTasksAssignedTo(gate.session.user.email);
    return NextResponse.json(tasks);
  } catch (e) {
    console.error('todo my-tasks GET failed:', e);
    return NextResponse.json({ error: 'Failed to load tasks' }, { status: 500 });
  }
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit --incremental false --pretty false` then `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/todo-access.ts src/lib/todo-notify.ts src/app/api/todo/members/route.ts src/app/api/todo/my-tasks/route.ts
git commit -m "feat(todo): access helper, ntfy push, members + my-tasks endpoints"
```

---

### Task 8: Lists endpoints

**Files:**
- Create: `src/app/api/todo/lists/route.ts`
- Create: `src/app/api/todo/lists/[id]/route.ts`

**Interfaces:**
- Consumes: `requirePagePermission`, `requireListMember`, model helpers, `isTodoSortBy`, DTO types.
- Produces: `GET/POST /api/todo/lists`; `GET/PATCH/DELETE /api/todo/lists/[id]`.

- [ ] **Step 1: Write the collection route**

`src/app/api/todo/lists/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { getListsForMember, createList } from '@/models/Todo';
import type { CreateListDto } from '@/types/todo';

export async function GET() {
  const gate = await requirePagePermission('todo');
  if (gate instanceof NextResponse) return gate;
  try {
    const lists = await getListsForMember(gate.session.user.email);
    return NextResponse.json(lists);
  } catch (e) {
    console.error('todo lists GET failed:', e);
    return NextResponse.json({ error: 'Failed to load lists' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requirePagePermission('todo');
  if (gate instanceof NextResponse) return gate;
  try {
    const data = (await request.json()) as CreateListDto;
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const members = Array.isArray(data.members)
      ? data.members.filter((m): m is string => typeof m === 'string')
      : [];
    const list = await createList({ name, members, createdBy: gate.session.user.email });
    return NextResponse.json(list, { status: 201 });
  } catch (e) {
    console.error('todo lists POST failed:', e);
    return NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write the single-list route**

`src/app/api/todo/lists/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireListMember } from '@/lib/todo-access';
import { getTasksForList, updateList, deleteListCascade, countArchives } from '@/models/Todo';
import { isTodoSortBy, type TodoListDetail, type TodoSortBy, type UpdateListDto } from '@/types/todo';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await requireListMember(id);
  if (access instanceof NextResponse) return access;
  try {
    const [tasks, archiveCount] = await Promise.all([getTasksForList(id), countArchives(id)]);
    const body: TodoListDetail = { list: access.list, tasks, archiveCount };
    return NextResponse.json(body);
  } catch (e) {
    console.error('todo list GET failed:', e);
    return NextResponse.json({ error: 'Failed to load list' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await requireListMember(id);
  if (access instanceof NextResponse) return access;
  try {
    const data = (await request.json()) as UpdateListDto;
    const patch: { name?: string; sortBy?: TodoSortBy; members?: string[] } = {};
    if (typeof data.name === 'string' && data.name.trim()) patch.name = data.name.trim();
    if (data.sortBy !== undefined) {
      if (!isTodoSortBy(data.sortBy)) return NextResponse.json({ error: 'bad sortBy' }, { status: 400 });
      patch.sortBy = data.sortBy;
    }
    if (data.members !== undefined) {
      // Membership changes are creator-only.
      if (access.list.createdBy !== access.email) {
        return NextResponse.json({ error: 'Only the creator can change members' }, { status: 403 });
      }
      if (!Array.isArray(data.members)) return NextResponse.json({ error: 'bad members' }, { status: 400 });
      patch.members = [...new Set([
        access.list.createdBy,
        ...data.members.filter((m): m is string => typeof m === 'string'),
      ])];
    }
    if (Object.keys(patch).length === 0) return NextResponse.json(access.list);
    const updated = await updateList(id, patch);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (e) {
    console.error('todo list PATCH failed:', e);
    return NextResponse.json({ error: 'Failed to update list' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await requireListMember(id);
  if (access instanceof NextResponse) return access;
  if (access.list.createdBy !== access.email) {
    return NextResponse.json({ error: 'Only the creator can delete the list' }, { status: 403 });
  }
  try {
    const ok = await deleteListCascade(id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('todo list DELETE failed:', e);
    return NextResponse.json({ error: 'Failed to delete list' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit --incremental false --pretty false` then `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/todo/lists/route.ts src/app/api/todo/lists/\[id\]/route.ts
git commit -m "feat(todo): list CRUD endpoints"
```

---

### Task 9: Task endpoints

**Files:**
- Create: `src/app/api/todo/lists/[id]/tasks/route.ts`
- Create: `src/app/api/todo/lists/[id]/tasks/[taskId]/route.ts`

**Interfaces:**
- Consumes: `requireListMember`, `createTask`/`getTaskById`/`updateTask`/`deleteTask`, `notifyAssignment`, DTO types.
- Produces: `POST /api/todo/lists/[id]/tasks`; `PATCH/DELETE /api/todo/lists/[id]/tasks/[taskId]`.

- [ ] **Step 1: Write the tasks collection route** (create; assignees restricted to current members; notify newly-assigned)

`src/app/api/todo/lists/[id]/tasks/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireListMember } from '@/lib/todo-access';
import { createTask } from '@/models/Todo';
import { notifyAssignment } from '@/lib/todo-notify';
import type { CreateTaskDto } from '@/types/todo';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await requireListMember(id);
  if (access instanceof NextResponse) return access;
  try {
    const data = (await request.json()) as CreateTaskDto;
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });
    const assignees = Array.isArray(data.assignees)
      ? [...new Set(data.assignees.filter((e) => access.list.members.includes(e)))]
      : [];
    const dueDate = typeof data.dueDate === 'string' && YMD.test(data.dueDate) ? data.dueDate : undefined;
    const description = typeof data.description === 'string' && data.description.trim()
      ? data.description.trim() : undefined;
    const task = await createTask(id, { text, assignees, dueDate, description, createdBy: access.email });
    if (assignees.length) {
      await notifyAssignment(access.list.notifyTopic, { taskText: text, assignees, byEmail: access.email });
    }
    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    console.error('todo task POST failed:', e);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write the single-task route** (update/delete; notify only newly-added assignees)

`src/app/api/todo/lists/[id]/tasks/[taskId]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireListMember } from '@/lib/todo-access';
import { getTaskById, updateTask, deleteTask } from '@/models/Todo';
import { notifyAssignment } from '@/lib/todo-notify';
import type { UpdateTaskDto } from '@/types/todo';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await ctx.params;
  const access = await requireListMember(id);
  if (access instanceof NextResponse) return access;
  try {
    const existing = await getTaskById(id, taskId);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const data = (await request.json()) as UpdateTaskDto;
    const patch: Parameters<typeof updateTask>[2] = {};
    if (typeof data.text === 'string' && data.text.trim()) patch.text = data.text.trim();
    if (data.assignees !== undefined) {
      if (!Array.isArray(data.assignees)) return NextResponse.json({ error: 'bad assignees' }, { status: 400 });
      patch.assignees = [...new Set(data.assignees.filter((e) => access.list.members.includes(e)))];
    }
    if (data.dueDate !== undefined) {
      if (data.dueDate === null) patch.dueDate = null;
      else if (typeof data.dueDate === 'string' && YMD.test(data.dueDate)) patch.dueDate = data.dueDate;
      else return NextResponse.json({ error: 'bad dueDate' }, { status: 400 });
    }
    if (data.description !== undefined) {
      patch.description = data.description === null ? null : (String(data.description).trim() || null);
    }
    if (data.done !== undefined) { patch.done = !!data.done; if (data.done) patch.doneBy = access.email; }
    const updated = await updateTask(id, taskId, patch);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (patch.assignees) {
      const added = patch.assignees.filter((e) => !existing.assignees.includes(e));
      if (added.length) {
        await notifyAssignment(access.list.notifyTopic, { taskText: updated.text, assignees: added, byEmail: access.email });
      }
    }
    return NextResponse.json(updated);
  } catch (e) {
    console.error('todo task PATCH failed:', e);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await ctx.params;
  const access = await requireListMember(id);
  if (access instanceof NextResponse) return access;
  try {
    const ok = await deleteTask(id, taskId);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('todo task DELETE failed:', e);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit --incremental false --pretty false` then `npm run lint`
```bash
git add src/app/api/todo/lists/\[id\]/tasks
git commit -m "feat(todo): task create/update/delete endpoints with ntfy on assign"
```

---

### Task 10: Renew + archives endpoints

**Files:**
- Create: `src/app/api/todo/lists/[id]/renew/route.ts`
- Create: `src/app/api/todo/lists/[id]/archives/route.ts`

- [ ] **Step 1: Write the renew route**

`src/app/api/todo/lists/[id]/renew/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireListMember } from '@/lib/todo-access';
import { renewList } from '@/models/Todo';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await requireListMember(id);
  if (access instanceof NextResponse) return access;
  try {
    const archive = await renewList(id, access.email);
    if (!archive) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(archive, { status: 201 });
  } catch (e) {
    console.error('todo renew failed:', e);
    return NextResponse.json({ error: 'Failed to renew list' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write the archives route**

`src/app/api/todo/lists/[id]/archives/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireListMember } from '@/lib/todo-access';
import { getArchivesForList } from '@/models/Todo';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await requireListMember(id);
  if (access instanceof NextResponse) return access;
  try {
    const archives = await getArchivesForList(id);
    return NextResponse.json(archives);
  } catch (e) {
    console.error('todo archives GET failed:', e);
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit --incremental false --pretty false` then `npm run lint`
```bash
git add src/app/api/todo/lists/\[id\]/renew src/app/api/todo/lists/\[id\]/archives
git commit -m "feat(todo): renew (archive + clear done) and history endpoints"
```

---

### Task 11: Notepad chrome — fonts, layout, css, frame component, icon

**Files:**
- Create: `src/app/todo/fonts.ts`
- Create: `src/app/todo/layout.tsx`
- Create: `src/app/todo/todo.css`
- Create: `src/app/todo/icon.svg`
- Create: `src/components/todo/NotepadFrame.tsx`
- Create: `src/components/todo/todo-colors.ts`

**Interfaces:**
- Produces: `caveat` (next/font with `--font-hand` CSS var); `NotepadFrame` component; `colorForEmail(email)` and `initialOf(name)`.

- [ ] **Step 1: Font module** — `src/app/todo/fonts.ts` (exposes Caveat as a CSS variable so `todo.css` drives typography):
```ts
import { Caveat } from 'next/font/google';

// Handwriting face for the notepad. Latin-only — Hebrew task text falls back
// to the site font (Rubik) via the `todo.css` font stack.
export const caveat = Caveat({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-hand',
  display: 'swap',
});
```

- [ ] **Step 2: Layout** — `src/app/todo/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './todo.css';

export const metadata: Metadata = {
  title: '📝 Things To Do',
  description: 'Shared to-do lists',
};

export default function TodoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

- [ ] **Step 3: Colour helper** — `src/components/todo/todo-colors.ts`:
```ts
// Deterministic pastel hue per assignee so their initial chip is stable across
// lines and reloads. Pure — no React import.
export function colorForEmail(email: string): string {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 45%)`;
}

export function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}
```

- [ ] **Step 4: Notepad frame** — `src/components/todo/NotepadFrame.tsx` (the faithful chrome: rainbow top/bottom stripes, teal chevron side columns, handwriting title + chevron accents). Reused full-size on the list page and `mini` on index cards.
```tsx
import React from 'react';

export default function NotepadFrame({
  title = 'Things To Do',
  headerRight,
  mini = false,
  children,
}: {
  title?: React.ReactNode;
  headerRight?: React.ReactNode;
  mini?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`todo-notepad ${mini ? 'todo-notepad--mini' : ''}`}>
      <div className="todo-stripe todo-stripe--top" aria-hidden />
      <div className="todo-notepad-body">
        <div className="todo-chevron-col todo-chevron-col--left" aria-hidden />
        <div className="todo-notepad-content">
          <div className="todo-notepad-header">
            <span className="todo-title-chevrons" aria-hidden>›› ›</span>
            <h1 className="todo-notepad-title">{title}</h1>
            {headerRight ? <div className="todo-notepad-header-actions">{headerRight}</div> : null}
          </div>
          {children}
        </div>
        <div className="todo-chevron-col todo-chevron-col--right" aria-hidden />
      </div>
      <div className="todo-stripe todo-stripe--bottom" aria-hidden />
    </div>
  );
}
```

- [ ] **Step 5: Stylesheet** — `src/app/todo/todo.css`. The notepad frame is forced `direction: ltr` (a Latin product); task text uses `unicode-bidi: plaintext` so Hebrew renders RTL within an LTR line, and the checkbox sits at the inline-end.
```css
/* Shared ToDo — the "Things To Do" notepad. Frame is LTR to match the paper
   product; individual task text auto-directions via unicode-bidi: plaintext. */
.todo-page {
  --hand: var(--font-hand), 'Segoe Print', 'Bradley Hand', cursive;
  --rule: #c9d3d8;
  --ink: #33484f;
  --teal: #4db6ac;
  max-width: 760px;
  margin: 0 auto;
  padding: 1.25rem 1rem 4rem;
}

.todo-page-heading {
  font-family: var(--hand);
  color: var(--teal);
  font-size: 2rem;
  text-align: center;
  margin: 0.5rem 0 1.25rem;
}

/* --- Notepad --- */
.todo-notepad {
  direction: ltr;
  position: relative;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}
.todo-stripe {
  height: 16px;
  background: repeating-linear-gradient(
    45deg,
    #7cc242 0 22px, #b6d957 22px 44px, #f4d23c 44px 66px,
    #f2a13c 66px 88px, #ee6d5a 88px 110px, #e94f8a 110px 132px, #7fd0c4 132px 154px
  );
}
.todo-notepad-body { display: flex; }
.todo-chevron-col {
  flex: 0 0 26px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='22' viewBox='0 0 16 22'%3E%3Cpath d='M3 2 L13 11 L3 20' fill='none' stroke='%234db6ac' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: repeat-y;
  background-position: center;
  opacity: 0.9;
}
.todo-chevron-col--left { transform: scaleX(-1); }
.todo-notepad-content { flex: 1 1 auto; padding: 0.75rem 0.75rem 1.25rem; min-width: 0; }

.todo-notepad-header {
  display: flex; align-items: center; gap: 0.5rem;
  margin-bottom: 0.75rem; flex-wrap: wrap;
}
.todo-title-chevrons { color: var(--teal); font-weight: 700; letter-spacing: 2px; }
.todo-notepad-title {
  font-family: var(--hand);
  color: var(--teal);
  font-size: 2rem;
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
}
.todo-notepad-title input {
  font: inherit; color: inherit; border: none; background: transparent;
  width: 100%; outline: none; border-bottom: 1px dashed transparent;
}
.todo-notepad-title input:focus { border-bottom-color: var(--rule); }
.todo-notepad-header-actions { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }

/* --- Task lines --- */
.todo-lines { list-style: none; margin: 0; padding: 0; }
.todo-line {
  display: flex; align-items: center; gap: 0.5rem;
  min-height: 2.4rem; padding: 0.15rem 0;
  border-bottom: 1px solid var(--rule);
  cursor: pointer;
}
.todo-text {
  flex: 1 1 auto; min-width: 0;
  font-family: var(--hand); font-size: 1.35rem; line-height: 1.3; color: var(--ink);
  unicode-bidi: plaintext; text-align: start;
  overflow-wrap: anywhere;
}
.todo-line.done .todo-text { text-decoration: line-through; opacity: 0.45; }

.todo-due { font-size: 0.8rem; color: #90a4ae; white-space: nowrap; }
.todo-due.overdue { color: #e53935; font-weight: 600; }

.todo-assignees { display: flex; gap: 2px; flex-shrink: 0; }
.todo-chip {
  width: 20px; height: 20px; border-radius: 50%;
  color: #fff; font-size: 0.7rem; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center;
}

/* Checkbox square at the line's inline-end, echoing the paper's boxes. */
.todo-check {
  flex-shrink: 0; width: 22px; height: 22px; border: 2px solid #90a4ae;
  border-radius: 4px; background: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--teal); font-size: 1rem; line-height: 1; padding: 0;
}
.todo-check[aria-checked='true'] { border-color: var(--teal); }

/* Add-task row */
.todo-add { display: flex; align-items: center; gap: 0.5rem; min-height: 2.4rem; border-bottom: 1px solid var(--rule); }
.todo-add input {
  flex: 1 1 auto; border: none; outline: none; background: transparent;
  font-family: var(--hand); font-size: 1.35rem; color: var(--ink);
  unicode-bidi: plaintext; text-align: start;
}
.todo-add input::placeholder { color: #b0bec5; }

/* Toolbar (sort / renew / history) */
.todo-toolbar { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; margin: 0.25rem 0 0.75rem; }
.todo-btn {
  font: inherit; font-size: 0.85rem; border: 1px solid var(--rule); background: #fff;
  border-radius: 999px; padding: 0.3rem 0.7rem; cursor: pointer; color: var(--ink);
}
.todo-btn:hover { background: #f5f7f8; }
.todo-btn--active { background: var(--teal); border-color: var(--teal); color: #fff; }
.todo-btn--danger { color: #e53935; border-color: #f2b8b5; }

/* Index cards */
.todo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
.todo-notepad--mini .todo-notepad-title { font-size: 1.4rem; }
.todo-notepad--mini .todo-notepad-content { padding: 0.5rem 0.6rem 0.8rem; }
.todo-card-link { text-decoration: none; color: inherit; display: block; }
.todo-card-meta { font-family: var(--hand); font-size: 1.05rem; color: var(--ink); line-height: 1.5; }
.todo-card-progress { font-size: 0.8rem; color: #90a4ae; margin-top: 0.4rem; }

/* My tasks */
.todo-mytasks { margin-top: 2rem; }
.todo-mytasks h2 { font-family: var(--hand); color: var(--teal); font-size: 1.5rem; margin: 0 0 0.5rem; }
.todo-mytasks ul { list-style: none; margin: 0; padding: 0; }
.todo-mytasks li { display: flex; gap: 0.5rem; align-items: baseline; padding: 0.35rem 0; border-bottom: 1px solid var(--rule); }
.todo-mytasks .todo-text { font-size: 1.1rem; }
.todo-mytasks a { text-decoration: none; color: #90a4ae; font-size: 0.8rem; white-space: nowrap; }

/* Modal */
.todo-modal-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 1000;
}
.todo-modal {
  direction: rtl; background: #fff; border-radius: 14px; width: min(520px, 100%);
  max-height: 90vh; overflow-y: auto; padding: 1.25rem; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}
.todo-modal h2 { margin: 0 0 1rem; font-size: 1.2rem; }
.todo-field { margin-bottom: 1rem; }
.todo-field label { display: block; font-size: 0.85rem; color: #607d8b; margin-bottom: 0.3rem; }
.todo-field input[type='text'], .todo-field input[type='date'], .todo-field textarea {
  width: 100%; padding: 0.5rem; border: 1px solid var(--rule); border-radius: 8px; font: inherit; box-sizing: border-box;
}
.todo-field textarea { min-height: 4rem; resize: vertical; }
.todo-members { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.todo-member-pill {
  display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.3rem 0.6rem;
  border: 1px solid var(--rule); border-radius: 999px; cursor: pointer; font-size: 0.9rem;
}
.todo-member-pill.selected { background: var(--teal); border-color: var(--teal); color: #fff; }
.todo-modal-actions { display: flex; gap: 0.5rem; justify-content: space-between; margin-top: 1rem; flex-wrap: wrap; }
.todo-modal-actions .spacer { flex: 1 1 auto; }

@media (max-width: 480px) {
  .todo-notepad-title, .todo-page-heading { font-size: 1.6rem; }
  .todo-text, .todo-add input { font-size: 1.2rem; }
  .todo-chevron-col { flex-basis: 16px; }
}
```

- [ ] **Step 6: Favicon** — `src/app/todo/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#fff"/><rect x="4" y="3" width="24" height="5" fill="#7cc242"/><path d="M7 15 h14 M7 21 h14" stroke="#c9d3d8" stroke-width="2" stroke-linecap="round"/><path d="M23 12 l2.2 2.2 L29 10" fill="none" stroke="#4db6ac" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 18 l2.2 2.2 L29 16" fill="none" stroke="#4db6ac" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
```

- [ ] **Step 7: Verify + commit**

Run: `npx tsc --noEmit --incremental false --pretty false` then `npm run lint`
```bash
git add src/app/todo/fonts.ts src/app/todo/layout.tsx src/app/todo/todo.css src/app/todo/icon.svg src/components/todo/NotepadFrame.tsx src/components/todo/todo-colors.ts
git commit -m "feat(todo): notepad chrome — fonts, css, frame, favicon"
```

---

### Task 12: Index page + New-list modal + My tasks

**Files:**
- Create: `src/components/todo/NewListModal.tsx`
- Create: `src/app/todo/page.tsx`

**Interfaces:**
- Consumes: `NotepadFrame`, `colorForEmail`/`initialOf`, `caveat`, `getUserDisplayName`, `hasPermission`, model types, `formatDueLabel`/`isOverdue`.
- Produces: `NewListModal` (`{ onClose, onCreated(list) }`); the `/todo` index page.

- [ ] **Step 1: New-list modal** — `src/components/todo/NewListModal.tsx`:
```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { TodoList, TodoMember } from '@/types/todo';
import { getUserDisplayName } from '@/types/workout';

export default function NewListModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (list: TodoList) => void;
}) {
  const { data: session } = useSession();
  const myEmail = (session?.user?.email ?? '').toLowerCase();
  const [members, setMembers] = useState<TodoMember[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/todo/members')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: TodoMember[]) => setMembers(rows))
      .catch(() => setMembers([]));
  }, []);

  const toggle = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      return next;
    });
  };

  const create = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/todo/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), members: [...selected] }),
      });
      if (res.ok) onCreated(await res.json());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="todo-modal-backdrop" onClick={onClose}>
      <div className="todo-modal" onClick={(e) => e.stopPropagation()}>
        <h2>רשימה חדשה</h2>
        <div className="todo-field">
          <label>שם הרשימה</label>
          <input type="text" value={name} autoFocus onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
        </div>
        <div className="todo-field">
          <label>חברים ברשימה</label>
          <div className="todo-members">
            {members.filter((m) => m.email !== myEmail).map((m) => (
              <button
                type="button"
                key={m.email}
                className={`todo-member-pill ${selected.has(m.email) ? 'selected' : ''}`}
                onClick={() => toggle(m.email)}
              >
                {m.name || getUserDisplayName(m.email)}
              </button>
            ))}
          </div>
        </div>
        <div className="todo-modal-actions">
          <button className="todo-btn" onClick={onClose}>ביטול</button>
          <div className="spacer" />
          <button className="todo-btn todo-btn--active" onClick={create} disabled={!name.trim() || saving}>
            {saving ? '…' : 'צור רשימה'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Index page** — `src/app/todo/page.tsx`:
```tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import NotepadFrame from '@/components/todo/NotepadFrame';
import NewListModal from '@/components/todo/NewListModal';
import { colorForEmail, initialOf } from '@/components/todo/todo-colors';
import { caveat } from '@/app/todo/fonts';
import { hasPermission } from '@/lib/permissions';
import { getUserDisplayName } from '@/types/workout';
import { formatDueLabel, isOverdue } from '@/lib/todo-date';
import type { TodoList, TodoTask } from '@/types/todo';

export default function TodoIndexPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [lists, setLists] = useState<TodoList[]>([]);
  const [myTasks, setMyTasks] = useState<TodoTask[]>([]);
  const [creating, setCreating] = useState(false);

  const allowed = hasPermission(session, 'todo');

  const load = useCallback(async () => {
    if (!allowed) return;
    const [l, t] = await Promise.all([
      fetch('/api/todo/lists').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/todo/my-tasks').then((r) => (r.ok ? r.json() : [])),
    ]);
    setLists(l);
    setMyTasks(t);
  }, [allowed]);

  useEffect(() => { load(); }, [load]);

  // Refetch when the tab regains focus so a change made elsewhere shows up.
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  // Belt-and-suspenders redirect (middleware already gates the route).
  useEffect(() => {
    if (status !== 'loading' && !allowed) router.replace('/');
  }, [status, allowed, router]);

  const nameFor = (listId: string) => lists.find((l) => l.id === listId)?.name ?? '';

  if (status === 'loading' || !allowed) {
    return (<><Navbar /><div className="todo-page" /></>);
  }

  return (
    <>
      <Navbar />
      <div className={`todo-page ${caveat.variable}`}>
        <h1 className="todo-page-heading">Things To Do</h1>

        <div className="todo-toolbar">
          <button className="todo-btn todo-btn--active" onClick={() => setCreating(true)}>+ רשימה חדשה</button>
        </div>

        <div className="todo-grid">
          {lists.map((list) => (
            <Link key={list.id} href={`/todo/${list.id}`} className="todo-card-link">
              <NotepadFrame title={list.name} mini>
                <div className="todo-card-meta">
                  <div className="todo-assignees">
                    {list.members.map((email) => (
                      <span key={email} className="todo-chip" style={{ background: colorForEmail(email) }}
                        title={getUserDisplayName(email)}>
                        {initialOf(getUserDisplayName(email))}
                      </span>
                    ))}
                  </div>
                  <div className="todo-card-progress">{list.members.length} חברים</div>
                </div>
              </NotepadFrame>
            </Link>
          ))}
          {lists.length === 0 && (
            <p style={{ color: '#90a4ae' }}>אין עדיין רשימות. צרו את הראשונה!</p>
          )}
        </div>

        {myTasks.length > 0 && (
          <div className="todo-mytasks">
            <h2>המשימות שלי</h2>
            <ul>
              {myTasks
                .slice()
                .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
                .map((t) => (
                  <li key={t.id}>
                    <span className="todo-text">{t.text}</span>
                    {t.dueDate && (
                      <span className={`todo-due ${isOverdue(t.dueDate) ? 'overdue' : ''}`}>
                        {formatDueLabel(t.dueDate)}
                      </span>
                    )}
                    <Link href={`/todo/${t.listId}`}>{nameFor(t.listId) || 'רשימה'} ←</Link>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>

      {creating && (
        <NewListModal
          onClose={() => setCreating(false)}
          onCreated={(list) => { setCreating(false); router.push(`/todo/${list.id}`); }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit --incremental false --pretty false` then `npm run lint`
```bash
git add src/components/todo/NewListModal.tsx src/app/todo/page.tsx
git commit -m "feat(todo): index page with list cards, my-tasks, new-list modal"
```

---

### Task 13a: Task modal, history modal, settings modal

**Files:**
- Create: `src/components/todo/TaskModal.tsx`
- Create: `src/components/todo/ArchiveHistory.tsx`
- Create: `src/components/todo/ListSettingsModal.tsx`

**Interfaces:**
- Produces:
  - `TaskModal` — `{ listId, task, members: string[], onClose, onSaved(task), onDeleted(taskId) }`
  - `ArchiveHistory` — `{ listId, onClose }`
  - `ListSettingsModal` — `{ list, isCreator, onClose, onSaved(list), onDeleted() }`

- [ ] **Step 1: TaskModal** — `src/components/todo/TaskModal.tsx`:
```tsx
'use client';

import React, { useState } from 'react';
import type { TodoTask } from '@/types/todo';
import { getUserDisplayName } from '@/types/workout';

export default function TaskModal({
  listId,
  task,
  members,
  onClose,
  onSaved,
  onDeleted,
}: {
  listId: string;
  task: TodoTask;
  members: string[];
  onClose: () => void;
  onSaved: (task: TodoTask) => void;
  onDeleted: (taskId: string) => void;
}) {
  const [text, setText] = useState(task.text);
  const [assignees, setAssignees] = useState<string[]>(task.assignees);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [description, setDescription] = useState(task.description ?? '');
  const [busy, setBusy] = useState(false);

  const toggle = (email: string) =>
    setAssignees((prev) => (prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]));

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/todo/lists/${listId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim() || task.text,
          assignees,
          dueDate: dueDate ? dueDate : null,
          description: description.trim() ? description.trim() : null,
        }),
      });
      if (res.ok) onSaved(await res.json());
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/todo/lists/${listId}/tasks/${task.id}`, { method: 'DELETE' });
      if (res.ok) onDeleted(task.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="todo-modal-backdrop" onClick={onClose}>
      <div className="todo-modal" onClick={(e) => e.stopPropagation()}>
        <h2>עריכת משימה</h2>
        <div className="todo-field">
          <label>משימה</label>
          <input type="text" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="todo-field">
          <label>אחראים</label>
          <div className="todo-members">
            {members.map((email) => (
              <button type="button" key={email}
                className={`todo-member-pill ${assignees.includes(email) ? 'selected' : ''}`}
                onClick={() => toggle(email)}>
                {getUserDisplayName(email)}
              </button>
            ))}
          </div>
        </div>
        <div className="todo-field">
          <label>תאריך יעד</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="todo-field">
          <label>תיאור</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="todo-modal-actions">
          <button className="todo-btn todo-btn--danger" onClick={remove} disabled={busy}>מחק</button>
          <div className="spacer" />
          <button className="todo-btn" onClick={onClose}>סגור</button>
          <button className="todo-btn todo-btn--active" onClick={save} disabled={busy}>שמור</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ArchiveHistory** — `src/components/todo/ArchiveHistory.tsx`:
```tsx
'use client';

import React, { useEffect, useState } from 'react';
import type { TodoArchive } from '@/types/todo';

export default function ArchiveHistory({ listId, onClose }: { listId: string; onClose: () => void }) {
  const [archives, setArchives] = useState<TodoArchive[] | null>(null);

  useEffect(() => {
    fetch(`/api/todo/lists/${listId}/archives`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setArchives)
      .catch(() => setArchives([]));
  }, [listId]);

  return (
    <div className="todo-modal-backdrop" onClick={onClose}>
      <div className="todo-modal" onClick={(e) => e.stopPropagation()}>
        <h2>היסטוריה</h2>
        {archives === null && <p>טוען…</p>}
        {archives && archives.length === 0 && <p>עדיין אין חידושים.</p>}
        {archives && archives.map((a) => {
          const doneCount = a.tasks.filter((t) => t.done).length;
          return (
            <div key={a.id} className="todo-field">
              <label>{new Date(a.renewedAt).toLocaleDateString('he-IL')} · {doneCount}/{a.tasks.length} הושלמו</label>
              <ul className="todo-lines">
                {a.tasks.map((t, i) => (
                  <li key={i} className={`todo-line ${t.done ? 'done' : ''}`} style={{ cursor: 'default' }}>
                    <span className="todo-text">{t.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <div className="todo-modal-actions">
          <div className="spacer" />
          <button className="todo-btn" onClick={onClose}>סגור</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: ListSettingsModal** — `src/components/todo/ListSettingsModal.tsx`:
```tsx
'use client';

import React, { useEffect, useState } from 'react';
import type { TodoList, TodoMember } from '@/types/todo';
import { getUserDisplayName } from '@/types/workout';

export default function ListSettingsModal({
  list,
  isCreator,
  onClose,
  onSaved,
  onDeleted,
}: {
  list: TodoList;
  isCreator: boolean;
  onClose: () => void;
  onSaved: (list: TodoList) => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(list.name);
  const [members, setMembers] = useState<string[]>(list.members);
  const [directory, setDirectory] = useState<TodoMember[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isCreator) return;
    fetch('/api/todo/members').then((r) => (r.ok ? r.json() : [])).then(setDirectory).catch(() => setDirectory([]));
  }, [isCreator]);

  const toggle = (email: string) => {
    if (email === list.createdBy) return; // creator is always a member
    setMembers((prev) => (prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]));
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {};
      if (name.trim() && name.trim() !== list.name) body.name = name.trim();
      if (isCreator) body.members = members;
      const res = await fetch(`/api/todo/lists/${list.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) onSaved(await res.json());
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy || !isCreator) return;
    if (!window.confirm('למחוק את הרשימה לצמיתות?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/todo/lists/${list.id}`, { method: 'DELETE' });
      if (res.ok) onDeleted();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="todo-modal-backdrop" onClick={onClose}>
      <div className="todo-modal" onClick={(e) => e.stopPropagation()}>
        <h2>הגדרות רשימה</h2>
        <div className="todo-field">
          <label>שם</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {isCreator && (
          <div className="todo-field">
            <label>חברים</label>
            <div className="todo-members">
              {directory.map((m) => (
                <button type="button" key={m.email}
                  className={`todo-member-pill ${members.includes(m.email) ? 'selected' : ''}`}
                  onClick={() => toggle(m.email)}
                  disabled={m.email === list.createdBy}>
                  {m.name || getUserDisplayName(m.email)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="todo-modal-actions">
          {isCreator && <button className="todo-btn todo-btn--danger" onClick={remove} disabled={busy}>מחק רשימה</button>}
          <div className="spacer" />
          <button className="todo-btn" onClick={onClose}>סגור</button>
          <button className="todo-btn todo-btn--active" onClick={save} disabled={busy}>שמור</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit --incremental false --pretty false` then `npm run lint`
```bash
git add src/components/todo/TaskModal.tsx src/components/todo/ArchiveHistory.tsx src/components/todo/ListSettingsModal.tsx
git commit -m "feat(todo): task, history, and settings modals"
```

---

### Task 13b: List notepad page

**Files:**
- Create: `src/app/todo/[listId]/page.tsx`

**Interfaces:**
- Consumes: everything from Tasks 11–13a, `sortTasks`, `parseQuickAdd`, `formatDueLabel`/`isOverdue`, `TODO_SORT_OPTIONS`.

- [ ] **Step 1: Write the page** — `src/app/todo/[listId]/page.tsx`:
```tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import NotepadFrame from '@/components/todo/NotepadFrame';
import TaskModal from '@/components/todo/TaskModal';
import ArchiveHistory from '@/components/todo/ArchiveHistory';
import ListSettingsModal from '@/components/todo/ListSettingsModal';
import { colorForEmail, initialOf } from '@/components/todo/todo-colors';
import { caveat } from '@/app/todo/fonts';
import { getUserDisplayName } from '@/types/workout';
import { sortTasks } from '@/lib/todo-sort';
import { parseQuickAdd } from '@/lib/todo-quickadd';
import { formatDueLabel, isOverdue } from '@/lib/todo-date';
import { TODO_SORT_OPTIONS, type TodoList, type TodoTask, type TodoSortBy, type TodoMember } from '@/types/todo';

const SORT_LABEL: Record<TodoSortBy, string> = { created: 'נוצר', dueDate: 'יעד', assignee: 'אחראי' };

export default function TodoListPage() {
  const params = useParams<{ listId: string }>();
  const listId = params.listId;
  const router = useRouter();
  const { data: session } = useSession();
  const myEmail = (session?.user?.email ?? '').toLowerCase();

  const [list, setList] = useState<TodoList | null>(null);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [archiveCount, setArchiveCount] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<TodoTask | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Pause polling while any modal is open so it can't stomp an in-progress edit.
  const modalOpen = !!editing || showHistory || showSettings;
  const modalOpenRef = useRef(modalOpen);
  modalOpenRef.current = modalOpen;

  const load = useCallback(async () => {
    const res = await fetch(`/api/todo/lists/${listId}`);
    if (res.status === 404) { setNotFound(true); return; }
    if (!res.ok) return;
    const detail = await res.json();
    setList(detail.list);
    setTasks(detail.tasks);
    setArchiveCount(detail.archiveCount);
  }, [listId]);

  useEffect(() => { load(); }, [load]);

  // Light polling + focus refetch, paused while a modal is open.
  useEffect(() => {
    const tick = () => { if (!modalOpenRef.current && document.visibilityState === 'visible') load(); };
    const id = window.setInterval(tick, 15000);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(id); window.removeEventListener('focus', tick); };
  }, [load]);

  const members: TodoMember[] = useMemo(
    () => (list?.members ?? []).map((email) => ({ email, name: getUserDisplayName(email) })),
    [list?.members],
  );

  const sorted = useMemo(
    () => (list ? sortTasks(tasks, list.sortBy, getUserDisplayName) : tasks),
    [tasks, list],
  );

  const toggleDone = async (task: TodoTask) => {
    const next = !task.done;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: next } : t)));
    const res = await fetch(`/api/todo/lists/${listId}/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: next }),
    });
    if (!res.ok) { load(); return; }
    const updated = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
  };

  const addTask = async () => {
    const raw = draft.trim();
    if (!raw) return;
    const parsed = parseQuickAdd(raw, members, new Date());
    setDraft('');
    const res = await fetch(`/api/todo/lists/${listId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: parsed.text || raw, assignees: parsed.assignees, dueDate: parsed.dueDate }),
    });
    if (res.ok) setTasks((prev) => [...prev, await res.json()]);
    else load();
  };

  const changeSort = async (sortBy: TodoSortBy) => {
    if (!list) return;
    setList({ ...list, sortBy });
    await fetch(`/api/todo/lists/${listId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sortBy }),
    });
  };

  const renew = async () => {
    if (!window.confirm('לחדש את הרשימה? המשימות שהושלמו יעברו להיסטוריה.')) return;
    const res = await fetch(`/api/todo/lists/${listId}/renew`, { method: 'POST' });
    if (res.ok) load();
  };

  if (notFound) {
    return (<><Navbar /><div className="todo-page"><p>הרשימה לא נמצאה.</p></div></>);
  }
  if (!list) {
    return (<><Navbar /><div className="todo-page" /></>);
  }

  const isCreator = list.createdBy.toLowerCase() === myEmail;

  return (
    <>
      <Navbar />
      <div className={`todo-page ${caveat.variable}`}>
        <div className="todo-toolbar">
          <span style={{ color: '#90a4ae', fontSize: '0.85rem' }}>מיון:</span>
          {TODO_SORT_OPTIONS.map((s) => (
            <button key={s} className={`todo-btn ${list.sortBy === s ? 'todo-btn--active' : ''}`}
              onClick={() => changeSort(s)}>{SORT_LABEL[s]}</button>
          ))}
          <div style={{ flex: '1 1 auto' }} />
          <button className="todo-btn" onClick={renew}>♻︎ חדש</button>
          <button className="todo-btn" onClick={() => setShowHistory(true)}>היסטוריה{archiveCount ? ` (${archiveCount})` : ''}</button>
          <button className="todo-btn" onClick={() => setShowSettings(true)}>⚙︎</button>
        </div>

        <NotepadFrame title={list.name}>
          <ul className="todo-lines">
            {sorted.map((task) => (
              <li key={task.id} className={`todo-line ${task.done ? 'done' : ''}`}
                onClick={() => setEditing(task)}>
                <button className="todo-check" role="checkbox" aria-checked={task.done}
                  aria-label={task.done ? 'בטל השלמה' : 'סמן כהושלם'}
                  onClick={(e) => { e.stopPropagation(); toggleDone(task); }}>
                  {task.done ? '✓' : ''}
                </button>
                <span className="todo-text">{task.text}</span>
                {task.assignees.length > 0 && (
                  <span className="todo-assignees">
                    {task.assignees.map((email) => (
                      <span key={email} className="todo-chip" style={{ background: colorForEmail(email) }}
                        title={getUserDisplayName(email)}>{initialOf(getUserDisplayName(email))}</span>
                    ))}
                  </span>
                )}
                {task.dueDate && (
                  <span className={`todo-due ${isOverdue(task.dueDate) ? 'overdue' : ''}`}>
                    {formatDueLabel(task.dueDate)}
                  </span>
                )}
              </li>
            ))}
            <li className="todo-add">
              <span className="todo-check" aria-hidden style={{ visibility: 'hidden' }} />
              <input value={draft} placeholder="הוספת משימה…  (@שם ‎!friday)"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }} />
            </li>
          </ul>
        </NotepadFrame>
      </div>

      {editing && (
        <TaskModal
          listId={listId}
          task={editing}
          members={list.members}
          onClose={() => setEditing(null)}
          onSaved={(t) => { setTasks((prev) => prev.map((x) => (x.id === t.id ? t : x))); setEditing(null); }}
          onDeleted={(taskId) => { setTasks((prev) => prev.filter((x) => x.id !== taskId)); setEditing(null); }}
        />
      )}
      {showHistory && <ArchiveHistory listId={listId} onClose={() => setShowHistory(false)} />}
      {showSettings && (
        <ListSettingsModal
          list={list}
          isCreator={isCreator}
          onClose={() => setShowSettings(false)}
          onSaved={(l) => { setList(l); setShowSettings(false); }}
          onDeleted={() => router.push('/todo')}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit --incremental false --pretty false` then `npm run lint`
```bash
git add src/app/todo/\[listId\]/page.tsx
git commit -m "feat(todo): list notepad page — lines, checkmarks, sort, renew, quick-add"
```

---

### Task 14: Wire into home grid + navbar, full verification

**Files:**
- Modify: `src/app/page.tsx` (`allFeatures`)
- Modify: `src/components/Navbar.tsx` (`allNavItems` + icon import)

- [ ] **Step 1: Add the icon import to the home page** — in `src/app/page.tsx`, add `FaTasks` to the `react-icons/fa` import:
```ts
import { FaDog, FaCoffee, FaMugHot, FaVideo, FaDumbbell, FaRing, FaPlane, FaSpa, FaHeart, FaBell, FaSignInAlt, FaTasks } from 'react-icons/fa';
```

- [ ] **Step 2: Add the feature card** — append to `allFeatures` (after the `paging` entry):
```ts
  { icon: FaTasks,    title: 'רשימות משימות',     description: 'רשימות מטלות משותפות עם צ׳קמארקים',   href: '/todo',                     linkText: 'לרשימות',            permission: 'todo'        },
```

- [ ] **Step 3: Add the nav icon import** — in `src/components/Navbar.tsx`, add `FaTasks` to the `react-icons/fa` import (alongside the existing icons).

- [ ] **Step 4: Add the nav item** — append to `allNavItems` (after the `paging` entry, before the owner admin items):
```ts
  { href: '/todo',                     label: 'משימות',        icon: FaTasks,      visibility: { permission: 'todo'        } },
```

- [ ] **Step 5: Full verification** (the pre-commit hook runs test + build, but verify first)

Run each and confirm clean:
```bash
npx tsc --noEmit --incremental false --pretty false
npm run lint
npm test
npm run build
```
Expected: tsc clean; lint clean; all `todo-*` tests pass alongside the existing suites; build succeeds. (The build logs ~10 Mongo "bad auth" lines from stale local creds — that is pre-existing and does NOT fail the build. If `.next` is stuck, `rm -rf .next` and rebuild.)

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/components/Navbar.tsx
git commit -m "feat(todo): add To-Do to home grid and navbar"
```

- [ ] **Step 7: Hand off to `/ship`** — run the project's `/ship` command to run the standards + spec code-review, apply findings, and push the branch.

---

## Self-Review (author checklist — completed)

**1. Spec coverage:**
- Multiple lists, member selection → Task 6 (`createList` with members), Task 8, Task 12 (NewListModal). ✓
- Create/assign tasks; text on the page; click → modal (assignee, due, description, delete, all optional) → Task 9, Task 13a (TaskModal), Task 13b. ✓
- Checkmark + strike-through on done → Task 13b (`toggleDone`, `.todo-line.done` css). ✓
- Renew = archive history + keep non-done → Task 6 (`renewList`), Task 10, Task 13b (`renew`), Task 13a (ArchiveHistory). ✓
- Sort by created / due / assignee → Task 4 (`sortTasks`), Task 13b (sort control, persisted via PATCH). ✓
- Clean text + checkmarks, faithful colourful notepad → Task 11 (NotepadFrame + todo.css). ✓
- Handwriting font → Task 11 (Caveat via `--font-hand`). ✓
- Extras: My tasks (Task 7 + 12), refresh-on-focus + polling (Task 12 + 13b), optimistic checkbox (Task 13b), overdue red (Task 3 + css), ntfy push (Task 7 + 9), quick-add (Task 2 + 13b). ✓
- Collaborative access, creator-only membership/delete → Task 7 (`requireListMember`), Task 8 (PATCH/DELETE guards). ✓

**2. Placeholder scan:** No TBD/TODO; every code step carries complete code. ✓

**3. Type consistency:** `sortTasks(tasks, sortBy, nameOf)`, `parseQuickAdd(raw, members, today)`, `requireListMember → {session,email,list}`, `notifyAssignment(topic,{taskText,assignees,byEmail})`, `TodoListDetail{list,tasks,archiveCount}`, `updateTask` patch shape (dueDate/description `string|null`) — all consistent across model, routes, and pages. ✓

**Known follow-ups (out of MVP, noted in spec):** scheduled "due today" ntfy reminders need a cron; per-card open-task counts omitted (cards show members) to avoid an aggregation; per-list colour themes skipped.

