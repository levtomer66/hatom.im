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
    if (res.ok) { const created = await res.json(); setTasks((prev) => [...prev, created]); }
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
