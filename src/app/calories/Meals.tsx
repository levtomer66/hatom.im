'use client';

// הארוחות שלי: home-made meals. A meal is ingredients (in grams) and a number
// of portions; logging one (from the search) takes a portion's values.

import React, { useEffect, useState } from 'react';
import { FaMinus, FaPlus } from 'react-icons/fa';
import { mealPerPortion, MAX_PORTIONS, type MealDoc, type MealItem } from '@/lib/calories/calories';
import { SwipeRow } from '../shopping/ui';
import FoodPicker from './FoodPicker';
import Sheet from './Sheet';
import { deleteMeal, listMeals, saveMeal } from './api';

type Draft = { id?: string; name: string; portions: number; items: MealItem[] };

function Editor({ draft: first, onDone }: { draft: Draft; onDone: () => void }) {
  const [d, setD] = useState<Draft>(first);
  const [adding, setAdding] = useState(first.items.length === 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const per = d.items.length ? mealPerPortion(d.items, d.portions) : null;

  if (adding) {
    return (
      <>
        <button type="button" className="sh-btn sh-btn--ghost cal-back" onClick={() => setAdding(false)}>חזרה למתכון</button>
        <FoodPicker mode="ingredient" onIngredient={(item) => { setD({ ...d, items: [...d.items, item] }); setAdding(false); }} />
      </>
    );
  }
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveMeal({ name: d.name, portions: d.portions, items: d.items }, d.id);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא נשמר');
      setBusy(false);
    }
  };
  return (
    <div className="cal-meal-editor">
      <label className="cal-field"><span>שם</span><input value={d.name} maxLength={80} placeholder="שקשוקה של שבת" onChange={(e) => setD({ ...d, name: e.target.value })} /></label>
      <div className="cal-amount-row">
        <span>מנות</span>
        <div className="sh-stepper">
          <button type="button" aria-label="פחות מנות" onClick={() => setD({ ...d, portions: Math.max(1, d.portions - 1) })}><FaMinus /></button>
          <span className="sh-qty">{d.portions}</span>
          <button type="button" aria-label="יותר מנות" onClick={() => setD({ ...d, portions: Math.min(MAX_PORTIONS, d.portions + 1) })}><FaPlus /></button>
        </div>
      </div>
      <h3 className="sh-section-title">מרכיבים</h3>
      <ul className="cal-entries">
        {d.items.map((it, i) => (
          <SwipeRow key={`${i}:${it.name}`} className="cal-entry" label="הסרה" onRemove={() => setD({ ...d, items: d.items.filter((_, j) => j !== i) })}>
            <span className="cal-entry-name">{it.name}<small>{it.grams.toLocaleString('he-IL')} גרם</small></span>
            <span className="cal-entry-kcal">{it.nu.kcal.toLocaleString('he-IL')}</span>
          </SwipeRow>
        ))}
      </ul>
      <button type="button" className="sh-btn cal-wide" onClick={() => setAdding(true)}>＋ מרכיב</button>
      {per ? <p className="cal-muted cal-per">למנה: {per.kcal.toLocaleString('he-IL')} קק״ל · חלבון {per.p} · פחמימות {per.c} · שומן {per.f} ג׳</p> : null}
      {error ? <p className="cal-error">{error}</p> : null}
      <button type="button" className="sh-btn sh-btn--primary cal-wide" disabled={busy || !d.name.trim() || !d.items.length} onClick={save}>{busy ? 'שומר…' : 'שמירה'}</button>
      {d.id ? (
        <button type="button" className="sh-btn sh-btn--danger cal-wide" disabled={busy}
          onClick={async () => { setBusy(true); await deleteMeal(d.id!).catch(() => null); onDone(); }}>מחיקת הארוחה</button>
      ) : null}
    </div>
  );
}

export default function MealsSheet({ onClose }: { onClose: () => void }) {
  const [meals, setMeals] = useState<MealDoc[] | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => listMeals().then(setMeals).catch((e) => setError(e instanceof Error ? e.message : 'לא נטען'));
  useEffect(() => { void load(); }, []);

  return (
    <Sheet title={editing ? (editing.id ? 'עריכת ארוחה' : 'ארוחה חדשה') : 'הארוחות שלי'} onClose={onClose}>
      {editing ? (
        <Editor draft={editing} onDone={() => { setEditing(null); void load(); }} />
      ) : (
        <>
          {error ? <p className="cal-error">{error}</p> : null}
          {meals && !meals.length ? <p className="sh-empty">עוד אין ארוחות. ארוחה היא מתכון: מרכיבים במשקל ומספר מנות, ואז רושמים מנה אחת בחיפוש.</p> : null}
          <ul className="cal-hits">
            {(meals ?? []).map((m) => (
              <li key={m.id}>
                <button type="button" className="cal-hit" onClick={() => setEditing({ id: m.id, name: m.name, portions: m.portions, items: m.items })}>
                  <span className="cal-hit-name">{m.name}<small>{m.portions} מנות · {m.items.length} מרכיבים</small></span>
                  <span className="cal-hit-kcal">{m.per.kcal}<small>למנה</small></span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="sh-btn sh-btn--primary cal-wide" onClick={() => setEditing({ name: '', portions: 4, items: [] })}>ארוחה חדשה</button>
        </>
      )}
    </Sheet>
  );
}
