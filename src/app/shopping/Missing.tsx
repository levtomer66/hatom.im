'use client';

// "מה חסר?": My items as a checklist by department, a live view of the
// shopping list: ticking puts an item on it at its usual quantity, unticking
// takes it off, and the steppers change its quantity there. "בחר הכול" ticks a
// department, or all. The search at the top adds a new product to My items and
// ticks it. The page owns the list and saves it (debounced, like its own edits).
import { useEffect, useMemo, useRef, useState } from 'react';
import { FaMinus, FaPlus, FaSearch, FaTimes } from 'react-icons/fa';
import { DEPARTMENTS } from '@/lib/shopping/departments';
import { addToList, normalizeQty, type ListLine, type MyItem } from '@/lib/shopping/home';
import { SHOPPING_API_PATH } from '@/lib/shopping/config';
import type { SearchHit } from '@/lib/shopping/api-types';
import type { HomeMeta } from './home-client';
import { Thumb } from './ui';

const step = (w: boolean) => (w ? 0.5 : 1);
const OTHER = { id: 'other', name: 'אחר' };

export default function Missing({ items, list, meta, near, onSaveItem, onListChange, onOpenItem, onClose }: {
  items: MyItem[];
  list: ListLine[];
  meta: HomeMeta;
  /** The pricing routes' location query (where.ts nearQuery). */
  near: string;
  /** Save a new product to My items (the page owns the save). */
  onSaveItem: (hit: { key: string; name: string; w: boolean }) => Promise<void>;
  /** Change the shopping list (the page's own updater, so edits made elsewhere aren't lost). */
  onListChange: (fn: (lines: ListLine[]) => ListLine[]) => void;
  /** Opens the product window; the photo does it (the name ticks the row). */
  onOpenItem: (key: string) => void;
  onClose: () => void;
}) {
  /** On the list → its quantity there. */
  const onList = useMemo(() => new Map(list.map((l) => [l.key, l.qty])), [list]);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return setHits(null);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`${SHOPPING_API_PATH}/search?q=${encodeURIComponent(q)}&${near}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : null)).then((h) => h && setHits(h)).catch(() => {});
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [query, near]);

  const groups = useMemo(() => {
    const by = new Map<string, MyItem[]>();
    for (const i of items) {
      const d = meta[i.key]?.d ?? OTHER.id;
      by.set(d, [...(by.get(d) ?? []), i]);
    }
    return [...DEPARTMENTS, OTHER].filter((d) => by.has(d.id)).map((d) => ({ ...d, items: by.get(d.id)! }));
  }, [items, meta]);

  const line = (i: Pick<MyItem, 'key' | 'name' | 'w' | 'qty'>): ListLine => ({ key: i.key, name: i.name, w: i.w, qty: i.qty });
  /** Tick: onto the list at the usual quantity (addToList keeps the 100-line cap). Untick: off it. */
  const toggle = (i: MyItem) => onListChange((lines) =>
    lines.some((l) => l.key === i.key) ? lines.filter((l) => l.key !== i.key) : addToList(lines, [line(i)]));
  const allOn = (of: MyItem[]) => of.length > 0 && of.every((i) => onList.has(i.key));
  /** Put every item of `of` on the list (those there keep their quantity), or take them all off. */
  const setAll = (of: MyItem[], on: boolean) => onListChange((lines) => {
    if (on) return addToList(lines, of.map(line));
    const off = new Set(of.map((i) => i.key));
    return lines.filter((l) => !off.has(l.key));
  });
  const allButton = (of: MyItem[], label: string) => {
    if (!of.length) return null;
    const on = allOn(of);
    return (
      <button type="button" className="sh-link sh-missing-all" onClick={() => setAll(of, !on)} aria-pressed={on}
        aria-label={`${on ? 'ניקוי' : 'בחירת'} הכול: ${label}`}>
        {on ? 'נקה הכול' : 'בחר הכול'}
      </button>
    );
  };
  /** + on an item not on the list puts it there (at the usual quantity); on the list, ± changes its quantity. */
  const stepQty = (i: MyItem, dir: 1 | -1) => {
    if (!onList.has(i.key)) {
      if (dir === 1) toggle(i);
      return;
    }
    onListChange((lines) => lines.map((l) => {
      if (l.key !== i.key) return l;
      const q = normalizeQty(l.qty + dir * step(l.w), l.w);
      return q === null ? l : { ...l, qty: q };
    }));
  };

  const addHit = async (h: SearchHit) => {
    setQuery('');
    setHits(null);
    setError(false);
    if (!items.some((i) => i.key === h.key)) {
      try {
        await onSaveItem(h);
      } catch {
        return setError(true);
      }
    }
    const usual = items.find((i) => i.key === h.key)?.qty ?? 1;
    onListChange((lines) => addToList(lines, [{ key: h.key, name: h.name, w: h.w, qty: usual }]));
  };

  return (
    <div className="sh-sheet-backdrop" onClick={onClose}>
      <div className="sh-sheet sh-missing" role="dialog" aria-modal="true" aria-labelledby="sh-missing-title" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} type="button" className="sh-icon-btn sh-sheet-close" onClick={onClose} aria-label="סגירה"><FaTimes /></button>
        <h2 id="sh-missing-title" className="sh-h2">מה חסר?</h2>
        <section className="sh-search">
          <label className="sh-search-box">
            <FaSearch aria-hidden />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="מוצר שעוד לא במוצרים שלי" aria-label="חיפוש מוצר להוספה" autoComplete="off" enterKeyHint="search" />
          </label>
          {hits && (
            <ul className="sh-hits">
              {!hits.length && <li className="sh-muted sh-hits-empty">לא נמצאו מוצרים</li>}
              {hits.slice(0, 8).map((h) => (
                <li key={h.key} className="sh-hit">
                  <button type="button" className="sh-hit-main" onClick={() => addHit(h)}>
                    <Thumb src={h.img} size={36} by={h.imgBy} />
                    <span className="sh-hit-name">{h.name}</span>
                  </button>
                  <button type="button" className="sh-hit-btn sh-hit-btn--add" onClick={() => addHit(h)} aria-label={`הוספה: ${h.name}`}><FaPlus aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!items.length && <p className="sh-empty">עוד אין מוצרים שלי. חפשו מוצר למעלה כדי להוסיף.</p>}
        {groups.length > 1 && (
          <div className="sh-missing-allrow">
            <span className="sh-muted">כל המוצרים</span>
            {allButton(items, 'כל המוצרים')}
          </div>
        )}
        {groups.map((g) => (
          <section key={g.id} className="sh-sheet-section">
            <h3 className="sh-section-title sh-missing-dept">
              <span>{g.name}</span>
              {allButton(g.items, g.name)}
            </h3>
            <ul className="sh-items">
              {g.items.map((i) => {
                const on = onList.has(i.key);
                const qty = onList.get(i.key) ?? i.qty;
                return (
                  <li key={i.key} className={`sh-item sh-missing-row ${on ? 'is-on' : ''}`}>
                    <label className="sh-missing-box">
                      <input id={`sh-miss-${i.key}`} type="checkbox" checked={on} onChange={() => toggle(i)} />
                    </label>
                    <button type="button" className="sh-missing-photo" onClick={() => onOpenItem(i.key)} aria-label={`פרטי המוצר: ${i.name}`}>
                      <Thumb src={meta[i.key]?.img} size={36} by={meta[i.key]?.imgBy} />
                    </button>
                    <label className="sh-missing-pick" htmlFor={`sh-miss-${i.key}`}>
                      <span className="sh-item-name">{i.name}</span>
                    </label>
                    <span className="sh-stepper">
                      <button type="button" onClick={() => stepQty(i, 1)} aria-label={`עוד ${i.name}`}><FaPlus /></button>
                      <span className="sh-qty" aria-live="polite">{i.w ? `${qty} ק״ג` : qty}</span>
                      <button type="button" onClick={() => stepQty(i, -1)} disabled={!on || normalizeQty(qty - step(i.w), i.w) === null}
                        aria-label={`פחות ${i.name}`}><FaMinus /></button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {error && <p className="sh-error">לא נשמר, נסו שוב</p>}
      </div>
    </div>
  );
}
