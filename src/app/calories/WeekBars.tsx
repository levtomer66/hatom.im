'use client';

// The last 7 days ending on the shown day, with the goal line. A bar opens its day.

import React from 'react';
import type { WeekBar } from '@/lib/calories/api-types';

const DAY = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const weekday = (date: string) => DAY[new Date(`${date}T00:00:00Z`).getUTCDay()];

export default function WeekBars({ week, goal, shown, onPick }: { week: WeekBar[]; goal: number; shown: string; onPick: (date: string) => void }) {
  const top = Math.max(goal * 1.25, ...week.map((w) => w.kcal));
  return (
    <section className="cal-week" aria-label="השבוע">
      <h2 className="sh-section-title">7 הימים האחרונים</h2>
      <div className="cal-week-bars">
        <span className="cal-week-goal" style={{ bottom: `${(goal / top) * 100}%` }} aria-hidden />
        {week.map((w) => (
          <button key={w.date} type="button" className={`cal-week-day ${w.date === shown ? 'is-shown' : ''}`} onClick={() => onPick(w.date)}
            aria-label={`${w.date}: ${w.kcal.toLocaleString('he-IL')} קק״ל`}>
            <span className="cal-week-track">
              <span className={`cal-week-fill ${w.over ? 'is-over' : ''}`} style={{ height: `${(w.kcal / top) * 100}%` }} />
            </span>
            <small>{weekday(w.date)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
