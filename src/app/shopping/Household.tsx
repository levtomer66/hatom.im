'use client';

// Households (docs/superpowers/specs/2026-11-18-shopping-households-design.md):
// the card for an invite to the caller, and the "משק הבית" sheet — members,
// pending invites, inviting by email, leaving.
import { useEffect, useRef, useState } from 'react';
import { FaTimes, FaUserPlus } from 'react-icons/fa';
import type { HouseholdResponse } from '@/lib/shopping/api-types';
import { SHOPPING_API_PATH } from '@/lib/shopping/config';

/** POST /household; throws the server's message (Hebrew where it has one). */
export async function householdAction(body: Record<string, unknown>): Promise<HouseholdResponse> {
  const res = await fetch(`${SHOPPING_API_PATH}/household`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? 'לא נשמר, נסו שוב');
  return json as HouseholdResponse;
}

export const loadHousehold = (): Promise<HouseholdResponse> =>
  fetch(`${SHOPPING_API_PATH}/household`).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

/** "‹name› הזמין/ה אותך למשק הבית שלו/ה": accept or decline, with what accepting deletes. */
export function InviteCard({ invite, onAnswer }: {
  invite: HouseholdResponse['incoming'][number];
  onAnswer: (accept: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const answer = async (accept: boolean) => {
    setBusy(true);
    try { await onAnswer(accept); } finally { setBusy(false); }
  };
  return (
    <section className="sh-invite" aria-label="הזמנה למשק בית">
      <p className="sh-invite-text"><b>{invite.byName}</b> הזמין/ה אותך למשק הבית שלו/ה</p>
      {invite.loses > 0 && <p className="sh-invite-warn">המוצרים והרשימה שלך ({invite.loses}) יימחקו</p>}
      <div className="sh-invite-actions">
        <button type="button" className="sh-btn sh-btn--primary" disabled={busy} onClick={() => answer(true)}>הצטרפות</button>
        <button type="button" className="sh-btn" disabled={busy} onClick={() => answer(false)}>לא תודה</button>
      </div>
    </section>
  );
}

/** The "משק הבית" sheet. `onChanged` runs after leaving, so the page reloads its data. */
export function HouseholdSheet({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [h, setH] = useState<HouseholdResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => { loadHousehold().then(setH).catch(() => setError('לא הצלחנו לטעון. נסו שוב.')); }, []);

  const act = async (body: Record<string, unknown>, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      setH(await householdAction(body));
      after?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const leave = () => {
    if (!window.confirm('לעזוב את משק הבית? המוצרים והרשימה נשארים לשאר בני הבית.')) return;
    void act({ leave: true }, onChanged);
  };

  return (
    <div className="sh-sheet-backdrop" onClick={onClose}>
      <div className="sh-sheet sh-household" role="dialog" aria-modal="true" aria-labelledby="sh-household-title" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} type="button" className="sh-icon-btn sh-sheet-close" onClick={onClose} aria-label="סגירה"><FaTimes /></button>
        <h2 id="sh-household-title" className="sh-h2">משק הבית</h2>
        {!h && !error && <div className="sh-skeleton" aria-label="טוען" />}
        {h && (
          <>
            <ul className="sh-household-list" aria-label="בני הבית">
              {h.members.map((m) => (
                <li key={m.email}><b>{m.name}</b><small dir="ltr">{m.email}</small></li>
              ))}
            </ul>
            {h.invites.length > 0 && (
              <>
                <h3 className="sh-section-title">הוזמנו</h3>
                <ul className="sh-household-list">
                  {h.invites.map((i) => (
                    <li key={i.email}>
                      <small dir="ltr">{i.email}</small>
                      <button type="button" className="sh-link" disabled={busy} onClick={() => act({ cancel: i.email })}>ביטול</button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <form className="sh-household-invite" onSubmit={(e) => { e.preventDefault(); if (email.trim()) void act({ invite: email }, () => setEmail('')); }}>
              <label className="sh-search-box">
                <FaUserPlus aria-hidden />
                <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gmail.com"
                  aria-label="מייל להזמנה" autoComplete="off" inputMode="email" />
              </label>
              <button type="submit" className="sh-btn sh-btn--primary" disabled={busy || !email.trim()}>+ הזמנה במייל</button>
            </form>
            {h.members.length > 1 && (
              <button type="button" className="sh-btn sh-btn--ghost sh-btn--danger sh-household-leave" disabled={busy} onClick={leave}>עזיבת משק הבית</button>
            )}
          </>
        )}
        {error && <p className="sh-error">{error}</p>}
      </div>
    </div>
  );
}
