'use client';

// A product with no nutrition values: type them from the package, per 100 g.
// Saved per barcode for everyone (PUT /api/calories/label).

import React, { useState } from 'react';
import type { Totals } from '@/lib/calories/calories';
import { putLabel } from './api';

const FIELDS = [
  { k: 'kcal', label: 'קלוריות (קק״ל)', required: true },
  { k: 'p', label: 'חלבונים (ג׳)' },
  { k: 'c', label: 'פחמימות (ג׳)' },
  { k: 'f', label: 'שומנים (ג׳)' },
] as const;

export default function LabelForm({ productKey, liquid, onSaved }: { productKey: string; liquid: boolean; onSaved: (per100: Totals) => void }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const num = (s: string | undefined) => (s && s.trim() ? Number(s.replace(',', '.')) : null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await putLabel(productKey, Object.fromEntries(FIELDS.map((f) => [f.k, num(vals[f.k])]))));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא נשמר');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="cal-label" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <p className="cal-label-title">אין לנו ערכים למוצר הזה. מהאריזה, ל־100 {liquid ? 'מ״ל' : 'גרם'}:</p>
      <div className="cal-label-grid">
        {FIELDS.map((f) => (
          <label key={f.k}>
            <span>{f.label}</span>
            <input inputMode="decimal" required={'required' in f} value={vals[f.k] ?? ''} onChange={(e) => setVals({ ...vals, [f.k]: e.target.value })} />
          </label>
        ))}
      </div>
      {error ? <p className="cal-error">{error}</p> : null}
      <button type="submit" className="sh-btn sh-btn--primary cal-wide" disabled={busy || !num(vals.kcal) && num(vals.kcal) !== 0}>{busy ? 'שומר…' : 'שמירה והמשך'}</button>
      <p className="sh-credit">נשמר לכולם, לפי הברקוד.</p>
    </form>
  );
}
