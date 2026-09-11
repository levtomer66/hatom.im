'use client';

import React, { useState } from 'react';
import UserPicker from '@/components/todo/UserPicker';
import type { TodoTask, TodoMember, TodoColumn } from '@/types/todo';

export default function TaskModal({
  listId,
  task,
  members,
  onClose,
  onSaved,
  onDeleted,
}: {
  listId: string;
  task: TodoTask;
  members: TodoMember[];
  onClose: () => void;
  onSaved: (task: TodoTask) => void;
  onDeleted: (taskId: string) => void;
}) {
  const [text, setText] = useState(task.text);
  const [assignees, setAssignees] = useState<string[]>(task.assignees);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [description, setDescription] = useState(task.description ?? '');
  const [done, setDone] = useState(task.done);
  const [column, setColumn] = useState<TodoColumn>(task.column);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/todo/lists/${listId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim() || task.text,
          assignees,
          dueDate: dueDate ? dueDate : null,
          description: description.trim() ? description.trim() : null,
          done,
          column,
        }),
      });
      if (res.ok) onSaved(await res.json());
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/todo/lists/${listId}/tasks/${task.id}`, { method: 'DELETE' });
      if (res.ok) onDeleted(task.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="todo-modal-backdrop" onClick={onClose}>
      <div className="todo-modal" onClick={(e) => e.stopPropagation()}>
        <h2>עריכת משימה</h2>
        <div className="todo-field">
          <label>משימה</label>
          <input type="text" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="todo-field">
          <label>אחראים</label>
          <UserPicker candidates={members} selected={assignees} onChange={setAssignees} />
        </div>
        <div className="todo-field">
          <label>תאריך יעד</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="todo-field">
          <label>תיאור</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="todo-field">
          <label>טור</label>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button type="button" className={`todo-btn ${column === 0 ? 'todo-btn--active' : ''}`}
              onClick={() => setColumn(0)}>ימין</button>
            <button type="button" className={`todo-btn ${column === 1 ? 'todo-btn--active' : ''}`}
              onClick={() => setColumn(1)}>שמאל</button>
          </div>
        </div>
        <div className="todo-field">
          <label>סטטוס</label>
          <button type="button"
            className={`todo-btn ${done ? 'todo-btn--active' : ''}`}
            aria-pressed={done}
            onClick={() => setDone((d) => !d)}>
            {done ? '✓ בוצע' : 'לא בוצע'}
          </button>
        </div>
        <div className="todo-modal-actions">
          <button className="todo-btn todo-btn--danger" onClick={remove} disabled={busy}>מחק</button>
          <div className="spacer" />
          <button className="todo-btn" onClick={onClose}>סגור</button>
          <button className="todo-btn todo-btn--active" onClick={save} disabled={busy}>שמור</button>
        </div>
      </div>
    </div>
  );
}
