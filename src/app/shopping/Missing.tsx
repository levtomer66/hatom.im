'use client';

// "מה חסר?": My items as a checklist by department, each at its usual
// quantity. Ticked ones go on the shopping list; items already on it show
// ticked and can't be picked again. "בחר הכול" ticks a department, or all. The search at the top adds a new product
// to My items and ticks it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { FaCheck, FaMinus, FaPlus, FaSearch, FaTimes } from 'react-icons/fa';
import { DEPARTMENTS } from '@/lib/shopping/departments';
import { normalizeQty, type ListLine, type MyItem } from '@/lib/shopping/home';
import { SHOPPING_API_PATH } from '@/lib/shopping/config';
import type { SearchHit } from '@/lib/shopping/api-types';
import { submitMissing, type HomeMeta, type HomeView } from './home-client';
import { Thumb } from './ui';

const step = (w: boolean) => (w ? 0.5 : 1);
const OTHER = { id: 'other', name: 'אחר' };

export default function Missing({ items, list, meta, near, homeId, onSaveItem, onAdded, onClose }: {
  items: MyItem[];
  list: ListLine[];
  meta: HomeMeta;
  /** The pricing routes' location query (where.ts nearQuery). */
  near: string;
  /** The household these items are in (the server refuses the add once the caller is in another). */
  homeId: string;
  /** Save a new product to My items (the page owns the save). */
  onSaveItem: (hit: { key: string; name: string; w: boolean }) => Promise<void>;
  onAdded: (home: HomeView) => void;
  onClose: () => void;
}) {
  const onList = useMemo(() => new Set(list.map((l) => l.key)), [list]);
  /** Ticked keys → the quantity for this shop. */
  const [picks, setPicks] = useState<Map<string, number>>(new Map());
  const [saving, setSaving] = useState(false);
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

  const toggle = (i: MyItem) => setPicks((m) => {
    const n = new Map(m);
    if (n.has(i.key)) n.delete(i.key);
    else n.set(i.key, i.qty);
    return n;
  });
  /** Items that can still be picked (not on the list already). */
  const pickable = (of: MyItem[]) => of.filter((i) => !onList.has(i.key));
  const allPicked = (of: MyItem[]) => { const p = pickable(of); return p.length > 0 && p.every((i) => picks.has(i.key)); };
  /** Tick every pickable item at its usual quantity (a picked one keeps its quantity), or untick them all. */
  const setAll = (of: MyItem[], on: boolean) => setPicks((m) => {
    const n = new Map(m);
    for (const i of pickable(of)) {
      if (!on) n.delete(i.key);
      else if (!n.has(i.key)) n.set(i.key, i.qty);
    }
    return n;
  });
  const allButton = (of: MyItem[], label: string) => {
    if (!pickable(of).length) return null;
    const on = allPicked(of);
    return (
      <button type="button" className="sh-link sh-missing-all" onClick={() => setAll(of, !on)} aria-pressed={on}
        aria-label={`${on ? 'ניקוי' : 'בחירת'} הכול: ${label}`}>
        {on ? 'נקה הכול' : 'בחר הכול'}
      </button>
    );
  };
  const stepPick = (i: MyItem, dir: 1 | -1) => setPicks((m) => {
    const cur = m.get(i.key) ?? i.qty;
    const q = normalizeQty(cur + dir * step(i.w), i.w);
    return q === null ? m : new Map(m).set(i.key, q);
  });

  const addHit = async (h: SearchHit) => {
    setQuery('');
    setHits(null);
    if (!items.some((i) => i.key === h.key)) {
      try {
        await onSaveItem(h);
      } catch {
        return setError(true);
      }
    }
    if (!onList.has(h.key)) setPicks((m) => new Map(m).set(h.key, items.find((i) => i.key === h.key)?.qty ?? 1));
  };

  const submit = async () => {
    if (!picks.size) return;
    setSaving(true);
    setError(false);
    try {
      onAdded(await submitMissing([...picks].map(([key, qty]) => ({ key, qty })), homeId));
    } catch {
      setError(true);
      setSaving(false);
    }
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
                const already = onList.has(i.key);
                const picked = picks.has(i.key);
                const qty = picks.get(i.key) ?? i.qty;
                return (
                  <li key={i.key} className={`sh-item sh-missing-row ${picked || already ? 'is-on' : ''}`}>
                    <label className="sh-missing-pick">
                      <input type="checkbox" checked={picked || already} disabled={already} onChange={() => toggle(i)} />
                      <Thumb src={meta[i.key]?.img} size={36} by={meta[i.key]?.imgBy} />
                      <span className="sh-item-name">{i.name}{already && <small className="sh-muted"> · כבר ברשימה</small>}</span>
                    </label>
                    {!already && (
                      <span className="sh-stepper">
                        <button type="button" onClick={() => { if (!picked) toggle(i); stepPick(i, 1); }} aria-label={`עוד ${i.name}`}><FaPlus /></button>
                        <span className="sh-qty" aria-live="polite">{i.w ? `${qty} ק״ג` : qty}</span>
                        <button type="button" onClick={() => stepPick(i, -1)} disabled={normalizeQty(qty - step(i.w), i.w) === null}
                          aria-label={`פחות ${i.name}`}><FaMinus /></button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {error && <p className="sh-error">לא נשמר, נסו שוב</p>}
        <div className="sh-missing-foot">
          <button type="button" className="sh-btn sh-btn--primary" onClick={submit} disabled={!picks.size || saving}>
            <FaCheck aria-hidden /> הוסף לרשימה ({picks.size})
          </button>
        </div>
      </div>
    </div>
  );
}
