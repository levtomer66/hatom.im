'use client';

// Links a recipe line. "nutrition": calories' FoodPicker (products and MoH
// foods with their values; the amount step confirms the grams). "product": a
// plain catalog search, for what to buy (🛒) or when the caller has no
// calories permission.

import { useEffect, useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import type { MealItem } from '@/lib/calories/calories';
import type { ProductLite } from '@/lib/recipes/api-types';
import type { Link } from '@/lib/recipes/types';
import FoodPicker from '../calories/FoodPicker';
import Sheet from '../calories/Sheet';
import { Thumb } from '../shopping/ui';
import * as api from './api';

export interface Linked { link: Link | null; grams: number | null; key: string | null; img: string | null; name: string; /** Sold by weight (product picks). */ w: boolean }

const r1 = (v: number) => Math.round(v * 10) / 10;

/** A FoodPicker ingredient (totals for its grams) → a link with values per 100 g. */
function fromMealItem(item: MealItem): Linked | null {
  const { kind, key } = item.ref;
  if ((kind !== 'product' && kind !== 'food') || !key || item.grams <= 0) return null;
  const f = 100 / item.grams;
  return {
    link: { ref: { kind, key }, name: item.name, img: null, per100: { kcal: Math.round(item.nu.kcal * f), p: r1(item.nu.p * f), c: r1(item.nu.c * f), f: r1(item.nu.f * f) } },
    grams: Math.round(item.grams),
    key: kind === 'product' ? key : null,
    img: null,
    name: item.name,
    w: false,
  };
}

export function ProductSearch({ initialQuery, onPick }: { initialQuery: string; onPick: (p: ProductLite) => void }) {
  const [q, setQ] = useState(initialQuery);
  const [hits, setHits] = useState<ProductLite[] | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      if (q.trim().length < 2) { setHits(null); return; }
      setLoading(true);
      api.searchProducts(q.trim(), ctl.signal)
        .then(setHits)
        .catch(() => { if (!ctl.signal.aborted) setHits([]); })
        .finally(() => { if (!ctl.signal.aborted) setLoading(false); });
    }, 300);
    return () => { window.clearTimeout(t); ctl.abort(); };
  }, [q]);
  return (
    <div className="cal-picker">
      <div className="sh-search-box">
        <FaSearch aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש מוצר" aria-label="חיפוש מוצר" />
        {loading ? <span className="sh-spinner" aria-label="מחפש" /> : null}
      </div>
      {hits && !hits.length && !loading ? <p className="cal-muted">לא נמצא מוצר.</p> : null}
      {hits?.length ? (
        <ul className="cal-hits">
          {hits.map((p) => (
            <li key={p.key}>
              <button type="button" className="cal-hit" onClick={() => onPick(p)}>
                <Thumb src={p.img} size={40} />
                <span className="cal-hit-name">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function LinkPicker({ name, mode, onLinked, onClose }: {
  name: string;
  mode: 'nutrition' | 'product';
  onLinked: (l: Linked) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={mode === 'nutrition' ? `קישור: ${name}` : `מוצר: ${name}`} onClose={onClose}>
      {mode === 'nutrition'
        ? <FoodPicker mode="ingredient" initialQuery={name} onIngredient={(item) => { const l = fromMealItem(item); if (l) onLinked(l); }} />
        : <ProductSearch initialQuery={name} onPick={(p) => onLinked({ link: null, grams: null, key: p.key, img: p.img, name: p.name, w: p.w })} />}
    </Sheet>
  );
}
