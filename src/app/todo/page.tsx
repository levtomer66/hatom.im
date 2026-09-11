'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import NotepadFrame from '@/components/todo/NotepadFrame';
import NewListModal from '@/components/todo/NewListModal';
import Avatar from '@/components/todo/Avatar';
import { caveat, hebrewHand } from '@/app/todo/fonts';
import { hasPermission } from '@/lib/permissions';
import { getUserDisplayName } from '@/types/workout';
import { formatDueLabel, isOverdue } from '@/lib/todo-date';
import type { TodoList, TodoTask, TodoMember } from '@/types/todo';

export default function TodoIndexPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [lists, setLists] = useState<TodoList[]>([]);
  const [myTasks, setMyTasks] = useState<TodoTask[]>([]);
  const [memberMap, setMemberMap] = useState<Record<string, TodoMember>>({});
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

  useEffect(() => {
    if (!allowed) return;
    fetch('/api/todo/members')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: TodoMember[]) => {
        const map: Record<string, TodoMember> = {};
        for (const m of rows) map[m.email] = m;
        setMemberMap(map);
      })
      .catch(() => setMemberMap({}));
  }, [allowed]);

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

  const infoFor = (email: string): TodoMember => memberMap[email] ?? { email, name: getUserDisplayName(email) };
  const nameFor = (listId: string) => lists.find((l) => l.id === listId)?.name ?? '';

  if (status === 'loading' || !allowed) {
    return (<><Navbar /><div className="todo-page" /></>);
  }

  return (
    <>
      <Navbar />
      <div className={`todo-page ${caveat.variable} ${hebrewHand.variable}`}>
        <h1 className="todo-page-heading">Things To Do</h1>

        <div className="todo-toolbar">
          <button className="todo-btn todo-btn--active" onClick={() => setCreating(true)}>+ רשימה חדשה</button>
        </div>

        <div className="todo-grid">
          {lists.map((list) => (
            <Link key={list.id} href={`/todo/${list.id}`} className="todo-card-link">
              <NotepadFrame mini>
                <div className="todo-card-name">{list.name}</div>
                <div className="todo-card-meta">
                  <div className="todo-assignees">
                    {list.members.map((email) => {
                      const m = infoFor(email);
                      return <Avatar key={email} email={email} name={m.name} image={m.image} size={22} />;
                    })}
                  </div>
                </div>
              </NotepadFrame>
            </Link>
          ))}
          {lists.length === 0 && (
            <p style={{ color: '#607d8b' }}>אין עדיין רשימות. צרו את הראשונה!</p>
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
