'use client';

// פעילות: the day's finished workouts from the workout app, each with its burn
// (an estimate from the logged sets until corrected; a tap corrects it), and the
// steps typed by hand (צעדים, a tap edits them) with walking's burn (stepsBurn).

import React, { useState } from 'react';
import { FaDumbbell, FaWalking } from 'react-icons/fa';
import { MAX_BURNED, MAX_STEPS, stepsBurn, stepsOk, type Activity } from '@/lib/calories/calories';
import type { BurnedRow, StepsRow } from '@/lib/calories/api-types';
import Sheet from './Sheet';

const n = (v: number) => v.toLocaleString('he-IL');

export default function Workouts({ rows, steps, onPick, onSteps }: {
  rows: BurnedRow[]; steps: StepsRow | null; onPick: (row: BurnedRow) => void; onSteps: () => void;
}) {
  if (!rows.length && !steps) return null;
  const total = rows.reduce((a, r) => a + r.kcal, 0) + (steps?.kcal ?? 0);
  return (
    <section className="sh-card cal-meal cal-workouts" aria-label="פעילות">
      <header className="cal-meal-head">
        <h2>פעילות</h2>
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
        {steps ? (
          <li className="cal-entry">
            <button type="button" className="cal-entry-btn" onClick={onSteps}>
              <span className="cal-workout-icon" aria-hidden><FaWalking /></span>
              <span className="cal-entry-name">{n(steps.n)} צעדים
                <small>{steps.base ? `מעל ${n(steps.base)} שכבר ביעד` : 'הליכה'}{steps.assumedKg ? ' · לפי 70 ק״ג' : ''}</small>
              </span>
              <span className="cal-entry-kcal">{n(steps.kcal)}</span>
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

/** צעדים: the day's steps from the phone or watch, typed by hand; the burn shows as you type. */
export function StepsSheet({ steps, kg, activity, onSave, onClose }: {
  steps: StepsRow | null; kg: number | null; activity: Activity | undefined;
  onSave: (steps: number | null) => Promise<string | null>; onClose: () => void;
}) {
  const [value, setValue] = useState(steps ? String(steps.n) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const typed = Number(value.replace(/[,\s]/g, ''));
  const ok = value.trim() !== '' && stepsOk(typed);
  const est = ok ? stepsBurn(typed, kg, activity) : null;
  const save = async (v: number | null) => {
    setBusy(true);
    setError(await onSave(v));
    setBusy(false);
  };
  return (
    <Sheet title="צעדים" onClose={onClose}>
      <p className="cal-muted">כמה צעדים הלכת היום, לפי הטלפון או השעון. הקלוריות מחושבות לבד.</p>
      <form onSubmit={(e) => { e.preventDefault(); if (ok) void save(typed); }}>
        <label className="cal-field"><span>צעדים</span>
          <input inputMode="numeric" value={value} placeholder="8,000" autoFocus onChange={(e) => setValue(e.target.value)} />
        </label>
        {value.trim() && !ok ? <p className="cal-error">בין 0 ל־{n(MAX_STEPS)} צעדים</p> : null}
        {est ? (
          <p className="cal-rec">
            <b>{n(est.kcal)}</b> קק״ל נשרפו
            <small>{est.base ? `נספרים הצעדים מעל ${n(est.base)} — הפעילות היום־יומית שבחרת כבר בתוך היעד` : 'לפי משקל' + (est.assumedKg ? ' של 70 ק״ג' : ` של ${kg} ק״ג`)}</small>
          </p>
        ) : null}
        {error ? <p className="cal-error">{error}</p> : null}
        <button type="submit" className="sh-btn sh-btn--primary cal-wide" disabled={busy || !ok}>{busy ? 'שומר…' : 'שמירה'}</button>
      </form>
      {steps ? <button type="button" className="sh-btn cal-wide" disabled={busy} onClick={() => void save(null)}>מחיקת הצעדים</button> : null}
    </Sheet>
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
