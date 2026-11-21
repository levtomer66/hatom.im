'use client';

// The day screen's search, shaped like /shopping's: 🔍, the field, then the
// barcode button (✕ once there's text). Results open under the box in the page;
// empty and focused it shows recent foods (one tap logs to the current meal),
// My items and quick add. A pick or a scan goes to the amount sheet (`onPick`).
// A click outside closes the results; Escape clears.

import React, { useEffect, useRef, useState } from 'react';
import { FaBarcode, FaSearch, FaTimes } from 'react-icons/fa';
import type { Recent } from '@/lib/calories/calories';
import Scanner from '../shopping/Scanner';
import { useTypedPlaceholder } from '../shopping/typed-placeholder';
import type { Picked } from './FoodPicker';
import { HitGroups, StartList, useFoodSearch, useMyItems, type LogFn } from './search-parts';
import { getProduct } from './api';

const PHRASES = ['ביצה', 'במבה', 'שקשוקה', 'יוגורט', 'לחם מלא'];

export default function SearchBar({ recent, canShop, onPick, onLog }: {
  recent: Recent[]; canShop: boolean; onPick: (p: Picked) => void; onLog: LogFn;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { res, loading, error: searchError, typed } = useFoodSearch(q);
  const mine = useMyItems(canShop);
  const placeholder = useTypedPlaceholder(PHRASES, !q && !open);
  const box = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const done = () => { setQ(''); setOpen(false); setError(null); };
  const pick = (p: Picked) => { done(); onPick(p); };
  const openProduct = async (key: string) => {
    setError(null);
    try {
      pick(await getProduct(key));
    } catch (e) {
      setOpen(true);
      setError(e instanceof Error ? e.message : 'לא מצאנו את הברקוד');
    }
  };

  const shownError = error ?? searchError;
  const waiting = typed && loading && !res.meals.length && !res.foods.length && !res.products.length;
  return (
    <section className="sh-search cal-search" ref={box}>
      <label className="sh-search-box">
        <FaSearch aria-hidden />
        <input type="search" value={q} placeholder={placeholder} aria-label="חיפוש מזון או ברקוד" enterKeyHint="search" autoComplete="off"
          onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => { setOpen(true); box.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { done(); (e.target as HTMLInputElement).blur(); } }} />
        {loading ? <span className="sh-spinner" aria-hidden /> : null}
        {q ? (
          <button type="button" className="sh-icon-btn" aria-label="ניקוי החיפוש" onClick={() => setQ('')}><FaTimes /></button>
        ) : (
          <button type="button" className="sh-icon-btn" aria-label="סריקת ברקוד במצלמה" onClick={() => { setOpen(false); setScanning(true); }}><FaBarcode /></button>
        )}
      </label>
      {open && !(waiting && !shownError) ? (
        <div className="cal-drop">
          {shownError ? <p className="cal-error" role="alert">{shownError}</p> : null}
          {typed
            ? <HitGroups res={res} withMeals loading={loading} onPick={pick} />
            : <StartList recent={recent} mine={mine} onLog={(e, per100, per) => { done(); onLog(e, per100, per); }} onOpenProduct={(k) => void openProduct(k)} />}
        </div>
      ) : null}
      {scanning ? <Scanner onClose={() => setScanning(false)} onCode={(code) => { setScanning(false); void openProduct(code); }} /> : null}
    </section>
  );
}
