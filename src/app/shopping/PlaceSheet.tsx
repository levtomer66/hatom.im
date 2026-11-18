'use client';

// "שינוי מיקום": set where prices are compared by typing an address (spec
// addendum in docs/superpowers/specs/2026-11-18-shopping-no-cities-design.md).
// Suggestions come as you type (debounced) from our /api/shopping/geocode
// (Photon, OpenStreetMap, behind it); there is no search button. A result is used here ("כאן") or saved as the home
// spot; mode 'home' (from ⚙ → משק הבית) only saves the home spot.
import { useEffect, useRef, useState } from 'react';
import { FaHome, FaLocationArrow, FaSearch, FaTimes } from 'react-icons/fa';
import { SHOPPING_API_PATH } from '@/lib/shopping/config';
import type { Place } from '@/lib/shopping/geocode';

export function PlaceSheet({ mode, place, onUse, onSaveHome, onMyLocation, onClose }: {
  mode: 'here' | 'home';
  /** The place set by hand now, if any. */
  place: Place | null;
  onUse: (p: Place) => void;
  onSaveHome: (p: Place) => Promise<void>;
  /** Back to the device's location (shown while a place is set). */
  onMyLocation: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Suggestions as you type: 300 ms after the last key, from 2 letters; a newer query aborts the older one.
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setFound(null);
      setError(null);
      return;
    }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`${SHOPPING_API_PATH}/geocode?q=${encodeURIComponent(t)}`, { signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        setFound(((await res.json()) as { places: Place[] }).places);
        setError(null);
      } catch {
        if (!ctl.signal.aborted) setError('החיפוש לא הצליח. נסו שוב.');
      } finally {
        if (!ctl.signal.aborted) setBusy(false);
      }
    }, 300);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [q]);

  return (
    <div className="sh-sheet-backdrop" onClick={onClose}>
      <div className="sh-sheet sh-place" role="dialog" aria-modal="true" aria-labelledby="sh-place-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sh-icon-btn sh-sheet-close" onClick={onClose} aria-label="סגירה"><FaTimes /></button>
        <h2 id="sh-place-title" className="sh-h2">{mode === 'home' ? 'איפה הבית?' : 'איפה להשוות?'}</h2>
        {mode === 'here' && place && (
          <button type="button" className="sh-btn sh-place-mine" onClick={() => { onMyLocation(); onClose(); }}>
            <FaLocationArrow aria-hidden /> המיקום שלי (במקום {place.label})
          </button>
        )}
        <form className="sh-place-form" role="search" onSubmit={(e) => { e.preventDefault(); if (found?.[0] && mode === 'here') { onUse(found[0]); onClose(); } }}>
          <label className="sh-search-box">
            <FaSearch aria-hidden />
            <input ref={inputRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="כתובת, למשל הרצל 5 רמת גן"
              aria-label="כתובת" aria-controls="sh-place-list" aria-autocomplete="list" autoComplete="off" enterKeyHint="search" />
            {busy && <span className="sh-place-busy" aria-live="polite">מחפש…</span>}
          </label>
        </form>
        {error && <p className="sh-error">{error}</p>}
        {found && !found.length && <p className="sh-empty">לא נמצאה כתובת. נסו לכתוב גם את העיר.</p>}
        {found && found.length > 0 && (
          <ul className="sh-place-list" id="sh-place-list">
            {found.map((p) => (
              <li key={`${p.lat},${p.lng},${p.label}`} className="sh-place-row">
                <span className="sh-place-label">{p.label}</span>
                {mode === 'here' && (
                  <button type="button" className="sh-btn sh-btn--primary" onClick={() => { onUse(p); onClose(); }}>כאן</button>
                )}
                <button type="button" className="sh-btn" onClick={() => void onSaveHome(p).then(() => { if (mode === 'home') onClose(); })}>
                  <FaHome aria-hidden /> שמירה כבית
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="sh-place-note">הכתובת נשלחת ל־OpenStreetMap לחיפוש בלבד.</p>
      </div>
    </div>
  );
}
