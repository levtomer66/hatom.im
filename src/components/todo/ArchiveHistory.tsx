'use client';

import React, { useEffect, useState } from 'react';
import type { TodoArchive } from '@/types/todo';

export default function ArchiveHistory({ listId, onClose }: { listId: string; onClose: () => void }) {
  const [archives, setArchives] = useState<TodoArchive[] | null>(null);

  useEffect(() => {
    fetch(`/api/todo/lists/${listId}/archives`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setArchives)
      .catch(() => setArchives([]));
  }, [listId]);

  return (
    <div className="todo-modal-backdrop" onClick={onClose}>
      <div className="todo-modal" onClick={(e) => e.stopPropagation()}>
        <h2>היסטוריה</h2>
        {archives === null && <p>טוען…</p>}
        {archives && archives.length === 0 && <p>עדיין אין חידושים.</p>}
        {archives && archives.map((a) => {
          const doneCount = a.tasks.filter((t) => t.done).length;
          return (
            <div key={a.id} className="todo-field">
              <label>{new Date(a.renewedAt).toLocaleDateString('he-IL')} · {doneCount}/{a.tasks.length} הושלמו</label>
              <ul className="todo-lines">
                {a.tasks.map((t, i) => (
                  <li key={i} className={`todo-line ${t.done ? 'done' : ''}`} style={{ cursor: 'default' }}>
                    <span className="todo-text">{t.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <div className="todo-modal-actions">
          <div className="spacer" />
          <button className="todo-btn" onClick={onClose}>סגור</button>
        </div>
      </div>
    </div>
  );
}
