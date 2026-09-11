'use client';

import React, { useMemo, useState } from 'react';
import Avatar from './Avatar';
import type { TodoMember } from '@/types/todo';

// Autocomplete multi-select for members/assignees. Instead of listing every
// account, the user types to search and picks from up to 6 matches; chosen
// people show as removable avatar chips.
export default function UserPicker({
  candidates,
  selected,
  onChange,
  placeholder,
}: {
  candidates: TodoMember[];
  selected: string[]; // emails
  onChange: (emails: string[]) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const byEmail = useMemo(() => {
    const m = new Map<string, TodoMember>();
    for (const c of candidates) m.set(c.email, c);
    return m;
  }, [candidates]);

  const suggestions = useMemo(() => {
    // Only surface matches once the user actually searches — never list the
    // whole directory on focus/empty input.
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return candidates
      .filter((c) => !selected.includes(c.email))
      .filter((c) => c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term))
      .slice(0, 6);
  }, [candidates, selected, q]);

  const add = (email: string) => { onChange([...selected, email]); setQ(''); };
  const remove = (email: string) => onChange(selected.filter((e) => e !== email));

  return (
    <div className="todo-userpicker">
      {selected.length > 0 && (
        <div className="todo-userpicker-selected">
          {selected.map((email) => {
            const m = byEmail.get(email);
            return (
              <span key={email} className="todo-userchip">
                <Avatar email={email} name={m?.name ?? email} image={m?.image} size={18} />
                <span className="todo-userchip-name">{m?.name ?? email}</span>
                <button type="button" aria-label="הסר" onClick={() => remove(email)}>×</button>
              </span>
            );
          })}
        </div>
      )}
      <div className="todo-userpicker-input">
        <input
          type="text"
          value={q}
          placeholder={placeholder ?? 'חיפוש אנשים…'}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
        {open && suggestions.length > 0 && (
          <ul className="todo-userpicker-list">
            {suggestions.map((c) => (
              <li key={c.email}>
                {/* onMouseDown fires before the input's blur, so the pick isn't lost. */}
                <button type="button" onMouseDown={(e) => { e.preventDefault(); add(c.email); }}>
                  <Avatar email={c.email} name={c.name} image={c.image} size={24} />
                  <span className="todo-userpicker-name">{c.name}</span>
                  <span className="todo-userpicker-email">{c.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
