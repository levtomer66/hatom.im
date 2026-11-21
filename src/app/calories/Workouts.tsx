'use client';

// אימונים: the day's finished workouts from the workout app, each with its burn
// (an estimate from the logged sets until corrected). A tap corrects it.

import React, { useState } from 'react';
import { FaDumbbell } from 'react-icons/fa';
import { MAX_BURNED } from '@/lib/calories/calories';
import type { BurnedRow } from '@/lib/calories/api-types';
import Sheet from './Sheet';

const n = (v: number) => v.toLocaleString('he-IL');

export default function Workouts({ rows, onPick }: { rows: BurnedRow[]; onPick: (row: BurnedRow) => void }) {
  if (!rows.length) return null;
  const total = rows.reduce((a, r) => a + r.kcal, 0);
  return (
    <section className="sh-card cal-meal cal-workouts" aria-label="אימונים">
      <header className="cal-meal-head">
        <h2>אימונים</h2>
        <span className="cal-muted">{n(total)} קק״ל נשרפו</span>
      </header>
      <ul className="cal-entries">
        {rows.map((r) => (
          <li key={r.id} className="cal-entry">
            <button type="button" className="cal-entry-btn" onClick={() => onPick(r)}>
              <span className="cal-workout-icon" aria-hidden><FaDumbbell /></span>
              <span className="cal-entry-name">{r.name}
                <small>{r.sets} סטים · {r.est ? `משוער${r.assumedKg ? ' (לפי 70 ק״ג)' : ''}` : 'תוקן ידנית'}</small>
              </span>
              <span className="cal-entry-kcal">{n(r.kcal)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BurnedSheet({ row, onSave, onClose }: {
  row: BurnedRow; onSave: (kcal: number | null) => Promise<string | null>; onClose: () => void;
}) {
  const [value, setValue] = useState(String(row.kcal));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async (kcal: number | null) => {
    setBusy(true);
    setError(await onSave(kcal));
    setBusy(false);
  };
  const typed = Math.round(Number(value));
  const ok = value.trim() !== '' && Number.isFinite(typed) && typed >= 0 && typed <= MAX_BURNED;
  return (
    <Sheet title={row.name} onClose={onClose}>
      <p className="cal-muted">
        הערכה: {n(row.estKcal)} קק״ל ({row.sets} סטים, כ־3 דקות לסט{row.assumedKg ? ', לפי 70 ק״ג' : ''}). אפשר לתקן, למשל לפי השעון.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); if (ok) void save(typed); }}>
        <label className="cal-field"><span>קלוריות שנשרפו</span>
          <input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        {error ? <p className="cal-error">{error}</p> : null}
        <button type="submit" className="sh-btn sh-btn--primary cal-wide" disabled={busy || !ok}>{busy ? 'שומר…' : 'שמירה'}</button>
      </form>
      {!row.est ? <button type="button" className="sh-btn cal-wide" disabled={busy} onClick={() => void save(null)}>לחזור להערכה</button> : null}
    </Sheet>
  );
}
