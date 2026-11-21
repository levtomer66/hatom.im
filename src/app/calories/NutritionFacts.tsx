'use client';

// "ערכים תזונתיים" in the amount step, shaped like /shopping's product window:
// one tile per nutrient on the label, per 100 g (ml) or for the amount chosen
// above. Products and MoH foods only — a home-made meal has just its totals.

import React, { useState } from 'react';
import { forGrams, NUTRIENT_INFO, NUTRIENTS, type Nutrition } from '@/lib/shopping/nutrition';

const fmt = (v: number, digits: number) =>
  v.toLocaleString('he-IL', { maximumFractionDigits: v >= 100 ? 0 : digits });

export default function NutritionFacts({ label, grams, liquid }: { label: Nutrition; grams: number; liquid?: boolean }) {
  const [forAmount, setForAmount] = useState(false);
  const unit = liquid ? 'מ״ל' : 'גרם';
  const shown = NUTRIENTS.filter((k) => label[k] !== null);
  if (!shown.length) return null;
  const canScale = grams > 0 && grams !== 100;
  const base = forAmount && canScale ? grams : 100;
  return (
    <section className="sh-sheet-section sh-nu cal-facts" aria-label="ערכים תזונתיים">
      <div className="cal-facts-head">
        <h3 className="sh-section-title">ערכים תזונתיים</h3>
        {canScale ? (
          <div className="sh-seg sh-nu-toggle" role="tablist" aria-label="כמות">
            <button type="button" role="tab" aria-selected={!forAmount} className={!forAmount ? 'is-on' : ''} onClick={() => setForAmount(false)}>ל־100 {unit}</button>
            <button type="button" role="tab" aria-selected={forAmount} className={forAmount ? 'is-on' : ''} onClick={() => setForAmount(true)}>לכמות ({fmt(grams, 0)} {unit})</button>
          </div>
        ) : <small className="cal-muted">ל־100 {unit}</small>}
      </div>
      <ul className="sh-nu-tiles">
        {shown.map((k) => {
          const info = NUTRIENT_INFO[k];
          return (
            <li key={k} className={`sh-nu-tile ${k === 's' || k === 'sf' ? 'is-sub' : ''}`}>
              <b>{fmt(forGrams(label[k], base)!, info.digits)}</b>
              <small>{info.unit}</small>
              <span>{info.name}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
