import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortTasks } from '../todo-sort.ts';
import type { TodoTask } from '../../types/todo.ts';

function task(p: Partial<TodoTask> & { id: string; createdAt: string }): TodoTask {
  return {
    listId: 'L', column: 0, text: p.id, assignees: [], done: false,
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
