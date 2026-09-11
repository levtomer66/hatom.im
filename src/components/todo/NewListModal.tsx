'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import UserPicker from '@/components/todo/UserPicker';
import type { TodoList, TodoMember } from '@/types/todo';

export default function NewListModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (list: TodoList) => void;
}) {
  const { data: session } = useSession();
  const myEmail = (session?.user?.email ?? '').toLowerCase();
  const [members, setMembers] = useState<TodoMember[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/todo/members')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: TodoMember[]) => setMembers(rows))
      .catch(() => setMembers([]));
  }, []);

  const create = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/todo/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), members: selected }),
      });
      if (res.ok) onCreated(await res.json());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="todo-modal-backdrop" onClick={onClose}>
      <div className="todo-modal" onClick={(e) => e.stopPropagation()}>
        <h2>רשימה חדשה</h2>
        <div className="todo-field">
          <label>שם הרשימה</label>
          <input type="text" value={name} autoFocus onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
        </div>
        <div className="todo-field">
          <label>חברים ברשימה</label>
          <UserPicker
            candidates={members.filter((m) => m.email !== myEmail)}
            selected={selected}
            onChange={setSelected}
          />
        </div>
        <div className="todo-modal-actions">
          <button className="todo-btn" onClick={onClose}>ביטול</button>
          <div className="spacer" />
          <button className="todo-btn todo-btn--active" onClick={create} disabled={!name.trim() || saving}>
            {saving ? '…' : 'צור רשימה'}
          </button>
        </div>
      </div>
    </div>
  );
}
