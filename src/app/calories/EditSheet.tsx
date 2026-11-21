'use client';

// One logged entry: protein · carbs · fat for the amount and, for a product or an
// MoH food, its full label (fetched when the sheet opens); change the amount or the meal (saved as you change them,
// useAutosave — no save button), delete it, or 🛒 put the product on the
// household shopping list.

import React, { useEffect, useState } from 'react';
import type { Nutrition } from '@/lib/shopping/nutrition';
import { FaMinus, FaPlus, FaShoppingCart } from 'react-icons/fa';
import { MEALS, MEAL_NAMES, scaleTotals, type Entry, type Meal } from '@/lib/calories/calories';
import { Thumb } from '../shopping/ui';
import { amountText } from './AmountStep';
import Sheet from './Sheet';
import { statusText, useAutosave } from './autosave';
import { getFood, getProduct, toList } from './api';
import Macros from './Macros';
import NutritionFacts from './NutritionFacts';
import { MOH_CREDIT } from './AmountStep';

export default function EditSheet({ entry, canShop, onSave, onDelete, onClose }: {
  entry: Entry;
  canShop: boolean;
  onSave: (patch: { meal?: Meal; qty?: number }) => Promise<boolean>;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(entry.qty);
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const [listed, setListed] = useState<'idle' | 'busy' | 'done' | string>('idle');
  const quick = entry.ref.kind === 'quick';
  const [facts, setFacts] = useState<{ label: Nutrition; liquid: boolean; moh: boolean } | null>(null);
  useEffect(() => {
    const { kind, key } = entry.ref;
    if (!key || (kind !== 'product' && kind !== 'food')) return;
    let live = true;
    (kind === 'product' ? getProduct(key) : getFood(key))
      .then((h) => { if (live && h.label) setFacts({ label: h.label, liquid: 'liquid' in h && h.liquid === true, moh: h.source === 'moh' }); })
      .catch(() => {});
    return () => { live = false; };
  }, [entry.ref]);
  const step = entry.unit.g === 1 ? 10 : 0.5;
  const t = scaleTotals(entry.nu, qty / entry.qty);
  const tooBig = !quick && entry.unit.g * qty > 5000;
  const { status, error, flush } = useAutosave(tooBig ? undefined : { qty, meal }, { qty: entry.qty, meal: entry.meal },
    async (v) => ((await onSave(v)) ? null : 'לא נשמר'), 500);
  const close = () => { flush(); onClose(); };

  return (
    <Sheet title="עריכת רישום" onClose={close}>
      <div className="cal-amount-head">
        <Thumb src={entry.img} size={56} />
        <div>
          <p className="cal-amount-name">{entry.name}</p>
          <p className="cal-muted">{amountText(entry.unit, qty)} · {t.kcal.toLocaleString('he-IL')} קק״ל</p>
        </div>
      </div>
      {!quick ? (
        <div className="cal-amount-row">
          <div className="sh-stepper">
            <button type="button" aria-label="פחות" onClick={() => setQty((q) => Math.max(step, Math.round((q - step) * 100) / 100))}><FaMinus /></button>
            <span className="sh-qty">{qty.toLocaleString('he-IL', { maximumFractionDigits: 2 })}</span>
            <button type="button" aria-label="יותר" onClick={() => setQty((q) => Math.round((q + step) * 100) / 100)}><FaPlus /></button>
          </div>
          <span className="cal-muted">{entry.unit.g === 1 ? entry.unit.name : `× ${entry.unit.name}`}</span>
        </div>
      ) : null}
      <Macros t={t} />
      {tooBig ? <p className="cal-error">עד 5,000 גרם ברישום אחד</p> : null}
      <div className="cal-chips" role="radiogroup" aria-label="ארוחה">
        {MEALS.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={m === meal} className={`sh-chip ${m === meal ? 'is-on' : ''}`} onClick={() => setMeal(m)}>{MEAL_NAMES[m]}</button>
        ))}
      </div>
      <p className="cal-muted cal-save-state" aria-live="polite">{statusText(status)}</p>
      {facts && !quick ? <NutritionFacts label={facts.label} grams={Math.round(entry.unit.g * qty * 10) / 10} liquid={facts.liquid} /> : null}
      {facts?.moh ? <p className="sh-credit">{MOH_CREDIT}</p> : null}
      {error ? <p className="cal-error" role="alert">{error}</p> : null}
      <div className="cal-edit-actions">
        {canShop && entry.ref.kind === 'product' && entry.ref.key ? (
          <button type="button" className="sh-btn" disabled={listed === 'busy' || listed === 'done'}
            onClick={async () => {
              setListed('busy');
              try {
                await toList(entry.ref.key!);
                setListed('done');
              } catch (e) {
                setListed(e instanceof Error ? e.message : 'לא נוסף');
              }
            }}>
            <FaShoppingCart aria-hidden /> {listed === 'done' ? 'נוסף לרשימה' : 'לרשימה'}
          </button>
        ) : null}
        <button type="button" className="sh-btn sh-btn--danger" onClick={onDelete}>מחיקה</button>
      </div>
      {listed !== 'idle' && listed !== 'busy' && listed !== 'done' ? <p className="cal-error">{listed}</p> : null}
    </Sheet>
  );
}
