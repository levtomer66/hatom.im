'use client';

// Protein · carbs · fat as three tiles: grams, each one's share of the
// calories, and for protein its daily goal as a bar when there is one. Used by
// today's ring card and by the amount step (for the chosen amount).

import React from 'react';
import { macroShare, type Totals } from '@/lib/calories/calories';

const MACROS = [
  { k: 'p', name: 'חלבון' },
  { k: 'c', name: 'פחמימות' },
  { k: 'f', name: 'שומן' },
] as const;

const g = (v: number) => v.toLocaleString('he-IL', { maximumFractionDigits: v >= 10 ? 0 : 1 });

export default function Macros({ t, proteinGoal }: { t: Totals; proteinGoal?: number | null }) {
  const share = macroShare(t);
  return (
    <ul className="cal-macro-tiles" aria-label="חלבון, פחמימות ושומן">
      {MACROS.map(({ k, name }) => {
        const goal = k === 'p' && proteinGoal ? proteinGoal : null;
        return (
          <li key={k} className={`cal-macro is-${k}`}>
            <span className="cal-macro-name">{name}</span>
            <b>{g(t[k])}<small>{goal ? ` / ${goal}` : ''} ג׳</small></b>
            {goal ? (
              <span className="cal-bar" role="img" aria-label={`${g(t.p)} מתוך ${goal} גרם`}>
                <span style={{ width: `${Math.min(t.p / goal, 1) * 100}%` }} />
              </span>
            ) : null}
            <small className="cal-macro-share">{share[k] !== null ? `${share[k]}% מהקלוריות` : '—'}</small>
          </li>
        );
      })}
    </ul>
  );
}
