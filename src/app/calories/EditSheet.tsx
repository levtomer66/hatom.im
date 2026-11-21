'use client';

// One logged entry: change the amount or the meal, delete it, or 🛒 put the
// product on the household shopping list.

import React, { useState } from 'react';
import { FaMinus, FaPlus, FaShoppingCart } from 'react-icons/fa';
import { MEALS, MEAL_NAMES, scaleTotals, type Entry, type Meal } from '@/lib/calories/calories';
import { Thumb } from '../shopping/ui';
import { amountText } from './AmountStep';
import Sheet from './Sheet';
import { toList } from './api';

export default function EditSheet({ entry, canShop, onSave, onDelete, onClose }: {
  entry: Entry;
  canShop: boolean;
  onSave: (patch: { meal?: Meal; qty?: number }) => Promise<boolean>;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(entry.qty);
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const [busy, setBusy] = useState(false);
  const [listed, setListed] = useState<'idle' | 'busy' | 'done' | string>('idle');
  const quick = entry.ref.kind === 'quick';
  const step = entry.unit.g === 1 ? 10 : 0.5;
  const t = scaleTotals(entry.nu, qty / entry.qty);
  const tooBig = !quick && entry.unit.g * qty > 5000;
  const changed = qty !== entry.qty || meal !== entry.meal;

  return (
    <Sheet title="עריכת רישום" onClose={onClose}>
      <div className="cal-amount-head">
        <Thumb src={entry.img} size={56} />
        <div>
          <p className="cal-amount-name">{entry.name}</p>
          <p className="cal-muted">{amountText(entry.unit, qty)} · {t.kcal.toLocaleString('he-IL')} קק״ל · חלבון {t.p.toLocaleString('he-IL')} ג׳</p>
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
      {tooBig ? <p className="cal-error">עד 5,000 גרם ברישום אחד</p> : null}
      <div className="cal-chips" role="radiogroup" aria-label="ארוחה">
        {MEALS.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={m === meal} className={`sh-chip ${m === meal ? 'is-on' : ''}`} onClick={() => setMeal(m)}>{MEAL_NAMES[m]}</button>
        ))}
      </div>
      <button type="button" className="sh-btn sh-btn--primary cal-wide" disabled={!changed || tooBig || busy}
        onClick={async () => {
          setBusy(true);
          const ok = await onSave({ ...(qty !== entry.qty ? { qty } : {}), ...(meal !== entry.meal ? { meal } : {}) });
          setBusy(false);
          if (ok) onClose();
        }}>
        {busy ? 'שומר…' : 'שמירה'}
      </button>
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
