'use client';

// Today's ring: what's left in the middle (goal − eaten + burned by workouts and steps);
// eaten and burned under it, then protein · carbs · fat as tiles (<Macros>),
// each with a bar to its daily grams (macroGoals: the protein goal, fat 25%,
// carbs the rest).

import React from 'react';
import Macros from './Macros';
import { leftToday, macroGoals, type Settings, type Totals } from '@/lib/calories/calories';

const R = 54;
const C = 2 * Math.PI * R;
const n = (v: number) => Math.round(v).toLocaleString('he-IL');

export default function Ring({ eaten, burned, settings }: { eaten: Totals; burned: number; settings: Settings }) {
  const budget = settings.goal + burned;
  const share = Math.min(eaten.kcal / budget, 1);
  const left = leftToday(settings.goal, eaten.kcal, burned);
  const over = left < 0;
  return (
    <section className="cal-ring-card" aria-label="סיכום היום">
      <div className="cal-ring">
        <svg viewBox="0 0 128 128" width="148" height="148" aria-hidden>
          <circle cx="64" cy="64" r={R} className="cal-ring-track" />
          {share > 0 ? <circle cx="64" cy="64" r={R} className={`cal-ring-fill ${over ? 'is-over' : ''}`}
            strokeDasharray={`${C * share} ${C}`} transform="rotate(-90 64 64)" /> : null}
        </svg>
        <div className="cal-ring-mid">
          <b className={over ? 'is-over' : ''}>{n(Math.abs(left))}</b>
          <span>{over ? 'מעל היעד' : 'נשארו'}</span>
        </div>
      </div>
      <p className="cal-ring-sum">
        <span><b>{n(eaten.kcal)}</b> מתוך {n(settings.goal)} קק״ל{burned > 0 ? <> · <b className="cal-burned">+{n(burned)}</b> מפעילות</> : null}</span>
      </p>
      <Macros t={eaten} goals={macroGoals(settings.goal, settings.proteinGoal)} />
    </section>
  );
}
