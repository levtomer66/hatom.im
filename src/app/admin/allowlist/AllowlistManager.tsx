'use client';

import React, { useState } from 'react';
import type { AuthorizedEmail } from '@/models/AuthorizedEmail';
import {
  PERMISSION_KEYS,
  PERMISSIONS,
  type PermissionKey,
} from '@/types/permissions';

interface Props {
  initial: AuthorizedEmail[];
}

export default function AllowlistManager({ initial }: Props) {
  const [entries, setEntries] = useState<AuthorizedEmail[]>(initial);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tracks per-row "permissions being saved" state so a slow PATCH doesn't
  // leave the UI ambiguous. Keyed by email since that's the stable PATCH
  // identifier — `id` would also work but email reads better in DevTools.
  const [savingEmail, setSavingEmail] = useState<string | null>(null);

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

  // Optimistic toggle: flip the chip in local state, fire the PATCH, and
  // roll back on error. The server is the source of truth — its response
  // overwrites the optimistic value (matters if two owners toggle the same
  // row in quick succession).
  async function togglePermission(target: AuthorizedEmail, key: PermissionKey) {
    const had = target.allowedPages.includes(key);
    const next = had
      ? target.allowedPages.filter((k) => k !== key)
      : [...target.allowedPages, key];

    setError(null);
    setSavingEmail(target.email);
    setEntries((prev) =>
      prev.map((e) =>
        e.email === target.email ? { ...e, allowedPages: next } : e
      )
    );

    try {
      const res = await fetch('/api/admin/allowlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target.email, allowedPages: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const updated = (await res.json()) as AuthorizedEmail;
      setEntries((prev) =>
        prev.map((e) => (e.email === updated.email ? updated : e))
      );
    } catch (err) {
      // Rollback to whatever the server-known-good state was (the version
      // that was rendered before the optimistic flip).
      setEntries((prev) =>
        prev.map((e) =>
          e.email === target.email
            ? { ...e, allowedPages: target.allowedPages }
            : e
        )
      );
      setError(err instanceof Error ? err.message : 'Failed to update permissions');
    } finally {
      setSavingEmail((current) => (current === target.email ? null : current));
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
          {entries.map((e) => {
            const saving = savingEmail === e.email;
            return (
              <li key={e.id} className="admin-row admin-row--matrix">
                <div className="admin-row-main">
                  <span className="admin-row-email">{e.email}</span>
                  {e.note && <span className="admin-row-note">{e.note}</span>}
                </div>
                <div className="admin-row-meta">
                  added by {e.addedBy} ·{' '}
                  {new Date(e.addedAt).toLocaleDateString()}
                </div>
                <div className="admin-perm-row" role="group" aria-label="Permissions">
                  {PERMISSION_KEYS.map((key) => {
                    const meta = PERMISSIONS[key];
                    const active = e.allowedPages.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`admin-perm-pill ${active ? 'active' : ''}`}
                        aria-pressed={active}
                        aria-label={`${active ? 'Revoke' : 'Grant'} ${meta.label}`}
                        title={meta.label}
                        disabled={saving}
                        onClick={() => togglePermission(e, key)}
                      >
                        <span className="admin-perm-pill-emoji" aria-hidden="true">
                          {meta.emoji}
                        </span>
                        <span className="admin-perm-pill-label">{meta.label}</span>
                      </button>
                    );
                  })}
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
