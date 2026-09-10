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
