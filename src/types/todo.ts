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
