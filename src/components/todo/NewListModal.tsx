'use client';

import React, { useState } from 'react';
import type { TodoList } from '@/types/todo';

export default function NewListModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (list: TodoList) => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/todo/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), members: [] }),
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
        <p className="todo-hint">משתפים את הרשימה פשוט על ידי תיוג אנשים במשימות.</p>
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
