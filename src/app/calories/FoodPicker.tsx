'use client';

// Find a food inside a sheet: one search over your home-made meals, MoH generic
// foods and catalog products; 📷 scans a barcode. Before typing (when logging):
// recent foods, My items, quick add. A pick opens the amount step, or the label
// form for a product with no values yet. `initial` opens straight on a pick
// (the day screen's search bar, a meal's "רישום").

import React, { useState } from 'react';
import { FaBarcode, FaChevronRight, FaSearch } from 'react-icons/fa';
import type { MealItem, Recent } from '@/lib/calories/calories';
import type { FoodHit, ProductResponse } from '@/lib/calories/api-types';
import Scanner from '../shopping/Scanner';
import AmountStep from './AmountStep';
import LabelForm from './LabelForm';
import { HitGroups, StartList, useFoodSearch, useMyItems, type LogFn } from './search-parts';
import { getProduct } from './api';

export type Picked = FoodHit | ProductResponse;

type Props = { busy?: boolean; initial?: Picked } & (
  | { mode: 'log'; recent: Recent[]; canShop: boolean; onLog: LogFn }
  | { mode: 'ingredient'; onIngredient: (item: MealItem) => void }
);

export default function FoodPicker(props: Props) {
  const [q, setQ] = useState('');
  const { res, loading, error: searchError, typed } = useFoodSearch(q);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked | null>(props.initial ?? null);
  const [scanning, setScanning] = useState(false);
  const logging = props.mode === 'log';
  const mine = useMyItems(props.mode === 'log' && props.canShop);

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

  const shownError = error ?? searchError;
  return (
    <div className="cal-picker">
      <div className="sh-search-box">
        <FaSearch aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ביצה, במבה, שקשוקה…" aria-label="חיפוש מזון" enterKeyHint="search" />
        {loading ? <span className="sh-spinner" aria-label="מחפש" /> : null}
        <button type="button" className="sh-icon-btn" aria-label="סריקת ברקוד" onClick={() => setScanning(true)}><FaBarcode /></button>
      </div>
      {shownError ? <p className="cal-error" role="alert">{shownError}</p> : null}
      {!typed && props.mode === 'log'
        ? <StartList recent={props.recent} mine={mine} busy={props.busy} onLog={props.onLog} onOpenProduct={(k) => void openProduct(k)} />
        : null}
      {typed ? <HitGroups res={res} withMeals={logging} loading={loading} onPick={setPicked} /> : null}
    </div>
  );
}
