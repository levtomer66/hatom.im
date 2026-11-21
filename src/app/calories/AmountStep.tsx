'use client';

// How much: unit chips (grams, the pack, MoH portions, a meal's portion), a
// quantity stepper, and the live totals. Logs an entry, or (in a home-made
// meal's editor) returns an ingredient in grams.

import React, { useState } from 'react';
import { FaMinus, FaPlus } from 'react-icons/fa';
import { defaultAmount, entryTotals, scaleTotals, type Entry, type MealItem, type Totals, type Unit } from '@/lib/calories/calories';
import type { FoodHit } from '@/lib/calories/api-types';
import { Thumb } from '../shopping/ui';

/** The data.gov.il licence asks for the source by name. */
export const MOH_CREDIT = <>מקור: משרד הבריאות, מאגר התזונה הלאומי (<bdi>data.gov.il</bdi>)</>;

const isGrams = (u: Unit) => u.g === 1;
const stepOf = (u: Unit) => (isGrams(u) ? 10 : 0.5);
const fmtQty = (q: number) => q.toLocaleString('he-IL', { maximumFractionDigits: 2 });

/** "2 × יחידה בינונית", "150 גרם". */
export const amountText = (unit: Unit, qty: number) =>
  isGrams(unit) ? `${fmtQty(qty)} ${unit.name}` : unit.g === 0 ? unit.name : `${fmtQty(qty)} × ${unit.name}`;

function startOf(hit: FoodHit, initial?: { unit: Unit; qty: number }): { unit: Unit; qty: number } {
  if (initial) {
    const same = hit.units.find((u) => u.name === initial.unit.name);
    if (same) return { unit: same, qty: initial.qty };
  }
  return defaultAmount(hit.units, hit.source === 'meal');
}

export function totalsFor(hit: FoodHit, unit: Unit, qty: number): Totals | null {
  if (hit.per100) return entryTotals(hit.per100, unit.g * qty);
  if (hit.per) return scaleTotals(hit.per, qty);
  return null;
}

type Props = {
  hit: FoodHit;
  initial?: { unit: Unit; qty: number };
  busy?: boolean;
} & (
  | { mode: 'log'; onLog: (entry: Omit<Entry, 'id' | 'at' | 'meal'>) => void }
  | { mode: 'ingredient'; onIngredient: (item: MealItem) => void }
);

export default function AmountStep(props: Props) {
  const { hit, busy } = props;
  const start = startOf(hit, props.initial);
  const [unit, setUnit] = useState<Unit>(start.unit);
  const [qty, setQty] = useState(start.qty);
  const [typed, setTyped] = useState<string | null>(null);
  const t = totalsFor(hit, unit, qty);
  const valid = qty > 0 && unit.g * qty <= 5000 && !!t;

  const pick = (u: Unit) => {
    setUnit(u);
    setQty(isGrams(u) ? 100 : 1);
    setTyped(null);
  };
  const step = (dir: 1 | -1) => {
    const s = stepOf(unit);
    setQty((q) => Math.max(s, Math.round((q + dir * s) * 100) / 100));
    setTyped(null);
  };
  const submit = () => {
    if (!valid || !t) return;
    if (props.mode === 'log') props.onLog({ name: hit.name, img: hit.img, ref: hit.ref, unit, qty, nu: t });
    else props.onIngredient({ ref: hit.ref, name: hit.name, grams: Math.round(unit.g * qty * 10) / 10, nu: t });
  };

  return (
    <div className="cal-amount">
      <div className="cal-amount-head">
        <Thumb src={hit.img} size={56} />
        <div>
          <p className="cal-amount-name">{hit.name}</p>
          {hit.maker ? <p className="cal-muted">{hit.maker}</p> : null}
        </div>
      </div>
      <div className="cal-chips" role="radiogroup" aria-label="יחידה">
        {hit.units.map((u) => (
          <button key={u.name} type="button" role="radio" aria-checked={u === unit} className={`sh-chip ${u.name === unit.name ? 'is-on' : ''}`} onClick={() => pick(u)}>
            {u.name}{!isGrams(u) && hit.source !== 'meal' ? <small>{fmtQty(u.g)} ג׳</small> : null}
          </button>
        ))}
      </div>
      <div className="cal-amount-row">
        <div className="sh-stepper">
          <button type="button" aria-label="פחות" onClick={() => step(-1)}><FaMinus /></button>
          <input className="cal-qty-input" inputMode="decimal" aria-label="כמות" value={typed ?? fmtQty(qty)}
            onChange={(e) => {
              setTyped(e.target.value);
              const v = Number(e.target.value.replace(',', '.'));
              if (Number.isFinite(v) && v > 0) setQty(v);
            }}
            onBlur={() => setTyped(null)} />
          <button type="button" aria-label="יותר" onClick={() => step(1)}><FaPlus /></button>
        </div>
        <p className="cal-amount-total">
          <b>{t ? t.kcal.toLocaleString('he-IL') : '—'}</b> קק״ל
          {t ? <small>חלבון {t.p.toLocaleString('he-IL')} ג׳</small> : null}
        </p>
      </div>
      {unit.g * qty > 5000 ? <p className="cal-error">עד 5,000 גרם ברישום אחד</p> : null}
      <button type="button" className="sh-btn sh-btn--primary cal-wide" disabled={!valid || busy} onClick={submit}>
        {props.mode === 'log' ? (busy ? 'מוסיף…' : 'הוספה') : 'הוספה למתכון'}
      </button>
      {hit.source === 'moh' ? <p className="sh-credit">{MOH_CREDIT}</p> : null}
      {hit.source === 'manual' ? <p className="sh-credit">הערכים הוקלדו מהאריזה</p> : null}
    </div>
  );
}
