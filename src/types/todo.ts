// Public types + DTOs for the Shared ToDo feature. Import-free so the pure
// helpers (todo-quickadd, todo-sort, todo-date) and their node --test suites
// can import it via a relative `.ts` path without the `@/` alias.

export type TodoSortBy = 'created' | 'dueDate' | 'assignee';

export const TODO_SORT_OPTIONS: readonly TodoSortBy[] = ['created', 'dueDate', 'assignee'];

export function isTodoSortBy(v: unknown): v is TodoSortBy {
  return v === 'created' || v === 'dueDate' || v === 'assignee';
}

// A notepad has two side-by-side columns — two independent sub-lists on one
// page. A task belongs to exactly one column and never moves on its own.
export type TodoColumn = 0 | 1;

export function normalizeColumn(v: unknown): TodoColumn {
  return v === 1 ? 1 : 0;
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
  column: TodoColumn;         // which of the two sub-lists this task lives in
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
  column: TodoColumn;
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

// Slim member record for the picker (from /api/todo/members). `image` is the
// Google avatar URL when the user has signed in at least once (absent for
// allowlisted addresses that never logged in).
export interface TodoMember {
  email: string;
  name: string;
  image?: string;
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
  column?: TodoColumn;
  assignees?: string[];
  dueDate?: string;
  description?: string;
}

export interface UpdateTaskDto {
  text?: string;
  column?: TodoColumn;
  assignees?: string[];
  dueDate?: string | null;    // null clears the due date
  description?: string | null;// null clears the description
  done?: boolean;
}

// --- Shared request validation (used by the task route handlers) ---

// A bare 'YYYY-MM-DD' string. Shape check only — not calendar validity.
export function isYmd(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

// Keep only assignees that are strings AND members of the list, de-duplicated.
export function sanitizeAssignees(input: unknown, members: string[]): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter((e): e is string => typeof e === 'string' && members.includes(e)))];
}
