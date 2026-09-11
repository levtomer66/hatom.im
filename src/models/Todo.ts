import { ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import clientPromise from '@/lib/mongodb';
import { normalizeColumn } from '@/types/todo';
import type { TodoList, TodoTask, TodoArchive, ArchivedTask, TodoSortBy, TodoColumn } from '@/types/todo';

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
function toTask(d: TodoTaskDocument): TodoTask {
  const { _id, ...r } = d;
  // Legacy tasks (pre-columns) default to column 0 via the shared rule.
  return { ...r, id: _id!.toString(), column: normalizeColumn(r.column) };
}
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
  input: { text: string; column: TodoColumn; assignees: string[]; dueDate?: string; description?: string; createdBy: string },
): Promise<TodoTask> {
  const col = await tasksCol();
  const now = new Date().toISOString();
  const doc: Omit<TodoTaskDocument, '_id'> = {
    listId, column: input.column, text: input.text, assignees: input.assignees,
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
    column?: TodoColumn;
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
    if (patch.column !== undefined) set.column = patch.column;
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
    column: normalizeColumn(d.column),
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
