'use client';

/*
 * /shopping — build a list, see where it's cheapest.
 *
 * Every price on the page is labelled with its source (`PriceSource` in
 * src/lib/shopping/api-types.ts): the official price-transparency file, a
 * Wolt listing (delivery prices, usually above shelf), or — later — a price
 * one of us typed in. <SourceBadge> is the one place that renders it.
 *
 * ── Manual prices ──
 *
 * Neighbourhood shops have no price file; we type their prices in.
 * `CompareResponse.manual` lists the city's manual stores (fewest missing
 * first; `missing` = items nobody priced there yet), and <ManualPrices> saves
 * one price at a time:
 *
 *   PUT /api/shopping/manual-prices  { store: k, item: key, price: agorot | null }
 *     price: whole agorot 1..100000, per kg for weighted items; null clears.
 *     200 { store, item, price, by, at } · 400 bad input · 404 unknown store
 *     or item · 409 the store isn't a manual one.
 *
 * A manual store with nothing missing is also ranked in `physical` (and can
 * be in a split), labelled "הוזן ידנית". Prices are shared by everyone with
 * the `shopping` permission. `manual` and `img` are optional in the types
 * until that backend is merged; without them the section and photos stay
 * hidden. Stores with no price file that *aren't* manual (a chain whose file
 * failed) are listed read-only under `unpriced`.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaMinus, FaPlus, FaTrash, FaSearch, FaChevronDown, FaTimes, FaCheck, FaPen, FaShoppingBasket } from 'react-icons/fa';
import Navbar from '@/components/Navbar';
import { CITIES } from '@/lib/shopping/cities';
import { SHOPPING_API_PATH } from '@/lib/shopping/config';
import { normalizeQty, type ShoppingList, type ShoppingListItem } from '@/lib/shopping/lists';
import type { CompareResponse, ItemBest, ManualPriceResponse, PriceSource, SearchHit, StoreInfo } from '@/lib/shopping/api-types';
import type { LineResult, Offer, StoreBasket } from '@/lib/shopping/pricing';

const money = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 });
const ils = (agorot: number) => money.format(agorot / 100);
/** "2026-11-28T23:59" → "28.11" */
const dayMonth = (local: string) => `${Number(local.slice(8, 10))}.${Number(local.slice(5, 7))}`;
const stamp = (local: string) => `${dayMonth(local)} ${local.slice(11, 16)}`;
const qtyLabel = (qty: number, w: boolean) => (w ? `${qty} ק״ג` : `×${qty}`);
/** Whole days between two Israel-local stamps (date part only). */
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86_400_000);

const OFFER_LABEL: Record<Offer['reason'], string> = {
  club: 'במועדון',
  coupon: 'בקופון',
  'min-purchase': 'בקנייה מעל סכום',
};

/** Label, explanation and how its date reads, per price source. */
const SOURCE: Record<PriceSource, { label: string; hint: string; dated: string }> = {
  official: { label: 'מחיר רשמי', hint: 'מקובץ שקיפות המחירים של הרשת, כלומר מחיר המדף בסניף', dated: 'קובץ מ־' },
  wolt: { label: 'וולט', hint: 'מחיר המשלוח בוולט, בדרך כלל גבוה ממחיר המדף', dated: 'נבדק ב־' },
  manual: { label: 'הוזן ידנית', hint: 'מחיר שהקלדנו בעצמנו', dated: 'עודכן ב־' },
};
/** A price file older than this many days is flagged. */
const OLD_DAYS = 2;

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

/**
 * The result views: per item (each item's cheapest store), per list (the best
 * single store for the whole list), per stores (how to split the list between
 * stores), and online stores.
 */
type Tab = 'item' | 'list' | 'stores' | 'online';
const step = (w: boolean) => (w ? 0.5 : 1);

