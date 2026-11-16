'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaMinus, FaPlus, FaTrash, FaSearch, FaChevronDown } from 'react-icons/fa';
import Navbar from '@/components/Navbar';
import { CITIES } from '@/lib/shopping/cities';
import { SHOPPING_API_PATH } from '@/lib/shopping/config';
import { normalizeQty, type ShoppingList, type ShoppingListItem } from '@/lib/shopping/lists';
import type { CompareResponse, SearchHit, StoreInfo } from '@/lib/shopping/api-types';
import type { LineResult, Offer, StoreBasket } from '@/lib/shopping/pricing';

const money = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 });
const ils = (agorot: number) => money.format(agorot / 100);
/** "2026-11-28T23:59" → "28.11" */
const dayMonth = (local: string) => `${Number(local.slice(8, 10))}.${Number(local.slice(5, 7))}`;
const stamp = (local: string) => `${dayMonth(local)} ${local.slice(11, 16)}`;
const qtyLabel = (qty: number, w: boolean) => (w ? `${qty} ק״ג` : `×${qty}`);

const OFFER_LABEL: Record<Offer['reason'], string> = {
  club: 'במועדון',
  coupon: 'בקופון',
  'min-purchase': 'בקנייה מעל סכום',
};

const LS_LIST = 'shopping:list';
const LS_CITY = 'shopping:city';
const lsGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(SHOPPING_API_PATH + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

type Tab = 'store' | 'split' | 'online';

export default function ShoppingPage() {
  const [lists, setLists] = useState<ShoppingList[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [city, setCity] = useState<string>(CITIES[0].id);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [clubs, setClubs] = useState(false);
  const [coupons, setCoupons] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [comparedSig, setComparedSig] = useState('');
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState(false);
  const [tab, setTab] = useState<Tab>('store');
  const [open, setOpen] = useState<string | null>(null);

  const list = lists?.find((l) => l.id === activeId) ?? null;

  // ── load lists (creating the first one) ──
  useEffect(() => {
    const savedCity = lsGet(LS_CITY);
    if (savedCity && CITIES.some((c) => c.id === savedCity)) setCity(savedCity);
    (async () => {
      try {
        let all = await api<ShoppingList[]>('/lists');
        if (!all.length) all = [await api<ShoppingList>('/lists', { method: 'POST', body: JSON.stringify({ name: 'רשימת קניות' }) })];
        setLists(all);
        const saved = lsGet(LS_LIST);
        setActiveId(all.some((l) => l.id === saved) ? saved : all[0].id);
      } catch {
        setLoadError(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (activeId) lsSet(LS_LIST, activeId);
  }, [activeId]);
  useEffect(() => lsSet(LS_CITY, city), [city]);

  // ── save items, debounced ──
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setItems = useCallback(
    (fn: (items: ShoppingListItem[]) => ShoppingListItem[]) => {
      if (!list) return;
      const items = fn(list.items);
      setLists((ls) => ls!.map((l) => (l.id === list.id ? { ...l, items } : l)));
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const id = list.id;
      saveTimer.current = setTimeout(async () => {
        try {
          await api(`/lists/${id}`, { method: 'PATCH', body: JSON.stringify({ items }) });
          setSaveError(false);
        } catch {
          setSaveError(true);
        }
      }, 600);
    },
    [list],
  );

  const addItem = (h: SearchHit) => {
    setItems((items) =>
      items.some((i) => i.key === h.key)
        ? items.map((i) => (i.key === h.key ? { ...i, qty: normalizeQty(i.qty + (h.w ? 0.5 : 1), h.w) ?? i.qty } : i))
        : [...items, { key: h.key, name: h.name, qty: 1, w: h.w }],
    );
    setQuery('');
    setHits(null);
  };
  const stepQty = (key: string, dir: 1 | -1) =>
    setItems((items) =>
      items.flatMap((i) => {
        if (i.key !== key) return [i];
        const q = normalizeQty(i.qty + dir * (i.w ? 0.5 : 1), i.w);
        return q === null ? [] : [{ ...i, qty: q }];
      }),
    );
  const removeItem = (key: string) => setItems((items) => items.filter((i) => i.key !== key));

  // ── search, debounced ──
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits(null);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${SHOPPING_API_PATH}/search?q=${encodeURIComponent(q)}&city=${city}`, { signal: ctl.signal });
        if (res.ok) setHits(await res.json());
      } catch {
        /* aborted or offline */
      } finally {
        if (!ctl.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [query, city]);

  // ── lists ──
  const newList = async () => {
    const name = window.prompt('שם הרשימה', 'רשימה חדשה')?.trim();
    if (!name) return;
    try {
      const created = await api<ShoppingList>('/lists', { method: 'POST', body: JSON.stringify({ name }) });
      setLists((ls) => [created, ...(ls ?? [])]);
      setActiveId(created.id);
      setResult(null);
    } catch {
      setSaveError(true);
    }
  };
  const deleteList = async () => {
    if (!list || !window.confirm(`למחוק את "${list.name}"?`)) return;
    try {
      await api(`/lists/${list.id}`, { method: 'DELETE' });
      const rest = lists!.filter((l) => l.id !== list.id);
      if (rest.length) {
        setLists(rest);
        setActiveId(rest[0].id);
      } else {
        const created = await api<ShoppingList>('/lists', { method: 'POST', body: JSON.stringify({ name: 'רשימת קניות' }) });
        setLists([created]);
        setActiveId(created.id);
      }
      setResult(null);
    } catch {
      setSaveError(true);
    }
  };

  // ── compare ──
  const sig = useMemo(
    () => JSON.stringify([city, clubs, coupons, list?.items.map((i) => [i.key, i.qty]) ?? []]),
    [city, clubs, coupons, list],
  );
  const compare = async () => {
    if (!list?.items.length) return;
    setComparing(true);
    setCompareError(false);
    try {
      const res = await api<CompareResponse>('/compare', {
        method: 'POST',
        body: JSON.stringify({ city, clubs, coupons, lines: list.items.map(({ key, qty }) => ({ key, qty })) }),
      });
      setResult(res);
      setComparedSig(sig);
      setOpen(null);
      setTab(res.physical.length ? 'store' : 'online');
    } catch {
      setCompareError(true);
    } finally {
      setComparing(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="sh-page">
        <header className="sh-header">
          <h1 className="sh-title">🛒 השוואת מחירים</h1>
          <p className="sh-subtitle">בונים רשימה, ורואים איפה היא הכי זולה — לפי קבצי המחירים הרשמיים של הרשתות.</p>
        </header>

        {loadError && <p className="sh-error">לא הצלחנו לטעון את הרשימות. נסו לרענן.</p>}
        {!lists && !loadError && <p className="sh-muted">טוען…</p>}

        {lists && list && (
          <>
            <section className="sh-card sh-controls">
              <div className="sh-row">
                <select className="sh-select" value={list.id} onChange={(e) => { setActiveId(e.target.value); setResult(null); }} aria-label="רשימה">
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.items.length})</option>
                  ))}
                </select>
                <button type="button" className="sh-btn sh-btn--ghost" onClick={newList}>רשימה חדשה</button>
                <button type="button" className="sh-icon-btn" onClick={deleteList} aria-label="מחיקת הרשימה"><FaTrash /></button>
              </div>
              <div className="sh-chips" role="radiogroup" aria-label="עיר">
                {CITIES.map((c) => (
                  <button key={c.id} type="button" role="radio" aria-checked={city === c.id}
                    className={`sh-chip ${city === c.id ? 'is-on' : ''}`} onClick={() => setCity(c.id)}>
                    {c.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="sh-search">
              <label className="sh-search-box">
                <FaSearch aria-hidden />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="חיפוש מוצר או ברקוד" aria-label="חיפוש מוצר" enterKeyHint="search" />
              </label>
              {hits && (
                <ul className="sh-hits">
                  {searching && !hits.length && <li className="sh-muted">מחפש…</li>}
                  {!searching && !hits.length && <li className="sh-muted">לא נמצאו מוצרים</li>}
                  {hits.map((h) => (
                    <li key={h.key}>
                      <button type="button" className="sh-hit" onClick={() => addItem(h)}>
                        <span className="sh-hit-name">{h.name}{h.w && <small> · לפי משקל</small>}</span>
                        <span className="sh-hit-meta">
                          {h.manufacturer && <span>{h.manufacturer}</span>}
                          {h.minPrice !== null ? (
                            <span>{h.minPrice === h.maxPrice ? ils(h.minPrice!) : `${ils(h.minPrice)}–${ils(h.maxPrice!)}`} · {h.stores} סניפים</span>
                          ) : <span>לא נמכר בעיר</span>}
                        </span>
                        <FaPlus className="sh-hit-add" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="sh-card">
              <h2 className="sh-h2">{list.name}</h2>
              {!list.items.length && <p className="sh-muted">הרשימה ריקה — חפשו מוצר כדי להוסיף.</p>}
              <ul className="sh-items">
                {list.items.map((i) => (
                  <li key={i.key} className="sh-item">
                    <span className="sh-item-name">{i.name}</span>
                    <span className="sh-stepper">
                      <button type="button" onClick={() => stepQty(i.key, 1)} aria-label="עוד אחד"><FaPlus /></button>
                      <span className="sh-qty">{i.w ? `${i.qty} ק״ג` : i.qty}</span>
                      <button type="button" onClick={() => stepQty(i.key, -1)} aria-label="אחד פחות"><FaMinus /></button>
                    </span>
                    <button type="button" className="sh-icon-btn" onClick={() => removeItem(i.key)} aria-label={`הסרת ${i.name}`}><FaTrash /></button>
                  </li>
                ))}
              </ul>
              {saveError && <p className="sh-error">השמירה נכשלה — השינויים יישמרו בשינוי הבא.</p>}
              <div className="sh-options">
                <label><input type="checkbox" checked={clubs} onChange={(e) => setClubs(e.target.checked)} /> כולל מבצעי מועדון</label>
                <label><input type="checkbox" checked={coupons} onChange={(e) => setCoupons(e.target.checked)} /> כולל קופונים</label>
              </div>
              <button type="button" className="sh-btn sh-btn--primary" disabled={!list.items.length || comparing} onClick={compare}>
                {comparing ? 'משווה…' : 'איפה הכי זול?'}
              </button>
              {compareError && <p className="sh-error">ההשוואה נכשלה. נסו שוב.</p>}
            </section>

            {result && (
              <Results result={result} stale={comparedSig !== sig} tab={tab} setTab={setTab} open={open} setOpen={setOpen} />
            )}
          </>
        )}
      </main>
    </>
  );
}

function Results({ result, stale, tab, setTab, open, setOpen }: {
  result: CompareResponse;
  stale: boolean;
  tab: Tab;
  setTab: (t: Tab) => void;
  open: string | null;
  setOpen: (k: string | null) => void;
}) {
  const best = result.physical[0];
  const tabs: [Tab, string, number][] = [
    ['store', 'חנות אחת', result.physical.length],
    ['split', 'שתי חנויות', result.splits.length],
    ['online', 'אונליין', result.online.length],
  ];
  return (
    <section className="sh-results" aria-live="polite">
      {stale && <p className="sh-stale">הרשימה השתנתה מאז ההשוואה — לחצו שוב לעדכון.</p>}
      <div className="sh-tabs" role="tablist">
        {tabs.map(([id, label, n]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            className={`sh-tab ${tab === id ? 'is-on' : ''}`} onClick={() => setTab(id)}>
            {label} <small>({n})</small>
          </button>
        ))}
      </div>

      {tab === 'store' && (
        result.physical.length
          ? result.physical.map((b, i) => (
            <StoreCard key={b.store} basket={b} store={result.stores[b.store]} result={result} rank={i}
              open={open === `s${b.store}`} toggle={() => setOpen(open === `s${b.store}` ? null : `s${b.store}`)} />
          ))
          : <p className="sh-muted">אין בעיר חנויות עם מחירים.</p>
      )}

      {tab === 'split' && (
        result.splits.length
          ? result.splits.map((s, i) => {
            const id = `p${i}`;
            const saving = best && !best.missing.length ? best.total - s.total : 0;
            return (
              <article key={id} className="sh-card sh-store">
                <button type="button" className="sh-store-head" onClick={() => setOpen(open === id ? null : id)} aria-expanded={open === id}>
                  <span className="sh-store-title">
                    {s.stores.map((b) => storeName(result.stores[b.store])).join(' + ')}
                  </span>
                  <span className="sh-store-total">{ils(s.total)}</span>
                  <span className="sh-store-meta">
                    {saving > 0 && <span className="sh-save">חוסך {ils(saving)} מול החנות הזולה</span>}
                    {s.missing.length > 0 && <span className="sh-missing">חסרים {s.missing.length}</span>}
                  </span>
                  <FaChevronDown className={`sh-caret ${open === id ? 'is-open' : ''}`} aria-hidden />
                </button>
                {open === id && s.stores.map((b) => (
                  <div key={b.store} className="sh-split-part">
                    <h3 className="sh-h3">{storeName(result.stores[b.store])} · {ils(b.total)}</h3>
                    <Breakdown basket={b} result={result} />
                  </div>
                ))}
              </article>
            );
          })
          : <p className="sh-muted">פיצול לשתי חנויות לא זול יותר כאן.</p>
      )}

      {tab === 'online' && (
        result.online.length
          ? result.online.map((b, i) => (
            <StoreCard key={b.store} basket={b} store={result.stores[b.store]} result={result} rank={i}
              open={open === `o${b.store}`} toggle={() => setOpen(open === `o${b.store}` ? null : `o${b.store}`)} />
          ))
          : <p className="sh-muted">אין חנויות אונליין עם מחירים.</p>
      )}
      <p className="sh-footnote">
        מחירים ומבצעים מקבצי שקיפות המחירים של הרשתות. מבצעי מועדון וקופונים מוצגים אך לא מחושבים, אלא אם סימנתם אותם.
      </p>
    </section>
  );
}

const storeName = (s: StoreInfo | undefined) => (s ? `${s.chainName} ${s.name}` : '?');

function StoreCard({ basket, store, result, rank, open, toggle }: {
  basket: StoreBasket;
  store: StoreInfo;
  result: CompareResponse;
  rank: number;
  open: boolean;
  toggle: () => void;
}) {
  const saved = basket.regularTotal - basket.total;
  return (
    <article className={`sh-card sh-store ${rank === 0 && !basket.missing.length ? 'is-best' : ''}`}>
      <button type="button" className="sh-store-head" onClick={toggle} aria-expanded={open}>
        <span className="sh-store-title">
          {rank === 0 && !basket.missing.length && <span className="sh-badge">הכי זול</span>}
          {store.chainName} · {store.name}
        </span>
        <span className="sh-store-total">{ils(basket.total)}</span>
        <span className="sh-store-meta">
          {store.address && <span>{store.address}</span>}
          {saved > 0 && <span className="sh-save">מבצעים חוסכים {ils(saved)}</span>}
          {basket.missing.length > 0 && <span className="sh-missing">חסרים {basket.missing.length}</span>}
          {store.pricesAt && <span>מחירים מ-{stamp(store.pricesAt)}</span>}
        </span>
        <FaChevronDown className={`sh-caret ${open ? 'is-open' : ''}`} aria-hidden />
      </button>
      {open && <Breakdown basket={basket} result={result} />}
    </article>
  );
}

function Breakdown({ basket, result }: { basket: StoreBasket; result: CompareResponse }) {
  return (
    <ul className="sh-lines">
      {basket.lines.map((l) => <Line key={l.key} line={l} result={result} />)}
    </ul>
  );
}

function Line({ line, result }: { line: LineResult; result: CompareResponse }) {
  const it = result.items[line.key];
  const w = it?.w ?? false;
  if (!line.available) {
    return (
      <li className="sh-line is-missing">
        <span className="sh-line-name">{it?.name ?? line.key}</span>
        <span className="sh-line-price">לא נמכר כאן</span>
      </li>
    );
  }
  const discounted = line.cost < line.regularCost;
  return (
    <li className="sh-line">
      <span className="sh-line-name">{it?.name ?? line.key} <small>{qtyLabel(line.qty, w)}</small></span>
      <span className="sh-line-price">
        {discounted && <s>{ils(line.regularCost)}</s>} <b>{ils(line.cost)}</b>
        {(line.qty !== 1 || discounted) && <small> ({ils(line.effectiveUnit)} ל{w ? 'ק״ג' : 'יח׳'})</small>}
      </span>
      {(line.applied.length > 0 || line.offers.length > 0) && (
        <span className="sh-promos">
          {line.applied.map((p) => (
            <span key={p.id} className="sh-promo">{p.description} · עד {dayMonth(p.end)}</span>
          ))}
          {line.offers.map((o) => (
            <span key={o.id} className="sh-promo is-offer">
              {OFFER_LABEL[o.reason]}{o.clubName ? ` (${o.clubName})` : ''}: {o.description} · עד {dayMonth(o.end)}
            </span>
          ))}
        </span>
      )}
    </li>
  );
}
