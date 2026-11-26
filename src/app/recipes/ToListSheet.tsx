'use client';

// 🛒: every ingredient with an amount, with a product to buy (its own, else
// the best catalog match). Pantry basics and what's already on the list
// start unticked. Adds to the household's list only, never to My items.
// A product picked here is remembered on the owner's recipe line.

import { useEffect, useState } from 'react';
import type { MatchLine } from '@/lib/recipes/api-types';
import type { Recipe } from '@/lib/recipes/types';
import Sheet from '../calories/Sheet';
import { Thumb } from '../shopping/ui';
import LinkPicker from './LinkPicker';
import * as api from './api';

export default function ToListSheet({ recipe, servings, mine, onDone }: {
  recipe: Recipe; servings: number; mine: boolean; onDone: (message: string | null, updated?: Recipe) => void;
}) {
  const [lines, setLines] = useState<MatchLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<MatchLine | null>(null);
  const [picks, setPicks] = useState<{ id: string; key: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.matchLines(recipe.id, servings).then(setLines, (e: unknown) => setError(e instanceof Error ? e.message : 'לא נטען'));
  }, [recipe.id, servings]);

  const ticked = (lines ?? []).filter((l) => l.ticked && l.product);
  const add = async () => {
    setBusy(true);
    try {
      const res = await api.toList(recipe.id, ticked.map((l) => ({ key: l.product!.key, qty: l.qty })), mine ? picks : []);
      onDone(ticked.length === 1 ? 'מוצר אחד נוסף לרשימה' : `${ticked.length} מוצרים נוספו לרשימה`, res.recipe);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא נוסף');
      setBusy(false);
    }
  };

  return (
    <Sheet title="לרשימת הקניות" onClose={() => onDone(null)}>
      {error ? <p className="cal-error" role="alert">{error}</p> : null}
      {!lines && !error ? <p className="cal-muted">מחפש מוצרים…</p> : null}
      {lines && !lines.length ? <p className="cal-muted">אין במתכון מצרכים עם כמות.</p> : null}
      {lines?.length ? (
        <ul className="rc-tolist">
          {lines.map((l) => (
            <li key={l.id} className={`rc-tolist-row ${l.ticked && l.product ? '' : 'is-off'}`}>
              <input type="checkbox" checked={l.ticked && !!l.product} disabled={!l.product} aria-label={l.text}
                onChange={(e) => setLines((ls) => ls!.map((x) => (x.id === l.id ? { ...x, ticked: e.target.checked } : x)))} />
              <button type="button" className="rc-tolist-product" onClick={() => setPicking(l)}>
                <Thumb src={l.product?.img} size={40} />
                <span>
                  <span className="rc-tolist-name">{l.product ? l.product.name : 'אין מוצר — לבחירה'}</span>
                  <small className="cal-muted">{l.text}</small>
                </span>
              </button>
              <span className="rc-tolist-qty">{l.product?.w ? `${l.qty} ק״ג` : `×${l.qty}`}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="sh-btn sh-btn--primary cal-wide" disabled={!ticked.length || busy} onClick={() => void add()}>
        {ticked.length ? `הוספת ${ticked.length} לרשימה` : 'לא סומן דבר'}
      </button>
      {picking ? (
        <LinkPicker name={picking.text} mode="product" onClose={() => setPicking(null)}
          onLinked={(l) => {
            if (!l.key) return;
            const key = l.key;
            const ing = recipe.ingredients.find((i) => i.id === picking.id);
            const grams = (ing?.grams ?? 0) * (servings / recipe.servings);
            setLines((ls) => ls!.map((x) => (x.id === picking.id ? {
              ...x, ticked: true,
              product: { key, name: l.name, img: l.img, w: l.w },
              qty: l.w ? Math.max(0.1, Math.ceil(grams / 100) / 10) : 1,
            } : x)));
            setPicks((p) => [...p.filter((x) => x.id !== picking.id), { id: picking.id, key }]);
            setPicking(null);
          }} />
      ) : null}
    </Sheet>
  );
}
