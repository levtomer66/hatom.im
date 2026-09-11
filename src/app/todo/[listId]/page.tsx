'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import NotepadFrame from '@/components/todo/NotepadFrame';
import TaskModal from '@/components/todo/TaskModal';
import ArchiveHistory from '@/components/todo/ArchiveHistory';
import ListSettingsModal from '@/components/todo/ListSettingsModal';
import Avatar from '@/components/todo/Avatar';
import { caveat, hebrewHand } from '@/app/todo/fonts';
import { getUserDisplayName } from '@/types/workout';
import { sortTasks } from '@/lib/todo-sort';
import { parseQuickAdd } from '@/lib/todo-quickadd';
import { formatDueLabel, isOverdue } from '@/lib/todo-date';
import { TODO_SORT_OPTIONS, type TodoList, type TodoTask, type TodoSortBy, type TodoMember, type TodoColumn } from '@/types/todo';

const SORT_LABEL: Record<TodoSortBy, string> = { created: 'נוצר', dueDate: 'יעד', assignee: 'אחראי' };
const MIN_ROWS = 14; // pre-drawn ruled lines per column, like the paper notepad

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
  const [drafts, setDrafts] = useState<[string, string]>(['', '']);
  const [nameDraft, setNameDraft] = useState('');
  const [memberMap, setMemberMap] = useState<Record<string, TodoMember>>({});
  const [editing, setEditing] = useState<TodoTask | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([null, null]);

  // Pause polling while any modal is open so it can't stomp an in-progress edit.
  const modalOpen = !!editing || showHistory || showSettings;
  const modalOpenRef = useRef(modalOpen);
  modalOpenRef.current = modalOpen;
  // Count of in-flight optimistic task adds — polling is paused while >0 so a
  // refetch can't briefly drop the not-yet-persisted row.
  const pendingAddsRef = useRef(0);

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

  useEffect(() => {
    fetch('/api/todo/members')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: TodoMember[]) => {
        const map: Record<string, TodoMember> = {};
        for (const m of rows) map[m.email] = m;
        setMemberMap(map);
      })
      .catch(() => setMemberMap({}));
  }, []);

  useEffect(() => {
    const tick = () => {
      if (!modalOpenRef.current && pendingAddsRef.current === 0 && document.visibilityState === 'visible') load();
    };
    const id = window.setInterval(tick, 15000);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(id); window.removeEventListener('focus', tick); };
  }, [load]);

  const listName = list?.name;
  useEffect(() => { if (listName != null) setNameDraft(listName); }, [listName]);

  const commitName = async () => {
    const next = nameDraft.trim();
    if (!list) return;
    if (!next || next === list.name) { setNameDraft(list.name); return; }
    setList({ ...list, name: next });
    await fetch(`/api/todo/lists/${listId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: next }),
    });
  };

  // Any app account can be tagged (tagging shares the list), so the assignee
  // picker + quick-add search the whole directory, not just current members.
  const members: TodoMember[] = useMemo(() => Object.values(memberMap), [memberMap]);
  const infoFor = (email: string): TodoMember => memberMap[email] ?? { email, name: getUserDisplayName(email) };

  // Two independent sub-lists — sort within each column; tasks never cross.
  const columns = useMemo(() => {
    const sortBy = list?.sortBy ?? 'created';
    const col0 = sortTasks(tasks.filter((t) => t.column === 0), sortBy, getUserDisplayName);
    const col1 = sortTasks(tasks.filter((t) => t.column === 1), sortBy, getUserDisplayName);
    return [col0, col1] as [TodoTask[], TodoTask[]];
  }, [tasks, list?.sortBy]);

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

  const setDraft = (column: TodoColumn, value: string) =>
    setDrafts((prev) => (column === 0 ? [value, prev[1]] : [prev[0], value]));

  const addTask = async (column: TodoColumn) => {
    const raw = drafts[column].trim();
    if (!raw) return;
    const parsed = parseQuickAdd(raw, members, new Date());
    setDraft(column, '');

    // Show the task immediately (optimistic), then reconcile with the server.
    const now = new Date().toISOString();
    const tempId = `temp-${now}-${Math.random().toString(36).slice(2)}`;
    const optimistic: TodoTask = {
      id: tempId, listId, column, text: parsed.text || raw, assignees: parsed.assignees,
      ...(parsed.dueDate ? { dueDate: parsed.dueDate } : {}),
      done: false, createdBy: myEmail, createdAt: now, updatedAt: now,
    };
    setTasks((prev) => [...prev, optimistic]);
    pendingAddsRef.current += 1;
    try {
      const res = await fetch(`/api/todo/lists/${listId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: optimistic.text, column, assignees: parsed.assignees, dueDate: parsed.dueDate }),
      });
      if (!res.ok) throw new Error(`add failed: ${res.status}`);
      const created: TodoTask = await res.json();
      // Swap the temp row for the real one (guard against a concurrent refetch
      // having already inserted it).
      setTasks((prev) => {
        const without = prev.filter((t) => t.id !== tempId);
        return without.some((t) => t.id === created.id) ? without : [...without, created];
      });
    } catch {
      // Roll the optimistic row back and resync.
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      load();
    } finally {
      pendingAddsRef.current -= 1;
    }
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
  const rows = Math.max(MIN_ROWS, columns[0].length + 1, columns[1].length + 1);

  const renderColumn = (column: TodoColumn) => {
    const colTasks = columns[column];
    const blanks = Math.max(0, rows - colTasks.length - 1);
    return (
      <ul className="todo-lines todo-column" key={column}>
        {colTasks.map((task) => (
          <li key={task.id} className={`todo-line ${task.done ? 'done' : ''}`}
            onClick={() => setEditing(task)}>
            <span className="todo-text">{task.text}</span>
            {task.assignees.length > 0 && (
              <span className="todo-assignees">
                {task.assignees.map((email) => {
                  const m = infoFor(email);
                  return <Avatar key={email} email={email} name={m.name} image={m.image} size={20} />;
                })}
              </span>
            )}
            {task.dueDate && (
              <span className={`todo-due ${isOverdue(task.dueDate) ? 'overdue' : ''}`}>
                {formatDueLabel(task.dueDate)}
              </span>
            )}
            <button className="todo-check" role="checkbox" aria-checked={task.done}
              aria-label={task.done ? 'בטל השלמה' : 'סמן כהושלם'}
              onClick={(e) => { e.stopPropagation(); toggleDone(task); }}>
              {task.done ? '✓' : ''}
            </button>
          </li>
        ))}
        <li className="todo-line todo-add-line">
          <input
            ref={(el) => { inputRefs.current[column] = el; }}
            value={drafts[column]}
            placeholder="כתבו כאן…"
            onChange={(e) => setDraft(column, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTask(column); }}
          />
          <span className="todo-check" aria-hidden style={{ visibility: 'hidden' }} />
        </li>
        {Array.from({ length: blanks }).map((_, i) => (
          <li key={`blank-${i}`} className="todo-line todo-line--blank"
            onClick={() => inputRefs.current[column]?.focus()} aria-hidden />
        ))}
      </ul>
    );
  };

  return (
    <>
      <Navbar />
      <div className={`todo-page ${caveat.variable} ${hebrewHand.variable}`}>
        <div className="todo-topbar">
          <Link href="/todo" className="todo-back" aria-label="חזרה לרשימות">‹ רשימות</Link>
        </div>
        <input
          className="todo-list-name"
          value={nameDraft}
          aria-label="שם הרשימה"
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />

        <div className="todo-toolbar">
          <span className="todo-toolbar-label">מיון:</span>
          {TODO_SORT_OPTIONS.map((s) => (
            <button key={s} className={`todo-btn ${list.sortBy === s ? 'todo-btn--active' : ''}`}
              onClick={() => changeSort(s)}>{SORT_LABEL[s]}</button>
          ))}
          <div className="todo-toolbar-spacer" />
          <button className="todo-btn" onClick={renew}>♻︎ חדש</button>
          <button className="todo-btn" onClick={() => setShowHistory(true)}>היסטוריה{archiveCount ? ` (${archiveCount})` : ''}</button>
          <button className="todo-btn" onClick={() => setShowSettings(true)}>⚙︎ הגדרות</button>
        </div>

        <NotepadFrame>
          <div className="todo-columns">
            {renderColumn(0)}
            {renderColumn(1)}
          </div>
        </NotepadFrame>
      </div>

      {editing && (
        <TaskModal
          listId={listId}
          task={editing}
          members={members}
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
