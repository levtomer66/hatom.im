'use client';

// Today's ring: what's left in the middle (goal − eaten + burned by workouts);
// eaten and burned under it, then protein · carbs · fat, and a small protein bar
// when there is a protein goal.

import React from 'react';
import { leftToday, type Settings, type Totals } from '@/lib/calories/calories';

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
        <span><b>{n(eaten.kcal)}</b> מתוך {n(settings.goal)} קק״ל{burned > 0 ? <> · <b className="cal-burned">+{n(burned)}</b> באימון</> : null}</span>
        <span className="cal-macros">חלבון {n(eaten.p)} · פחמימות {n(eaten.c)} · שומן {n(eaten.f)} ג׳</span>
      </p>
      {settings.proteinGoal ? (
        <div className="cal-protein" aria-label={`חלבון ${n(eaten.p)} מתוך ${settings.proteinGoal} גרם`}>
          <span>חלבון</span>
          <span className="cal-bar"><span style={{ width: `${Math.min(eaten.p / settings.proteinGoal, 1) * 100}%` }} /></span>
          <span>{n(eaten.p)}/{settings.proteinGoal} ג׳</span>
        </div>
      ) : null}
    </section>
  );
}
