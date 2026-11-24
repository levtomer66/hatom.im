'use client';

// The pieces of finding a food, shared by the day screen's search bar and the
// sheets' FoodPicker: the debounced search, the grouped results, and what shows
// before typing (recent foods, My items, quick add).

import React, { useEffect, useRef, useState } from 'react';
import { entryTotals, scaleTotals, type Entry, type Recent } from '@/lib/calories/calories';
import type { FoodHit, SearchResponse } from '@/lib/calories/api-types';
import { Thumb } from '../shopping/ui';
import { amountText, MOH_CREDIT } from './AmountStep';
import QuickAdd from './QuickAdd';
import { WarnChip } from './pregnant';
import { drinkById } from '@/lib/pregnancy/drinks';
import { myItems, search } from './api';

export type LogFn = (entry: Omit<Entry, 'id' | 'at' | 'meal'>, per100: FoodHit['per100'], per?: FoodHit['per']) => void;

export const EMPTY: SearchResponse = { meals: [], foods: [], products: [], drinks: [] };

/** A recent food's totals at its last amount; null when it can't be priced (a product nobody has typed yet). */
export function recentTotals(r: Recent) {
  if (r.per100) return entryTotals(r.per100, r.unit.g * r.qty);
  if (r.per) return scaleTotals(r.per, r.qty);
  return null;
}

/** Search after 250 ms of quiet, the previous request aborted; under 2 letters, nothing. */
export function useFoodSearch(q: string) {
  const [res, setRes] = useState<SearchResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => {
    const text = q.trim();
    ctl.current?.abort();
    if (text.length < 2) {
      setRes(EMPTY);
      setLoading(false);
      setError(null);
      return;
    }
    const c = new AbortController();
    ctl.current = c;
    setLoading(true);
    const t = window.setTimeout(() => {
      search(text, c.signal)
        .then((r) => { setRes(r); setError(null); })
        .catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'החיפוש נכשל'); })
        .finally(() => { if (!c.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(t); c.abort(); };
  }, [q]);
  return { res, loading, error, typed: q.trim().length >= 2 };
}

/** The household's My items that are food (only for people who can shop). */
export function useMyItems(canShop: boolean) {
  const [mine, setMine] = useState<{ key: string; name: string }[]>([]);
  useEffect(() => {
    if (canShop) myItems().then(setMine).catch(() => setMine([]));
  }, [canShop]);
  return mine;
}

export function HitGroups({ res, withMeals, loading, onPick }: { res: SearchResponse; withMeals: boolean; loading: boolean; onPick: (h: FoodHit) => void }) {
  const groups: { title: string; hits: FoodHit[] }[] = [
    { title: 'משקאות', hits: res.drinks ?? [] },
    { title: 'הארוחות שלי', hits: withMeals ? res.meals : [] },
    { title: 'מזון כללי', hits: res.foods },
    { title: 'מוצרים', hits: res.products },
  ];
  if (!loading && !groups.some((g) => g.hits.length)) return <p className="sh-empty">לא מצאנו. אפשר לנסות מילה אחרת, לסרוק ברקוד או להוסיף מהר.</p>;
  return (
    <>
      {groups.filter((g) => g.hits.length).map((g) => (
        <section key={g.title}>
          <h3 className="sh-section-title">{g.title}</h3>
          <ul className="cal-hits">
            {g.hits.map((h) => (
              <li key={`${h.ref.kind}:${h.ref.key}`}>
                <button type="button" className="cal-hit" onClick={() => onPick(h)}>
                  <Thumb src={h.img} size={40} />
                  <span className="cal-hit-name">{h.name} <WarnChip name={h.name} text={h.ref.kind === 'drink' && h.ref.key ? drinkById(h.ref.key)?.warn : undefined} />{h.maker ? <small>{h.maker}</small> : null}</span>
                  <span className="cal-hit-kcal">
                    {h.source === 'drink' ? <>☕ {h.caf}<small>מ״ג ל{h.units[0]?.name}</small></> : h.per100 ? <>{h.per100.kcal}<small>ל־100 ג׳</small></> : h.per ? <>{h.per.kcal}<small>למנה</small></> : <small>אין ערכים</small>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {g.title === 'מזון כללי' ? <p className="sh-credit">{MOH_CREDIT}</p> : null}
        </section>
      ))}
    </>
  );
}

/** Before typing: recent foods (one tap logs again), My items, quick add. */
export function StartList({ recent, mine, busy, onLog, onOpenProduct }: {
  recent: Recent[]; mine: { key: string; name: string }[]; busy?: boolean; onLog: LogFn; onOpenProduct: (key: string) => void;
}) {
  const [quick, setQuick] = useState(false);
  return (
    <>
      {recent.length ? (
        <>
          <h3 className="sh-section-title">אחרונים</h3>
          <ul className="cal-hits">
            {recent.map((r) => {
              const t = recentTotals(r);
              return (
                <li key={`${r.ref.kind}:${r.ref.key ?? r.name}`}>
                  <button type="button" className="cal-hit" disabled={!t || busy}
                    onClick={() => t && onLog({ name: r.name, img: r.img, ref: r.ref, unit: r.unit, qty: r.qty, nu: t }, r.per100, r.per)}>
                    <Thumb src={r.img} size={40} />
                    <span className="cal-hit-name">{r.name}<small>{amountText(r.unit, r.qty)}</small></span>
                    <span className="cal-hit-kcal">{t ? `${t.kcal} קק״ל` : ''}<small>＋</small></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {mine.length ? (
        <>
          <h3 className="sh-section-title">המוצרים שלי</h3>
          <div className="cal-chips is-scroll">
            {mine.slice(0, 30).map((m) => <button key={m.key} type="button" className="sh-chip" onClick={() => onOpenProduct(m.key)}>{m.name}</button>)}
          </div>
        </>
      ) : null}
      <h3 className="sh-section-title">
        <button type="button" className="cal-link" aria-expanded={quick} onClick={() => setQuick(!quick)}>הוספה מהירה {quick ? '▴' : '▾'}</button>
      </h3>
      {quick ? <QuickAdd busy={busy} onLog={(e) => onLog(e, null, e.nu)} /> : null}
    </>
  );
}
