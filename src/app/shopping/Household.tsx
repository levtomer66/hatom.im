'use client';

// Households (docs/superpowers/specs/2026-11-18-shopping-households-design.md):
// the card for an invite to the caller, and the "משק הבית" sheet — members,
// pending invites, inviting by email, leaving, and the home spot (where "near"
// is when there's no live location: docs/superpowers/specs/2026-11-18-shopping-no-cities-design.md).
import { useEffect, useRef, useState } from 'react';
import { FaHome, FaUserPlus } from 'react-icons/fa';
import type { HouseholdResponse } from '@/lib/shopping/api-types';
import { SHOPPING_API_PATH } from '@/lib/shopping/config';
import { useSwipeToClose } from './ui';
import type { Centre } from '@/lib/shopping/near';

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
export function HouseholdSheet({ onClose, onChanged, beforeLeave, homeSpot, onHomeSpot, nearestHome, onSaveHere, onByAddress }: {
  onClose: () => void;
  /** The household's saved home spot, and saving it (null clears). */
  homeSpot: Centre | null;
  onHomeSpot: (spot: Centre | null) => Promise<void>;
  /** The nearest priced store to the home spot, when the page knows it. */
  nearestHome: string | null;
  /** Saves the location in use, or reads it once when there is none. */
  onSaveHere: () => void;
  /** Opens the address search to set the home spot. */
  onByAddress: () => void;
  onChanged: () => void;
  /** Sends the page's pending saves, so they land in this household before leaving it. */
  beforeLeave?: () => Promise<unknown>;
}) {
  const [h, setH] = useState<HouseholdResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  // No ✕: dragging the sheet down (useSwipeToClose), tapping outside it, or Escape closes it.
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => sheetRef.current?.focus(), []);
  useSwipeToClose(sheetRef, onClose);
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
    void (async () => {
      await beforeLeave?.();
      await act({ leave: true }, onChanged);
    })();
  };

  return (
    <div className="sh-sheet-backdrop" onClick={onClose}>
      <div ref={sheetRef} tabIndex={-1} className="sh-sheet sh-household" role="dialog" aria-modal="true" aria-labelledby="sh-household-title" onClick={(e) => e.stopPropagation()}>
        <span className="sh-sheet-grip" aria-hidden />
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
            <section className="sh-home-spot" aria-label="הבית">
              <h3 className="sh-section-title"><FaHome aria-hidden /> הבית</h3>
              <p className="sh-home-spot-text">
                {homeSpot
                  ? <>הבית נשמר{nearestHome ? <> · ליד {nearestHome}</> : null}</>
                  : 'כשאין מיקום (או מ־Claude / ChatGPT) משווים ליד הבית. עוד לא נשמר.'}
              </p>
              <div className="sh-home-spot-actions">
                <button type="button" className="sh-btn" onClick={onSaveHere}>
                  {homeSpot ? 'שינוי למיקום הנוכחי' : 'שמירת המיקום הנוכחי כבית'}
                </button>
                <button type="button" className="sh-btn" onClick={onByAddress}>לפי כתובת</button>
                {homeSpot && <button type="button" className="sh-link" onClick={() => void onHomeSpot(null)}>מחיקה</button>}
              </div>
            </section>
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