export default function ShoppingPage() {
  const [lists, setLists] = useState<ShoppingList[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [city, setCity] = useState<string>(CITIES[0].id);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [clubs, setClubs] = useState(false);
  const [coupons, setCoupons] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [comparedSig, setComparedSig] = useState('');
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState(false);
  const [tab, setTab] = useState<Tab>('list');
  const [open, setOpen] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement>(null);

  const list = lists?.find((l) => l.id === activeId) ?? null;

  // Product photos seen so far (search hits and compare results), by item key.
  const [imgs, setImgs] = useState<Record<string, string>>({});
  const rememberImgs = useCallback((pairs: [string, string | null | undefined][]) => {
    setImgs((m) => {
      let next = m;
      for (const [k, v] of pairs) {
        if (v && next[k] !== v) {
          if (next === m) next = { ...m };
          next[k] = v;
        }
      }
      return next;
    });
  }, []);
  useEffect(() => {
    if (hits) rememberImgs(hits.map((h) => [h.key, h.img]));
  }, [hits, rememberImgs]);
  useEffect(() => {
    if (result) rememberImgs(Object.entries(result.items).map(([k, v]) => [k, v.img]));
  }, [result, rememberImgs]);

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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

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

  const qtyOf = useMemo(() => new Map(list?.items.map((i) => [i.key, i.qty]) ?? []), [list]);

  const addItem = (h: SearchHit) => {
    setItems((items) =>
      items.some((i) => i.key === h.key)
        ? items.map((i) => (i.key === h.key ? { ...i, qty: normalizeQty(i.qty + step(h.w), h.w) ?? i.qty } : i))
        : [...items, { key: h.key, name: h.name, qty: 1, w: h.w }],
    );
    setToast(`נוסף: ${h.name}`);
    // Keep the results so a second tap adds another; the next keystroke replaces the query.
    searchRef.current?.select();
  };
  const stepQty = (key: string, dir: 1 | -1) =>
    setItems((items) =>
      items.flatMap((i) => {
        if (i.key !== key) return [i];
        const q = normalizeQty(i.qty + dir * step(i.w), i.w);
        return q === null ? [] : [{ ...i, qty: q }];
      }),
    );
  const removeItem = (key: string) => setItems((items) => items.filter((i) => i.key !== key));
  const clearSearch = () => {
    setQuery('');
    setHits(null);
  };

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
  const pickList = (id: string) => {
    setActiveId(id);
    setResult(null);
  };
  const newList = async () => {
    const name = window.prompt('שם הרשימה', 'רשימה חדשה')?.trim();
    if (!name) return;
    try {
      const created = await api<ShoppingList>('/lists', { method: 'POST', body: JSON.stringify({ name }) });
      setLists((ls) => [created, ...(ls ?? [])]);
      pickList(created.id);
    } catch {
      setSaveError(true);
    }
  };
  const renameList = async () => {
    if (!list) return;
    const name = window.prompt('שם חדש לרשימה', list.name)?.trim();
    if (!name || name === list.name) return;
    try {
      await api(`/lists/${list.id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      setLists((ls) => ls!.map((l) => (l.id === list.id ? { ...l, name } : l)));
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
        pickList(rest[0].id);
      } else {
        const created = await api<ShoppingList>('/lists', { method: 'POST', body: JSON.stringify({ name: 'רשימת קניות' }) });
        setLists([created]);
        pickList(created.id);
      }
    } catch {
      setSaveError(true);
    }
  };

  // ── compare ──
  const sig = useMemo(
    () => JSON.stringify([city, clubs, coupons, list?.items.map((i) => [i.key, i.qty]) ?? []]),
    [city, clubs, coupons, list],
  );
  const compare = useCallback(async (scroll: boolean) => {
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
      if (scroll) {
        setOpen(null);
        setTab(res.physical.length ? 'list' : 'online');
        requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    } catch {
      setCompareError(true);
    } finally {
      setComparing(false);
    }
  }, [city, clubs, coupons, list, sig]);

  // Once there are results, keep them in step with the list (debounced).
  const stale = !!result && comparedSig !== sig;
  useEffect(() => {
    if (!stale || comparing || compareError) return;
    if (!list?.items.length) {
      setResult(null);
      return;
    }
    const t = setTimeout(() => compare(false), 700);
    return () => clearTimeout(t);
  }, [stale, comparing, compareError, compare, list]);

  const itemCount = list?.items.length ?? 0;

  return (
    <>
      <Navbar />
      <main className="sh-page">
        <header className="sh-header">
          <h1 className="sh-title">השוואת מחירים</h1>
          <p className="sh-subtitle">בונים רשימת קניות ורואים באיזו חנות היא הכי זולה. ליד כל מחיר כתוב מאיפה הוא ומאיזה יום.</p>
        </header>

        {loadError && <p className="sh-error">לא הצלחנו לטעון את הרשימות. נסו לרענן.</p>}
        {!lists && !loadError && <div className="sh-skeleton" aria-label="טוען" />}

        {lists && list && (
          <>
            <nav className="sh-scroller" aria-label="רשימות">
              {lists.map((l) => (
                <button key={l.id} type="button" className={`sh-chip ${l.id === list.id ? 'is-on' : ''}`}
                  aria-pressed={l.id === list.id} onClick={() => pickList(l.id)}>
                  {l.name} <small>{l.items.length}</small>
                </button>
              ))}
              <button type="button" className="sh-chip sh-chip--add" onClick={newList}><FaPlus aria-hidden /> רשימה חדשה</button>
            </nav>

            <div className="sh-seg" role="radiogroup" aria-label="עיר">
              {CITIES.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={city === c.id}
                  className={city === c.id ? 'is-on' : ''} onClick={() => setCity(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>

            <section className="sh-search">
              <label className="sh-search-box">
                <FaSearch aria-hidden />
                <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') clearSearch();
                    if (e.key === 'Enter' && hits?.length) addItem(hits[0]);
                  }}
                  placeholder="חיפוש מוצר או ברקוד" aria-label="חיפוש מוצר" enterKeyHint="search" autoComplete="off" />
                {searching && <span className="sh-spinner" aria-hidden />}
                {query && (
                  <button type="button" className="sh-icon-btn" onClick={clearSearch} aria-label="ניקוי החיפוש"><FaTimes /></button>
                )}
              </label>
              {hits && (
                <ul className="sh-hits">
                  {!searching && !hits.length && <li className="sh-muted sh-hits-empty">לא נמצאו מוצרים</li>}
                  {hits.map((h) => {
                    const inList = qtyOf.get(h.key);
                    return (
                      <li key={h.key}>
                        <button type="button" className={`sh-hit ${inList ? 'is-in' : ''}`} onClick={() => addItem(h)}>
                          <Thumb src={h.img} size={44} />
                          <span className="sh-hit-name">{h.name}{h.w && <small className="sh-weighed">לפי משקל</small>}</span>
                          <span className="sh-hit-meta">
                            {h.minPrice !== null ? (
                              <>
                                <b>{h.minPrice === h.maxPrice ? ils(h.minPrice) : `${ils(h.minPrice)}–${ils(h.maxPrice!)}`}</b>
                                <span>{h.stores} {h.stores === 1 ? 'סניף' : 'סניפים'}</span>
                                {h.sources.filter((s) => s !== 'official').map((s) => <SourceTag key={s} source={s} />)}
                              </>
                            ) : <span>לא נמכר בעיר</span>}
                            {h.manufacturer && h.manufacturer !== '---' && h.manufacturer !== 'לא ידוע' && <span>{h.manufacturer}</span>}
                          </span>
                          <span className="sh-hit-add" aria-hidden>
                            {inList ? <><FaCheck /> {qtyLabel(inList, h.w)}</> : <FaPlus />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="sh-card">
              <div className="sh-list-head">
                <h2 className="sh-h2">{list.name} <small>{itemCount} מוצרים</small></h2>
                <button type="button" className="sh-icon-btn" onClick={renameList} aria-label="שינוי שם הרשימה"><FaPen /></button>
                <button type="button" className="sh-icon-btn" onClick={deleteList} aria-label="מחיקת הרשימה"><FaTrash /></button>
              </div>
              {!itemCount && <p className="sh-empty">הרשימה ריקה. חפשו מוצר למעלה ולחצו עליו כדי להוסיף.</p>}
              <ul className="sh-items">
                {list.items.map((i) => {
                  const atMin = normalizeQty(i.qty - step(i.w), i.w) === null;
                  return (
                    <li key={i.key} className="sh-item">
                      <Thumb src={imgs[i.key]} size={40} />
                      <span className="sh-item-name">{i.name}</span>
                      <span className="sh-stepper">
                        <button type="button" onClick={() => stepQty(i.key, 1)} aria-label={`עוד ${i.name}`}><FaPlus /></button>
                        <span className="sh-qty" aria-live="polite">{i.w ? `${i.qty} ק״ג` : i.qty}</span>
                        <button type="button" onClick={() => (atMin ? removeItem(i.key) : stepQty(i.key, -1))}
                          aria-label={atMin ? `הסרת ${i.name}` : `פחות ${i.name}`} className={atMin ? 'is-remove' : ''}>
                          {atMin ? <FaTrash /> : <FaMinus />}
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {saveError && <p className="sh-error">השינויים לא נשמרו. הם יישמרו בשינוי הבא.</p>}
              {itemCount > 0 && (
                <div className="sh-options">
                  <label className="sh-toggle"><input type="checkbox" checked={clubs} onChange={(e) => setClubs(e.target.checked)} /> לחשב מבצעי מועדון</label>
                  <label className="sh-toggle"><input type="checkbox" checked={coupons} onChange={(e) => setCoupons(e.target.checked)} /> לחשב קופונים</label>
                </div>
              )}
            </section>

            {result && (
              <Results ref={resultsRef} result={result} list={list} updating={stale || comparing} tab={tab} setTab={setTab} open={open} setOpen={setOpen}
                onPricesSaved={() => compare(false)} />
            )}

            {itemCount > 0 && (!result || compareError) && (
              <div className="sh-cta-bar">
                {compareError && <p className="sh-error">ההשוואה נכשלה. נסו שוב.</p>}
                <button type="button" className="sh-btn sh-btn--primary" disabled={comparing} onClick={() => compare(true)}>
                  {comparing ? 'משווה…' : <>איפה הכי זול? <small>{itemCount} מוצרים</small></>}
                </button>
              </div>
            )}
          </>
        )}
        {toast && <div className="sh-toast" role="status">{toast}</div>}
      </main>
    </>
  );
}

// ── price source ──

function SourceTag({ source }: { source: PriceSource }) {
  return <span className={`sh-src sh-src--${source}`} title={SOURCE[source].hint}>{SOURCE[source].label}</span>;
}

/** The source of a store's prices and how fresh they are. */
function SourceBadge({ store, now }: { store: StoreInfo; now: string }) {
  const s = SOURCE[store.source];
  const old = store.pricesAt ? daysBetween(store.pricesAt, now) > OLD_DAYS : false;
  return (
    <span className="sh-src-line">
      <SourceTag source={store.source} />
      {store.pricesAt && (
        <span className={old ? 'sh-old' : ''} title={old ? 'המחירים לא עודכנו כמה ימים' : undefined}>
          {s.dated}{stamp(store.pricesAt)}{old && <b> ישן</b>}
        </span>
      )}
    </span>
  );
}

// ── results ──

const Results = React.forwardRef<HTMLElement, {
  result: CompareResponse;
  list: ShoppingList;
  updating: boolean;
  tab: Tab;
  setTab: (t: Tab) => void;
  open: string | null;
  setOpen: (k: string | null) => void;
  /** A manual price was saved: re-price the list. */
  onPricesSaved: () => void;
}>(function Results({ result, list, updating, tab, setTab, open, setOpen, onPricesSaved }, ref) {
  const complete = result.physical.filter((b) => !b.missing.length);
  const best = complete[0];
  const closest = result.physical[0];
  const worst = complete[complete.length - 1];
  const bestSplit = result.splits[0];
  const splitSaving = best && bestSplit && !bestSplit.missing.length ? best.total - bestSplit.total : 0;
  const sources = [...new Set(Object.values(result.stores).map((s) => s.source))];
  const toggle = (id: string) => setOpen(open === id ? null : id);
  const tabs: [Tab, string][] = [
    ['item', 'לפי מוצר'],
    ['list', 'לפי רשימה'],
    ['stores', 'לפי חנויות'],
    ['online', 'אונליין'],
  ];

  return (
    <section ref={ref} className={`sh-results ${updating ? 'is-updating' : ''}`} aria-live="polite" aria-busy={updating}>
      {best ? (
        <div className="sh-hero">
          <span className="sh-hero-kicker">הכי זול לקנות הכול</span>
          <span className="sh-hero-store">{storeName(result.stores[best.store])}</span>
          <span className="sh-hero-total">{ils(best.total)}</span>
          <span className="sh-hero-meta">
            {worst && worst !== best && <span>חוסכים {ils(worst.total - best.total)} מול היקרה ברשימה</span>}
            {splitSaving > 0 && (
              <button type="button" className="sh-link" onClick={() => setTab('stores')}>
                לחסוך עוד {ils(splitSaving)} בשתי חנויות
              </button>
            )}
          </span>
          {updating && <span className="sh-updating">מעדכן…</span>}
        </div>
      ) : (
        <div className="sh-hero is-partial">
          <span className="sh-hero-kicker">אין סניף שיש בו את כל {list.items.length} המוצרים</span>
          {closest && (
            <>
              <span className="sh-hero-store">הכי קרוב: {storeName(result.stores[closest.store])}</span>
              <span className="sh-hero-total">{ils(closest.total)} <small>חסרים {closest.missing.length}</small></span>
            </>
          )}
          <span className="sh-hero-meta">
            הסניפים מסודרים לפי כמה מוצרים חסרים, ואז לפי מחיר.
            <button type="button" className="sh-link" onClick={() => setTab('item')}>להשוות לפי מוצר</button>
          </span>
          {updating && <span className="sh-updating">מעדכן…</span>}
        </div>
      )}

      <div className="sh-seg sh-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'item' && <PerItem result={result} />}

      {tab === 'list' && (
        <>
          {result.physical.length
            ? result.physical.map((b, i) => (
              <StoreCard key={b.store} basket={b} result={result} rank={i} best={best}
                open={open === `s${b.store}`} toggle={() => toggle(`s${b.store}`)} />
            ))
            : <p className="sh-empty">אין בעיר חנויות עם מחירים.</p>}
          {!!result.manual?.length && <ManualStores baskets={result.manual} result={result} list={list} onSaved={onPricesSaved} />}
          <Unpriced result={result} />
        </>
      )}

      {tab === 'stores' && <CheapestEach result={result} single={best} />}
      {tab === 'stores' && (
        result.splits.length
          ? result.splits.map((s, i) => {
            const id = `p${i}`;
            const saving = best ? best.total - s.total : 0;
            return (
              <article key={id} className={`sh-card sh-store ${i === 0 ? 'is-best' : ''}`}>
                {i === 0 && <h3 className="sh-section-title">חלוקה לשתי חנויות</h3>}
                <button type="button" className="sh-store-head" onClick={() => toggle(id)} aria-expanded={open === id}>
                  <span className="sh-store-title">
                    {s.stores.map((b) => storeName(result.stores[b.store])).join(' + ')}
                  </span>
                  <span className="sh-store-total">{ils(s.total)}</span>
                  <FaChevronDown className={`sh-caret ${open === id ? 'is-open' : ''}`} aria-hidden />
                  <span className="sh-store-meta">
                    {saving > 0 && <span className="sh-save">{ils(saving)} פחות מחנות אחת</span>}
                    {s.missing.length > 0 && <span className="sh-missing">חסרים {s.missing.length}</span>}
                    <span>{s.stores.map((b) => `${b.lines.filter((l) => l.available).length} ב${result.stores[b.store]?.chainName ?? '?'}`).join(', ')}</span>
                  </span>
                </button>
                {open === id && s.stores.map((b) => (
                  <div key={b.store} className="sh-split-part">
                    <h3 className="sh-h3">
                      <span>{storeName(result.stores[b.store])}</span> <span>{ils(b.total)}</span>
                    </h3>
                    {result.stores[b.store] && <SourceBadge store={result.stores[b.store]} now={result.now} />}
                    <Breakdown basket={b} result={result} onlyAvailable />
                  </div>
                ))}
              </article>
            );
          })
          : <p className="sh-empty">פיצול לשתי חנויות לא יוצא זול יותר מחנות אחת הפעם.</p>
      )}

      {tab === 'online' && (
        result.online.length
          ? result.online.map((b, i) => (
            <StoreCard key={b.store} basket={b} result={result} rank={i} best={result.online.find((x) => !x.missing.length)}
              open={open === `o${b.store}`} toggle={() => toggle(`o${b.store}`)} />
          ))
          : <p className="sh-empty">אין חנויות אונליין עם מחירים.</p>
      )}

      <dl className="sh-legend">
        {sources.map((s) => (
          <div key={s}><dt><SourceTag source={s} /></dt><dd>{SOURCE[s].hint}.</dd></div>
        ))}
      </dl>
      <p className="sh-footnote">
        מבצעי מועדון וקופונים מוצגים בסגול ולא נכללים בסכום, אלא אם סימנתם אותם למעלה.
      </p>
    </section>
  );
});

const storeName = (s: StoreInfo | undefined) => (s ? `${s.chainName} ${s.name}` : '?');

function StoreCard({ basket, result, rank, best, open, toggle }: {
  basket: StoreBasket;
  result: CompareResponse;
  rank: number;
  best: StoreBasket | undefined;
  open: boolean;
  toggle: () => void;
}) {
  const store = result.stores[basket.store];
  const saved = basket.regularTotal - basket.total;
  const isBest = basket === best;
  const more = best && !isBest && !basket.missing.length ? basket.total - best.total : 0;
  const missingNames = basket.missing.map((k) => result.items[k]?.name ?? k);
  return (
    <article className={`sh-card sh-store ${isBest ? 'is-best' : ''}`}>
      <button type="button" className="sh-store-head" onClick={toggle} aria-expanded={open}>
        <span className="sh-store-title">
          <span className="sh-rank">{rank + 1}</span>
          {store.chainName} <span className="sh-branch">{store.name}</span>
        </span>
        <span className="sh-store-total">
          {ils(basket.total)}
          {more > 0 && <small className="sh-more">+{ils(more)}</small>}
        </span>
        <FaChevronDown className={`sh-caret ${open ? 'is-open' : ''}`} aria-hidden />
        <span className="sh-store-meta">
          <SourceBadge store={store} now={result.now} />
          {store.address && <span>{store.address}</span>}
          {saved > 0 && <span className="sh-save">מבצעים חוסכים {ils(saved)}</span>}
          {basket.missing.length > 0 && (
            <span className="sh-missing" title={missingNames.join(', ')}>
              חסרים {basket.missing.length}: {missingNames.slice(0, 2).join(', ')}{missingNames.length > 2 ? '…' : ''}
            </span>
          )}
        </span>
      </button>
      {open && <Breakdown basket={basket} result={result} />}
    </article>
  );
}

function Breakdown({ basket, result, onlyAvailable }: { basket: StoreBasket; result: CompareResponse; onlyAvailable?: boolean }) {
  // Missing items last: what you can buy here first.
  const lines = [...basket.lines].filter((l) => !onlyAvailable || l.available).sort((a, b) => Number(b.available) - Number(a.available));
  return (
    <ul className="sh-lines">
      {lines.map((l) => <Line key={l.key} line={l} result={result} />)}
    </ul>
  );
}

function Line({ line, result }: { line: LineResult; result: CompareResponse }) {
  const it = result.items[line.key];
  const w = it?.w ?? false;
  if (!line.available) {
    return (
      <li className="sh-line is-missing">
        <span className="sh-line-name"><Thumb src={it?.img} size={36} /><span>{it?.name ?? line.key}</span></span>
        <span className="sh-line-price">לא נמכר כאן</span>
      </li>
    );
  }
  const discounted = line.cost < line.regularCost;
  return (
    <li className="sh-line">
      <span className="sh-line-name"><Thumb src={it?.img} size={36} /><span>{it?.name ?? line.key} <small>{qtyLabel(line.qty, w)}</small></span></span>
      <span className="sh-line-price">
        {discounted && <s>{ils(line.regularCost)}</s>} <b>{ils(line.cost)}</b>
        {(line.qty !== 1 || discounted) && <small>{ils(line.effectiveUnit)} ל{w ? 'ק״ג' : 'יח׳'}</small>}
      </span>
      {(line.applied.length > 0 || line.offers.length > 0) && (
        <span className="sh-promos">
          {line.applied.map((p) => (
            <span key={p.id} className="sh-promo">
              <b>−{ils(p.savings)}</b> {p.description} <small>עד {dayMonth(p.end)}</small>
            </span>
          ))}
          {line.offers.map((o) => (
            <span key={o.id} className="sh-promo is-offer">
              {OFFER_LABEL[o.reason]}{o.clubName ? ` (${o.clubName})` : ''}: {o.description} <small>עד {dayMonth(o.end)}</small>
            </span>
          ))}
        </span>
      )}
    </li>
  );
}

// ── per item / per stores ──

/** One item's cheapest stores. */
function PerItem({ result }: { result: CompareResponse }) {
  const sold = result.perItem.filter((x) => x.options.length);
  const total = sold.reduce((sum, x) => sum + x.options[0].cost, 0);
  const storeCount = new Set(sold.map((x) => x.options[0].store)).size;
  return (
    <>
      <p className="sh-view-note">
        המחיר הכי זול לכל מוצר בנפרד. יחד: <b>{ils(total)}</b> ב־{storeCount} {storeCount === 1 ? 'חנות' : 'חנויות'}
        {sold.length < result.perItem.length && <>, ו־{result.perItem.length - sold.length} לא נמכרים בעיר</>}.
      </p>
      <ul className="sh-card sh-peritem">
        {result.perItem.map((x) => <PerItemRow key={x.key} row={x} result={result} />)}
      </ul>
    </>
  );
}

function PerItemRow({ row, result }: { row: ItemBest; result: CompareResponse }) {
  const it = result.items[row.key];
  const w = it?.w ?? false;
  const [first, ...rest] = row.options;
  return (
    <li className="sh-peritem-row">
      <span className="sh-line-name"><Thumb src={it?.img} size={44} /><span>{it?.name ?? row.key} <small>{qtyLabel(row.qty, w)}</small></span></span>
      {first ? (
        <>
          <span className="sh-line-price">
            <b>{ils(first.cost)}</b>
            {first.cost < first.regularCost && <s>{ils(first.regularCost)}</s>}
          </span>
          <span className="sh-peritem-where">
            <span className="sh-peritem-best">{storeName(result.stores[first.store])}</span>
            {result.stores[first.store] && <SourceTag source={result.stores[first.store].source} />}
            <small>{row.stores} {row.stores === 1 ? 'סניף מוכר' : 'סניפים מוכרים'}</small>
          </span>
          {rest.length > 0 && (
            <span className="sh-peritem-alt">
              {rest.map((o) => (
                <span key={o.store}>{result.stores[o.store]?.chainName ?? '?'} {result.stores[o.store]?.name} <b>{ils(o.cost)}</b></span>
              ))}
            </span>
          )}
        </>
      ) : <span className="sh-line-price sh-missing">לא נמכר בעיר</span>}
    </li>
  );
}

/**
 * Every item at its cheapest store, grouped by store: the shopping route if
 * you're willing to go anywhere. The prices are each store's price in the
 * whole-basket context, so a mix & match deal may not survive buying only
 * part of the list there; the two-store splits below are re-priced exactly.
 */
function CheapestEach({ result, single }: { result: CompareResponse; single: StoreBasket | undefined }) {
  const groups = new Map<number, { key: string; cost: number }[]>();
  for (const x of result.perItem) {
    const o = x.options[0];
    if (o) groups.set(o.store, [...(groups.get(o.store) ?? []), { key: x.key, cost: o.cost }]);
  }
  // Two stores is what the exact splits below already show.
  if (groups.size < 2 || (groups.size === 2 && result.splits.length)) return null;
  const sorted = [...groups].sort((a, b) => b[1].length - a[1].length);
  const total = sorted.reduce((sum, [, xs]) => sum + xs.reduce((s, x) => s + x.cost, 0), 0);
  const missing = result.perItem.filter((x) => !x.options.length).length;
  return (
    <article className="sh-card sh-group">
      <h3 className="sh-section-title">כל מוצר במקום הכי זול</h3>
      <p className="sh-group-sum">
        <b>{ils(total)}</b> ב־{groups.size} חנויות
        {single && !missing && single.total > total && <span className="sh-save">, {ils(single.total - total)} פחות מחנות אחת</span>}
        {missing > 0 && <span className="sh-missing">, חסרים {missing}</span>}
      </p>
      {sorted.map(([store, xs]) => (
        <div key={store} className="sh-group-store">
          <h4>
            <span>{storeName(result.stores[store])}</span>
            <span>{ils(xs.reduce((s, x) => s + x.cost, 0))}</span>
          </h4>
          <p>{xs.map((x) => result.items[x.key]?.name ?? x.key).join(', ')}</p>
        </div>
      ))}
      <p className="sh-footnote">משוער: מבצע ״קנה כמה״ עשוי לא לחול כשקונים רק חלק מהרשימה בחנות.</p>
    </article>
  );
}

// ── product photos ──

/** Wolt's image proxy resizes on `?w=`; the menu-image CDN has no resize, so it's shown small. */
const sized = (src: string, px: number) =>
  src.startsWith('https://imageproxy.wolt.com/') ? `${src}${src.includes('?') ? '&' : '?'}w=${px * 2}` : src;

/** A product photo, or a quiet basket mark when there's none (most items) or it fails to load. */
function Thumb({ src, size }: { src: string | null | undefined; size: number }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (!src || failed) {
    return <span className="sh-thumb is-empty" style={box} aria-hidden><FaShoppingBasket /></span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- plain <img>: external photos, no optimizer
    <img className="sh-thumb" src={sized(src, size)} width={size} height={size} style={box}
      alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
  );
}

// ── stores priced by hand ──

function ManualStores({ baskets, result, list, onSaved }: {
  baskets: StoreBasket[];
  result: CompareResponse;
  list: ShoppingList;
  onSaved: () => void;
}) {
  return (
    <section className="sh-card sh-unpriced">
      <div className="sh-unpriced-head is-static">
        <span>
          <b>חנויות שכונתיות</b>
          <small>אין להן קובץ מחירים, אז אנחנו מקלידים את המחירים. כל מה שמוקלד כאן משותף לכולנו.</small>
        </span>
      </div>
      <ul className="sh-unpriced-list">
        {baskets.map((b) => (
          <ManualStore key={b.store} basket={b} store={result.stores[b.store]} list={list} onSaved={onSaved} />
        ))}
      </ul>
    </section>
  );
}

function ManualStore({ basket, store, list, onSaved }: {
  basket: StoreBasket;
  store: StoreInfo | undefined;
  list: ShoppingList;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const priced = basket.lines.filter((l) => l.available).length;
  return (
    <li>
      <div className="sh-unpriced-row">
        <span>
          {store ? <>{store.name} {store.address && <small>{store.address}</small>}</> : basket.store}
          <small>
            {priced
              ? `${priced} מתוך ${basket.lines.length} מוצרים מתומחרים, ${ils(basket.total)}`
              : 'עוד לא הוקלדו מחירים לרשימה הזאת'}
          </small>
        </span>
        <button type="button" className="sh-btn sh-btn--ghost" onClick={() => setEditing(!editing)} aria-expanded={editing}>
          {editing ? 'סיום' : 'הקלדת מחירים'}
        </button>
      </div>
      {editing && <ManualPrices store={basket.store} basket={basket} list={list} onSaved={onSaved} />}
    </li>
  );
}

type SaveState = 'saving' | 'saved' | 'error' | 'invalid';
const SAVE_LABEL: Record<SaveState, string> = { saving: 'שומר…', saved: 'נשמר', error: 'לא נשמר, נסו שוב', invalid: 'מחיר לא תקין' };

/** Parse "12.90" / "12,9" / "₪ 7" to whole agorot; '' → null (clear); undefined when it isn't a price. */
function parseAgorot(raw: string): number | null | undefined {
  const t = raw.replace(/[₪\s]/g, '').replace(',', '.');
  if (!t) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return undefined;
  const a = Math.round(Number(t) * 100);
  return a >= 1 && a <= 100_000 ? a : undefined;
}

/** One price field per list item; each saves on blur or Enter. */
function ManualPrices({ store, basket, list, onSaved }: {
  store: number;
  basket: StoreBasket;
  list: ShoppingList;
  onSaved: () => void;
}) {
  const current = new Map(basket.lines.filter((l) => l.available).map((l) => [l.key, l.regularUnit]));
  const [state, setState] = useState<Record<string, SaveState>>({});
  const mark = (key: string, st: SaveState) => setState((m) => ({ ...m, [key]: st }));

  const save = async (key: string, raw: string) => {
    const price = parseAgorot(raw);
    if (price === undefined) return mark(key, 'invalid');
    if (price === (current.get(key) ?? null)) return;
    mark(key, 'saving');
    try {
      await api<ManualPriceResponse>('/manual-prices', { method: 'PUT', body: JSON.stringify({ store, item: key, price }) });
      mark(key, 'saved');
      onSaved();
    } catch {
      mark(key, 'error');
    }
  };

  return (
    <div className="sh-manual">
      <p className="sh-manual-note">
        <SourceTag source="manual" /> כל מחיר נשמר כשיוצאים מהשדה. מוצר במשקל: מחיר לק״ג. שדה ריק מוחק את המחיר.
      </p>
      {list.items.map((i) => {
        const cur = current.get(i.key);
        const st = state[i.key];
        return (
          <label key={i.key} className="sh-manual-row">
            <span>
              {i.name}{i.w && <small className="sh-weighed">לק״ג</small>}
              {st && <small className={`sh-save-state is-${st}`}>{SAVE_LABEL[st]}</small>}
            </span>
            <span className="sh-money-input">
              <input key={`${i.key}:${cur ?? ''}`} type="text" inputMode="decimal" placeholder="0.00"
                defaultValue={cur !== undefined ? (cur / 100).toFixed(2) : ''} aria-label={`מחיר ${i.name}`}
                onBlur={(e) => save(i.key, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
              <span aria-hidden>₪</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

// ── stores with no price file ──

/** Chain stores whose price file is missing right now (not manual shops): listed so they aren't silently dropped. */
function Unpriced({ result }: { result: CompareResponse }) {
  const [expanded, setExpanded] = useState(false);
  const manual = new Set((result.manual ?? []).map((b) => b.store));
  const stores = result.unpriced.filter((s) => s.source !== 'manual' && !manual.has(s.k));
  if (!stores.length) return null;
  return (
    <section className="sh-card sh-unpriced">
      <button type="button" className="sh-unpriced-head" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span>
          <b>{stores.length} סניפים בעיר בלי קובץ מחירים כרגע</b>
          <small>הרשת לא פרסמה להם מחירים, אז הם לא בהשוואה</small>
        </span>
        <FaChevronDown className={`sh-caret ${expanded ? 'is-open' : ''}`} aria-hidden />
      </button>
      {expanded && (
        <ul className="sh-unpriced-list">
          {stores.map((s) => (
            <li key={s.k}>
              <div className="sh-unpriced-row">
                <span>
                  {s.chainName} <span className="sh-branch">{s.name}</span>
                  {s.address && <small>{s.address}</small>}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
