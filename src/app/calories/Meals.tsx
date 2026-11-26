'use client';

// ארוחה (the button under the search): home-made meals. A meal is ingredients
// (in grams) and a number of portions; "רישום" logs portions of it (the amount
// sheet), and the search finds it too. The editor saves as you change it
// (useAutosave): a new meal is created once it has a name and an ingredient, and
// updated from then on. With the recipes permission the list also links to
// /recipes (?from=calories, whose header links back).

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FaBookOpen, FaMinus, FaPlus } from 'react-icons/fa';
import { mealHit, mealPerPortion, MAX_PORTIONS, type MealDoc, type MealItem } from '@/lib/calories/calories';
import type { FoodHit } from '@/lib/calories/api-types';
import { SwipeRow } from '../shopping/ui';
import FoodPicker from './FoodPicker';
import Sheet from './Sheet';
import { statusText, useAutosave } from './autosave';
import { deleteMeal, listMeals, saveMeal } from './api';

type Draft = { id?: string; name: string; portions: number; items: MealItem[] };

function Editor({ draft: first, onDone, onFlush }: { draft: Draft; onDone: () => void; onFlush: (flush: () => void) => void }) {
  const [d, setD] = useState<Draft>(first);
  const [id, setId] = useState(first.id);
  const [adding, setAdding] = useState(first.items.length === 0);
  const [busy, setBusy] = useState(false);
  const per = d.items.length ? mealPerPortion(d.items, d.portions) : null;
  const content = (x: Draft) => ({ name: x.name.trim(), portions: x.portions, items: x.items });
  const idRef = useRef(first.id);
  const { status, error, flush } = useAutosave(d.name.trim() && d.items.length ? content(d) : undefined, first.id ? content(first) : undefined, async (v) => {
    try {
      const m = await saveMeal(v, idRef.current);
      idRef.current = m.id;
      setId(m.id);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'לא נשמר';
    }
  });
  useEffect(() => { onFlush(flush); }, [onFlush, flush]);

  if (adding) {
    return (
      <>
        <button type="button" className="sh-btn sh-btn--ghost cal-back" onClick={() => setAdding(false)}>חזרה למתכון</button>
        <FoodPicker mode="ingredient" onIngredient={(item) => { setD({ ...d, items: [...d.items, item] }); setAdding(false); }} />
      </>
    );
  }
  const missing = !d.name.trim() ? 'נשמר כשיש שם ומרכיב אחד לפחות' : !d.items.length ? 'נשמר כשיש מרכיב אחד לפחות' : null;
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
      {error ? <p className="cal-error" role="alert">{error}</p> : null}
      <p className="cal-muted cal-save-state" aria-live="polite">{missing && status === 'idle' ? missing : statusText(status)}</p>
      <button type="button" className="sh-btn cal-wide" onClick={async () => { setBusy(true); await flush(); onDone(); }} disabled={busy}>חזרה לארוחות</button>
      {id ? (
        <button type="button" className="sh-btn sh-btn--danger cal-wide" disabled={busy}
          onClick={async () => { setBusy(true); await deleteMeal(id).catch(() => null); onDone(); }}>מחיקת הארוחה</button>
      ) : null}
    </div>
  );
}

export default function MealsSheet({ onLog, onClose, recipes = false }: { onLog: (hit: FoodHit) => void; onClose: () => void; recipes?: boolean }) {
  const flush = useRef<() => void>(() => {});
  const setFlush = useRef((f: () => void) => { flush.current = f; }).current;
  const [meals, setMeals] = useState<MealDoc[] | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => listMeals().then(setMeals).catch((e) => setError(e instanceof Error ? e.message : 'לא נטען'));
  useEffect(() => { void load(); }, []);

  return (
    <Sheet title={editing ? (editing.id ? 'עריכת ארוחה' : 'ארוחה חדשה') : 'ארוחות'} onClose={() => { flush.current(); onClose(); }}>
      {editing ? (
        <Editor draft={editing} onFlush={setFlush} onDone={() => { flush.current = () => {}; setEditing(null); void load(); }} />
      ) : (
        <>
          {error ? <p className="cal-error">{error}</p> : null}
          {meals && !meals.length ? <p className="sh-empty">עוד אין ארוחות. ארוחה היא מתכון: מרכיבים במשקל ומספר מנות, ואז רושמים מנות ממנה.</p> : null}
          <ul className="cal-hits">
            {(meals ?? []).map((m) => (
              <li key={m.id} className="cal-meal-row">
                <button type="button" className="cal-hit" onClick={() => setEditing({ id: m.id, name: m.name, portions: m.portions, items: m.items })}>
                  <span className="cal-hit-name">{m.name}<small>{m.portions} מנות · {m.items.length} מרכיבים · עריכה</small></span>
                  <span className="cal-hit-kcal">{m.per.kcal}<small>למנה</small></span>
                </button>
                <button type="button" className="sh-btn sh-btn--primary cal-log-btn" onClick={() => onLog(mealHit(m))}>רישום</button>
              </li>
            ))}
          </ul>
          <button type="button" className="sh-btn sh-btn--primary cal-wide" onClick={() => setEditing({ name: '', portions: 4, items: [] })}>ארוחה חדשה</button>
          {recipes ? <Link href="/recipes?from=calories" className="sh-btn cal-wide cal-recipes-link"><FaBookOpen aria-hidden /> מעבר לאפליקציית מתכונים</Link> : null}
        </>
      )}
    </Sheet>
  );
}
