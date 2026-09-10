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
