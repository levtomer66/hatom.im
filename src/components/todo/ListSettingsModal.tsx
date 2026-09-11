'use client';

import React, { useEffect, useState } from 'react';
import Avatar from '@/components/todo/Avatar';
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
  const [dir, setDir] = useState<Record<string, TodoMember>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/todo/members')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: TodoMember[]) => {
        const map: Record<string, TodoMember> = {};
        for (const m of rows) map[m.email] = m;
        setDir(map);
      })
      .catch(() => setDir({}));
  }, []);

  const infoFor = (email: string): TodoMember => dir[email] ?? { email, name: getUserDisplayName(email) };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const trimmed = name.trim();
      if (!trimmed || trimmed === list.name) { onClose(); return; }
      const res = await fetch(`/api/todo/lists/${list.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
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
        <div className="todo-field">
          <label>משותף עם</label>
          <div className="todo-members">
            {list.members.map((email) => {
              const m = infoFor(email);
              return (
                <span key={email} className="todo-userchip">
                  <Avatar email={email} name={m.name} image={m.image} size={18} />
                  <span className="todo-userchip-name">{m.name}{email === list.createdBy ? ' (יוצר)' : ''}</span>
                </span>
              );
            })}
          </div>
          <p className="todo-hint">כדי לשתף עם עוד אנשים — תייגו אותם במשימה.</p>
        </div>
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
