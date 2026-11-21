'use client';

// Find a food: one search over your home-made meals, MoH generic foods and
// catalog products; 📷 scans a barcode. Before typing (when logging): recent
// foods (one tap logs again), My items, quick add. A pick opens the amount
// step, or the label form for a product with no values yet.

import React, { useEffect, useRef, useState } from 'react';
import { FaBarcode, FaChevronRight, FaSearch } from 'react-icons/fa';
import { entryTotals, scaleTotals, type Entry, type MealItem, type Recent } from '@/lib/calories/calories';
import type { FoodHit, ProductResponse, SearchResponse } from '@/lib/calories/api-types';
import Scanner from '../shopping/Scanner';
import { Thumb } from '../shopping/ui';
import AmountStep, { amountText, MOH_CREDIT } from './AmountStep';
import LabelForm from './LabelForm';
import QuickAdd from './QuickAdd';
import { getProduct, myItems, search } from './api';

type LogFn = (entry: Omit<Entry, 'id' | 'at' | 'meal'>, per100: FoodHit['per100'], per?: FoodHit['per']) => void;

type Props = { busy?: boolean } & (
  | { mode: 'log'; recent: Recent[]; canShop: boolean; onLog: LogFn }
  | { mode: 'ingredient'; onIngredient: (item: MealItem) => void }
);

const EMPTY: SearchResponse = { meals: [], foods: [], products: [] };

/** A recent food's totals at its last amount; null when it can't be priced (a product nobody has typed yet). */
function recentTotals(r: Recent) {
  if (r.per100) return entryTotals(r.per100, r.unit.g * r.qty);
  if (r.per) return scaleTotals(r.per, r.qty);
  return null;
}

export default function FoodPicker(props: Props) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<SearchResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<FoodHit | ProductResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [quick, setQuick] = useState(false);
  const [mine, setMine] = useState<{ key: string; name: string }[]>([]);
  const logging = props.mode === 'log';
  const canShop = props.mode === 'log' && props.canShop;

  useEffect(() => {
    if (canShop) myItems().then(setMine).catch(() => setMine([]));
  }, [canShop]);

  // Debounced search, the previous one aborted.
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => {
    const text = q.trim();
    ctl.current?.abort();
    if (text.length < 2) {
      setRes(EMPTY);
      setLoading(false);
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

  const openProduct = async (key: string) => {
    setError(null);
    try {
      setPicked(await getProduct(key));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא מצאנו את הברקוד');
    }
  };

  if (scanning) {
    return <Scanner onClose={() => setScanning(false)} onCode={(code) => { setScanning(false); void openProduct(code); }} />;
  }

  if (picked) {
    const back = <button type="button" className="sh-btn sh-btn--ghost cal-back" onClick={() => setPicked(null)}><FaChevronRight aria-hidden /> חזרה לחיפוש</button>;
    if (!picked.per100 && !picked.per && 'key' in picked) {
      return (
        <>
          {back}
          <p className="cal-amount-name">{picked.name}</p>
          <LabelForm productKey={picked.key} liquid={picked.liquid} onSaved={(per100) => setPicked({ ...picked, per100, source: 'manual' })} />
        </>
      );
    }
    return (
      <>
        {back}
        {props.mode === 'log'
          ? <AmountStep mode="log" hit={picked} busy={props.busy} onLog={(e) => props.onLog(e, picked.per100, picked.per)} />
          : <AmountStep mode="ingredient" hit={{ ...picked, units: picked.units.filter((u) => u.g > 0) }} onIngredient={props.onIngredient} />}
      </>
    );
  }

  const groups: { title: string; hits: FoodHit[] }[] = [
    { title: 'הארוחות שלי', hits: logging ? res.meals : [] },
    { title: 'מזון כללי', hits: res.foods },
    { title: 'מוצרים', hits: res.products },
  ];
  const typed = q.trim().length >= 2;

  return (
    <div className="cal-picker">
      <div className="sh-search-box">
        <FaSearch aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ביצה, במבה, שקשוקה…" aria-label="חיפוש מזון" enterKeyHint="search" />
        {loading ? <span className="sh-spinner" aria-label="מחפש" /> : null}
        <button type="button" className="sh-icon-btn" aria-label="סריקת ברקוד" onClick={() => setScanning(true)}><FaBarcode /></button>
      </div>
      {error ? <p className="cal-error" role="alert">{error}</p> : null}

      {!typed && props.mode === 'log' ? (
        <>
          {props.recent.length ? (
            <>
              <h3 className="sh-section-title">אחרונים</h3>
              <ul className="cal-hits">
                {props.recent.map((r) => {
                  const t = recentTotals(r);
                  return (
                    <li key={`${r.ref.kind}:${r.ref.key ?? r.name}`}>
                      <button type="button" className="cal-hit" disabled={!t || props.busy}
                        onClick={() => t && props.onLog({ name: r.name, img: r.img, ref: r.ref, unit: r.unit, qty: r.qty, nu: t }, r.per100, r.per)}>
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
                {mine.slice(0, 30).map((m) => <button key={m.key} type="button" className="sh-chip" onClick={() => void openProduct(m.key)}>{m.name}</button>)}
              </div>
            </>
          ) : null}
          <h3 className="sh-section-title">
            <button type="button" className="cal-link" aria-expanded={quick} onClick={() => setQuick(!quick)}>הוספה מהירה {quick ? '▴' : '▾'}</button>
          </h3>
          {quick ? <QuickAdd busy={props.busy} onLog={(e) => props.onLog(e, null, e.nu)} /> : null}
        </>
      ) : null}

      {typed && !loading && !groups.some((g) => g.hits.length) ? <p className="sh-empty">לא מצאנו. אפשר לנסות מילה אחרת, לסרוק ברקוד או להוסיף מהר.</p> : null}
      {groups.filter((g) => g.hits.length).map((g) => (
        <section key={g.title}>
          <h3 className="sh-section-title">{g.title}</h3>
          <ul className="cal-hits">
            {g.hits.map((h) => (
              <li key={`${h.ref.kind}:${h.ref.key}`}>
                <button type="button" className="cal-hit" onClick={() => setPicked(h)}>
                  <Thumb src={h.img} size={40} />
                  <span className="cal-hit-name">{h.name}{h.maker ? <small>{h.maker}</small> : null}</span>
                  <span className="cal-hit-kcal">
                    {h.per100 ? <>{h.per100.kcal}<small>ל־100 ג׳</small></> : h.per ? <>{h.per.kcal}<small>למנה</small></> : <small>אין ערכים</small>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {g.title === 'מזון כללי' ? <p className="sh-credit">{MOH_CREDIT}</p> : null}
        </section>
      ))}
    </div>
  );
}
