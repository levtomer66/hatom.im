'use client';

// "הוספה מהירה": a name and kcal (protein, carbs, fat optional), no product.

import React, { useState } from 'react';
import type { Entry } from '@/lib/calories/calories';

export default function QuickAdd({ busy, onLog }: { busy?: boolean; onLog: (entry: Omit<Entry, 'id' | 'at' | 'meal'>) => void }) {
  const [name, setName] = useState('');
  const [v, setV] = useState({ kcal: '', p: '', c: '', f: '' });
  const n = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : 0);
  const kcal = n(v.kcal);
  const ok = name.trim().length > 0 && Number.isFinite(kcal) && kcal > 0 && kcal <= 20000 && [v.p, v.c, v.f].every((x) => Number.isFinite(n(x)) && n(x) >= 0);
  return (
    <form className="cal-quick" onSubmit={(e) => {
      e.preventDefault();
      if (!ok) return;
      onLog({ name: name.trim(), img: null, ref: { kind: 'quick', key: null }, unit: { name: 'מנה', g: 0 }, qty: 1, nu: { kcal: Math.round(kcal), p: n(v.p), c: n(v.c), f: n(v.f) } });
    }}>
      <label className="cal-field"><span>מה אכלתי</span><input value={name} maxLength={80} placeholder="ארוחת צהריים במסעדה" onChange={(e) => setName(e.target.value)} /></label>
      <div className="cal-label-grid">
        <label><span>קלוריות</span><input inputMode="numeric" value={v.kcal} onChange={(e) => setV({ ...v, kcal: e.target.value })} /></label>
        <label><span>חלבון (ג׳)</span><input inputMode="decimal" value={v.p} onChange={(e) => setV({ ...v, p: e.target.value })} /></label>
        <label><span>פחמימות (ג׳)</span><input inputMode="decimal" value={v.c} onChange={(e) => setV({ ...v, c: e.target.value })} /></label>
        <label><span>שומן (ג׳)</span><input inputMode="decimal" value={v.f} onChange={(e) => setV({ ...v, f: e.target.value })} /></label>
      </div>
      <button type="submit" className="sh-btn sh-btn--primary cal-wide" disabled={!ok || busy}>{busy ? 'מוסיף…' : 'הוספה'}</button>
    </form>
  );
}
