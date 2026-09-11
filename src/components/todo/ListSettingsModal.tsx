'use client';

import React, { useEffect, useMemo, useState } from 'react';
import UserPicker from '@/components/todo/UserPicker';
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
  // The picker only manages the non-creator members; the creator is always in.
  const [others, setOthers] = useState<string[]>(list.members.filter((e) => e !== list.createdBy));
  const [directory, setDirectory] = useState<TodoMember[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isCreator) return;
    fetch('/api/todo/members').then((r) => (r.ok ? r.json() : [])).then(setDirectory).catch(() => setDirectory([]));
  }, [isCreator]);

  const creator = useMemo(
    () => directory.find((m) => m.email === list.createdBy),
    [directory, list.createdBy],
  );

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {};
      if (name.trim() && name.trim() !== list.name) body.name = name.trim();
      if (isCreator) body.members = [list.createdBy, ...others];
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
            <div className="todo-userchip todo-userchip--fixed">
              <Avatar email={list.createdBy} name={creator?.name ?? getUserDisplayName(list.createdBy)} image={creator?.image} size={18} />
              <span className="todo-userchip-name">{creator?.name ?? getUserDisplayName(list.createdBy)} (יוצר)</span>
            </div>
            <UserPicker
              candidates={directory.filter((m) => m.email !== list.createdBy)}
              selected={others}
              onChange={setOthers}
            />
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
