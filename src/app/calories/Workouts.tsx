'use client';

// פעילות: the day's finished workouts from the workout app, each with its burn
// (an estimate from the logged sets until corrected; a tap corrects it), and the
// steps typed by hand (צעדים, a tap edits them) with walking's burn (stepsBurn).

import React, { useState } from 'react';
import { FaDumbbell, FaWalking } from 'react-icons/fa';
import { MAX_BURNED, MAX_STEPS, stepsBurn, stepsOk, type Activity } from '@/lib/calories/calories';
import type { BurnedRow, StepsRow } from '@/lib/calories/api-types';
import Sheet from './Sheet';
import { statusText, useAutosave } from './autosave';

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

/**
 * צעדים: the day's steps from the phone or watch, typed by hand; the burn shows as
 * you type. Saved as you type (useAutosave); an emptied field clears the day's
 * steps; closing the sheet or Enter sends a change still waiting.
 */
export function StepsSheet({ steps, kg, activity, onSave, onClose }: {
  steps: StepsRow | null; kg: number | null; activity: Activity | undefined;
  onSave: (steps: number | null) => Promise<string | null>; onClose: () => void;
}) {
  const [value, setValue] = useState(steps ? String(steps.n) : '');
  const typed = Number(value.replace(/[,\s]/g, ''));
  const empty = value.trim() === '';
  const ok = !empty && stepsOk(typed);
  const est = ok ? stepsBurn(typed, kg, activity) : null;
  const { status, error, flush } = useAutosave<number | null>(empty ? null : ok ? typed : undefined, steps?.n ?? null, onSave);
  const close = () => { flush(); onClose(); };

  return (
    <Sheet title="צעדים" onClose={close}>
      <p className="cal-muted">כמה צעדים הלכת היום, לפי הטלפון או השעון. נשמר לבד, והקלוריות מחושבות לבד.</p>
      <form onSubmit={(e) => { e.preventDefault(); close(); }}>
        <label className="cal-field"><span>צעדים</span>
          <input inputMode="numeric" enterKeyHint="done" value={value} placeholder="8,000" autoFocus onChange={(e) => setValue(e.target.value)} />
        </label>
      </form>
      {!empty && !ok ? <p className="cal-error">בין 0 ל־{n(MAX_STEPS)} צעדים</p> : null}
      {est ? (
        <p className="cal-rec">
          <b>{n(est.kcal)}</b> קק״ל נשרפו
          <small>{est.base ? `נספרים הצעדים מעל ${n(est.base)} — הפעילות היום־יומית שבחרת כבר בתוך היעד` : 'לפי משקל' + (est.assumedKg ? ' של 70 ק״ג' : ` של ${kg} ק״ג`)}</small>
        </p>
      ) : null}
      {error ? <p className="cal-error" role="alert">{error}</p> : null}
      <p className="cal-muted cal-save-state" aria-live="polite">{status === 'saved' && empty ? 'הצעדים נמחקו' : statusText(status)}</p>
    </Sheet>
  );
}

/** A workout's burn: the estimate, corrected as you type (useAutosave); "לחזור להערכה" drops the correction. */
export function BurnedSheet({ row, onSave, onClose }: {
  row: BurnedRow; onSave: (kcal: number | null) => Promise<string | null>; onClose: () => void;
}) {
  const [value, setValue] = useState(String(row.kcal));
  const [reverting, setReverting] = useState(false);
  const typed = Math.round(Number(value));
  const ok = value.trim() !== '' && Number.isFinite(typed) && typed >= 0 && typed <= MAX_BURNED;
  const { status, error, flush } = useAutosave<number>(ok && !reverting ? typed : undefined, row.kcal, onSave);
  const close = () => { flush(); onClose(); };
  return (
    <Sheet title={row.name} onClose={close}>
      <p className="cal-muted">
        הערכה: {n(row.estKcal)} קק״ל ({row.sets} סטים, כ־3 דקות לסט{row.assumedKg ? ', לפי 70 ק״ג' : ''}). אפשר לתקן, למשל לפי השעון.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); close(); }}>
        <label className="cal-field"><span>קלוריות שנשרפו</span>
          <input inputMode="numeric" enterKeyHint="done" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
      </form>
      {value.trim() && !ok ? <p className="cal-error">בין 0 ל־{n(MAX_BURNED)} קק״ל</p> : null}
      {error ? <p className="cal-error" role="alert">{error}</p> : null}
      <p className="cal-muted cal-save-state" aria-live="polite">{statusText(status)}</p>
      {!row.est || status === 'saved' ? (
        <button type="button" className="sh-btn cal-wide" disabled={reverting}
          onClick={async () => { setReverting(true); if (!(await onSave(null))) onClose(); else setReverting(false); }}>לחזור להערכה</button>
      ) : null}
    </Sheet>
  );
}
