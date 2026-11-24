'use client';

// "רשום מנה": servings of this recipe onto today's calories diary, in a
// meal (the hour's meal picked). The entry's values are frozen there.

import { useState } from 'react';
import { defaultMeal, MEALS, MEAL_NAMES, scaleTotals, type Meal, type Totals } from '@/lib/calories/calories';
import type { Recipe } from '@/lib/recipes/types';
import Sheet from '../calories/Sheet';
import * as api from './api';

const pad = (n: number) => String(n).padStart(2, '0');
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export default function LogSheet({ recipe, perServing, onDone }: { recipe: Recipe; perServing: Totals; onDone: (message: string | null) => void }) {
  const [meal, setMeal] = useState<Meal>(() => defaultMeal(new Date().getHours()));
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = scaleTotals(perServing, qty);

  const log = async () => {
    setBusy(true);
    try {
      await api.logServing(recipe.id, localToday(), meal, qty);
      onDone(`נרשם ליומן — ${MEAL_NAMES[meal]}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא נרשם');
      setBusy(false);
    }
  };

  return (
    <Sheet title="רישום ליומן הקלוריות" onClose={() => onDone(null)}>
      <div className="cal-chips cal-meal-chips">
        {MEALS.map((m) => (
          <button key={m} type="button" className={`sh-chip ${m === meal ? 'is-on' : ''}`} aria-pressed={m === meal} onClick={() => setMeal(m)}>{MEAL_NAMES[m]}</button>
        ))}
      </div>
      <div className="rc-log-row">
        <span className="sh-stepper" aria-label="מנות">
          <button type="button" onClick={() => setQty((q) => Math.min(20, q + 0.5))} aria-label="עוד חצי מנה">+</button>
          <span className="sh-qty" aria-live="polite">{qty}</span>
          <button type="button" onClick={() => setQty((q) => Math.max(0.5, q - 0.5))} disabled={qty <= 0.5} aria-label="פחות חצי מנה">−</button>
        </span>
        <span>{qty === 1 ? 'מנה' : 'מנות'} · <b>{t.kcal.toLocaleString('he-IL')}</b> קק״ל</span>
      </div>
      {error ? <p className="cal-error" role="alert">{error}</p> : null}
      <button type="button" className="sh-btn sh-btn--primary cal-wide" disabled={busy} onClick={() => void log()}>רישום</button>
    </Sheet>
  );
}
