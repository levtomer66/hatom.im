'use client';

import React, { useState } from 'react';
import type { AuthorizedEmail } from '@/models/AuthorizedEmail';

interface Props {
  initial: AuthorizedEmail[];
}

export default function AllowlistManager({ initial }: Props) {
  const [entries, setEntries] = useState<AuthorizedEmail[]>(initial);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/allowlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const created = (await res.json()) as AuthorizedEmail;
      setEntries((prev) => {
        const without = prev.filter((p) => p.email !== created.email);
        return [created, ...without];
      });
      setEmail('');
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(target: string) {
    if (!confirm(`Remove ${target}?`)) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/allowlist?email=${encodeURIComponent(target)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      setEntries((prev) => prev.filter((e) => e.email !== target));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    }
  }

  return (
    <div className="admin-card">
      <form className="admin-add-form" onSubmit={addEntry} autoComplete="off">
        <div className="admin-field admin-field--email">
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="someone@gmail.com"
            required
          />
        </div>
        <div className="admin-field admin-field--note">
          <label htmlFor="admin-note">Note (optional)</label>
          <input
            id="admin-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Amit"
          />
        </div>
        <button type="submit" className="admin-add-btn" disabled={busy || !email.trim()}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </form>

      {error && <div className="admin-error">{error}</div>}

      {entries.length === 0 ? (
        <p className="admin-empty">No entries yet.</p>
      ) : (
        <ul className="admin-list">
          {entries.map((e) => (
            <li key={e.id} className="admin-row">
              <div className="admin-row-main">
                <span className="admin-row-email">{e.email}</span>
                {e.note && <span className="admin-row-note">{e.note}</span>}
              </div>
              <div className="admin-row-meta">
                added by {e.addedBy} ·{' '}
                {new Date(e.addedAt).toLocaleDateString()}
              </div>
              <button
                type="button"
                className="admin-remove-btn"
                onClick={() => removeEntry(e.email)}
                aria-label={`Remove ${e.email}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
