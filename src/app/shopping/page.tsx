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
 * the `shopping` permission.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaMinus, FaPlus, FaTrash, FaSearch, FaChevronDown, FaTimes, FaCheck, FaPen, FaShoppingBasket, FaBarcode, FaMapMarkerAlt, FaLocationArrow } from 'react-icons/fa';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import { CITIES } from '@/lib/shopping/cities';
import { distanceM } from '@/lib/shopping/places';
import { SHOPPING_API_PATH } from '@/lib/shopping/config';
import { normalizeQty, type ShoppingList, type ShoppingListItem } from '@/lib/shopping/lists';
import type { CompareResponse, ItemBest, ItemPrice, ItemResponse, ManualPriceResponse, PriceSource, SearchHit, StoreInfo } from '@/lib/shopping/api-types';
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
  official: { label: 'מחיר רשמי', hint: 'מקובץ שקיפות המחירים של הרשת, כלומר מחיר המדף בסניף', dated: 'עדכון מ־' },
  wolt: { label: 'וולט', hint: 'מחיר המשלוח בוולט, בדרך כלל גבוה ממחיר המדף', dated: 'נבדק ב־' },
  manual: { label: 'הוזן ידנית', hint: 'מחיר שהקלדנו בעצמנו', dated: 'עודכן ב־' },
};
/** A price file older than this many days is flagged. */
const OLD_DAYS = 2;

const LS_LIST = 'shopping:list';
const LS_CITY = 'shopping:city';
/** 'manual' once someone picks a city by hand; then we stop detecting. */
const LS_CITY_MODE = 'shopping:city-mode';

/** City centres (public coordinates) for picking the nearest city to the viewer. */
const CITY_CENTRES: Record<string, { lat: number; lng: number }> = {
  'tel-aviv': { lat: 32.0853, lng: 34.7818 },
  'ramat-gan': { lat: 32.0684, lng: 34.8248 },
  'beer-sheva': { lat: 31.2518, lng: 34.7913 },
};
/** Farther than this from every centre: we have no prices for where you are. */
const NEAR_CITY_M = 25_000;

type LocState = 'idle' | 'locating' | 'found' | 'far' | 'denied' | 'unavailable';

/** The city nearest to a point, or null when it's farther than NEAR_CITY_M. */
function nearestCity(p: { lat: number; lng: number }): string | null {
  let best: { id: string; d: number } | null = null;
  for (const c of CITIES) {
    const centre = CITY_CENTRES[c.id];
    if (!centre) continue;
    const d = distanceM(p, centre);
    if (!best || d < best.d) best = { id: c.id, d };
  }
  return best && best.d <= NEAR_CITY_M ? best.id : null;
}
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
// The scanner (and the decoder it may load) only downloads when opened.
const Scanner = dynamic(() => import('./Scanner'), { ssr: false });

type Tab = 'item' | 'list' | 'stores' | 'online';
const step = (w: boolean) => (w ? 0.5 : 1);

export default function ShoppingPage() {
  const [lists, setLists] = useState<ShoppingList[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [city, setCity] = useState<string>(CITIES[0].id);
  const [cityMode, setCityMode] = useState<'auto' | 'manual'>('auto');
  const [loc, setLoc] = useState<LocState>('idle');
  const [pickingCity, setPickingCity] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  /** The product window: an item key or a scanned barcode. */
  const [product, setProduct] = useState<{ key: string; scanned: boolean } | null>(null);
  const [scanning, setScanning] = useState(false);
  /** The results under the search box: hidden by a click elsewhere, back on focus (same query). */
  const [hitsOpen, setHitsOpen] = useState(true);
  /** Phone width: a product opens inline under its search result instead of a window. */
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 699px)');
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const [clubs, setClubs] = useState(false);
  const [coupons, setCoupons] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [comparedSig, setComparedSig] = useState('');
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState(false);
  const [tab, setTab] = useState<Tab>('list');
  const [open, setOpen] = useState<string | null>(null);
  /** The list's items are folded away until "עריכה" is tapped. */
  const [editing, setEditing] = useState(false);
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

  // ── city: detected from the device location unless picked by hand ──
  function detectCity() {
    if (!navigator.geolocation) return setLoc('unavailable');
    setLoc('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const id = nearestCity({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (id) {
          setCity(id);
          setLoc('found');
        } else {
          setLoc('far');
        }
      },
      (err) => setLoc(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60 * 60 * 1000 },
    );
  }
  const pickCity = (id: string) => {
    setCity(id);
    setCityMode('manual');
    setPickingCity(false);
  };
  const useMyLocation = () => {
    setCityMode('auto');
    setPickingCity(false);
    detectCity();
  };

  // ── load lists (creating the first one) ──
  useEffect(() => {
    const savedCity = lsGet(LS_CITY);
    const manual = lsGet(LS_CITY_MODE) === 'manual';
    if (manual) setCityMode('manual');
    else detectCity();
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
  useEffect(() => lsSet(LS_CITY_MODE, cityMode), [cityMode]);

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

  const addItem = (h: { key: string; name: string; w: boolean }) => {
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
  // A click outside the search closes its results, and one outside the list
  // editor closes the editor. Clicks inside the product window or the scanner
  // don't count, and the search box counts as part of editing (it's where
  // items are added). What was typed or opened stays; it just folds away.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t?.closest || t.closest('.sh-sheet-backdrop, .sh-scan')) return;
      if (!t.closest('.sh-search')) setHitsOpen(false);
      if (!t.closest('#sh-list-body, .sh-chip--edit, .sh-search')) setEditing(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

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
  /** The city of the result on screen: a new city picks its tab again. */
  const shownCity = useRef<string | null>(null);
  useEffect(() => {
    shownCity.current = result?.city ?? null;
  }, [result]);
  const compare = useCallback(async () => {
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
      if (shownCity.current !== res.city) {
        setOpen(null);
        // The list tab also holds the neighbourhood shops; online only when there's nothing nearby at all.
        setTab(res.physical.length || res.manual.length ? 'list' : 'online');
      }
    } catch {
      setCompareError(true);
    } finally {
      setComparing(false);
    }
  }, [city, clubs, coupons, list, sig]);

  // There's no compare button: the results follow the list, the city and the
  // club/coupon options, debounced like the autosave (and on first load).
  const stale = !!result && comparedSig !== sig;
  const hasItems = !!list?.items.length;
  useEffect(() => {
    if (!hasItems) {
      setResult(null);
      return;
    }
    if (comparedSig === sig || comparing || compareError) return;
    const t = setTimeout(() => compare(), 600);
    return () => clearTimeout(t);
  }, [hasItems, sig, comparedSig, comparing, compareError, compare]);

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
                <React.Fragment key={l.id}>
                  <button type="button" className={`sh-chip ${l.id === list.id ? 'is-on' : ''}`}
                    aria-pressed={l.id === list.id} onClick={() => pickList(l.id)}>
                    {l.name} <small>{l.items.length}</small>
                  </button>
                  {l.id === list.id && (
                    <button type="button" className={`sh-chip sh-chip--edit ${editing ? 'is-on' : ''}`}
                      onClick={() => setEditing(!editing)} aria-expanded={editing} aria-controls="sh-list-body">
                      {editing ? <><FaCheck aria-hidden /> סיום</> : <><FaPen aria-hidden /> עריכה</>}
                    </button>
                  )}
                </React.Fragment>
              ))}
              <button type="button" className="sh-chip sh-chip--add" onClick={newList} aria-label="רשימה חדשה" title="רשימה חדשה"><FaPlus aria-hidden /></button>
            </nav>

            <div className="sh-loc">
              <FaMapMarkerAlt aria-hidden />
              <span>
                <b>{CITIES.find((c) => c.id === city)?.name}</b>
                <small>{LOC_NOTE[cityMode === 'manual' ? 'manual' : loc]}</small>
              </span>
              <button type="button" className="sh-link sh-loc-change" onClick={() => setPickingCity(!pickingCity)}
                aria-expanded={pickingCity} aria-controls="sh-loc-pick">
                {pickingCity ? 'סגירה' : 'שינוי'}
              </button>
            </div>
            {pickingCity && (
              <div className="sh-loc-pick" id="sh-loc-pick" role="radiogroup" aria-label="עיר">
                <button type="button" className={`sh-chip ${cityMode === 'auto' ? 'is-on' : ''}`} onClick={useMyLocation}
                  role="radio" aria-checked={cityMode === 'auto'}>
                  <FaLocationArrow aria-hidden /> לפי המיקום
                </button>
                {CITIES.map((c) => (
                  <button key={c.id} type="button" role="radio" aria-checked={cityMode === 'manual' && city === c.id}
                    className={`sh-chip ${cityMode === 'manual' && city === c.id ? 'is-on' : ''}`} onClick={() => pickCity(c.id)}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            <section className="sh-search">
              <label className="sh-search-box">
                <FaSearch aria-hidden />
                <input ref={searchRef} type="search" value={query}
                  onChange={(e) => { setQuery(e.target.value); setHitsOpen(true); }} onFocus={() => setHitsOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') clearSearch();
                    if (e.key === 'Enter' && hits?.length) addItem(hits[0]);
                  }}
                  placeholder="חיפוש מוצר או ברקוד" aria-label="חיפוש מוצר" enterKeyHint="search" autoComplete="off" />
                {searching && <span className="sh-spinner" aria-hidden />}
                {query ? (
                  <button type="button" className="sh-icon-btn" onClick={clearSearch} aria-label="ניקוי החיפוש"><FaTimes /></button>
                ) : (
                  <button type="button" className="sh-icon-btn" onClick={() => setScanning(true)} aria-label="סריקת ברקוד במצלמה"><FaBarcode /></button>
                )}
              </label>
              {hits && hitsOpen && (
                <ul className="sh-hits">
                  {!searching && !hits.length && <li className="sh-muted sh-hits-empty">לא נמצאו מוצרים</li>}
                  {hits.map((h) => {
                    const inList = qtyOf.get(h.key);
                    return (
                      <li key={h.key} className={`sh-hit ${inList ? 'is-in' : ''} ${product?.key === h.key ? 'is-open' : ''}`}>
                        <button type="button" className="sh-hit-main" aria-expanded={narrow ? product?.key === h.key : undefined}
                          onClick={() => setProduct(product?.key === h.key && narrow ? null : { key: h.key, scanned: false })}>
                          <Thumb src={h.img} size={44} />
                          <span className="sh-hit-name">
                            {h.name}{h.w && <small className="sh-weighed">לפי משקל</small>}
                            {realMaker(h.manufacturer) && <small className="sh-hit-maker">{realMaker(h.manufacturer)}</small>}
                          </span>
                          <span className="sh-hit-meta">
                            {h.minPrice !== null ? (
                              <>
                                <b>{h.minPrice === h.maxPrice ? ils(h.minPrice) : `${ils(h.minPrice)}–${ils(h.maxPrice!)}`}</b>
                                <span>{h.stores} {h.stores === 1 ? 'סניף' : 'סניפים'}</span>
                                {h.cheapest && h.stores > 1 && <span className="sh-hit-cheapest">הכי זול ב{h.cheapest.chainName} {h.cheapest.name}</span>}
                                {h.stores === 1 && h.cheapest && <span className="sh-hit-cheapest">{h.cheapest.chainName} {h.cheapest.name}</span>}
                                {h.sources.filter((s) => s !== 'official').map((s) => <SourceTag key={s} source={s} />)}
                              </>
                            ) : <span>לא נמכר בעיר</span>}
                          </span>
                        </button>
                        <button type="button" className="sh-hit-btn sh-hit-btn--add" onClick={() => addItem(h)}
                          aria-label={inList ? `עוד אחד לרשימה: ${h.name} (כבר ${qtyLabel(inList, h.w)})` : `הוספה לרשימה: ${h.name}`}>
                          {inList ? <><FaCheck aria-hidden /> <small>{qtyLabel(inList, h.w)}</small></> : <FaPlus aria-hidden />}
                        </button>
                        {narrow && product?.key === h.key && (
                          <ProductSheet inline itemKey={h.key} scanned={false} city={city} inList={qtyOf}
                            onAdd={addItem} onClose={() => setProduct(null)} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {!itemCount && <p className="sh-empty">הרשימה ריקה. חפשו מוצר או סרקו ברקוד כדי להוסיף.</p>}
            {saveError && <p className="sh-error">השינויים לא נשמרו. הם יישמרו בשינוי הבא.</p>}
            {editing && (
            <section className="sh-card" id="sh-list-body" aria-label={`עריכת ${list.name}`}>
              <div className="sh-list-tools">
                <button type="button" className="sh-btn sh-btn--ghost" onClick={renameList}><FaPen aria-hidden /> שינוי שם</button>
                <button type="button" className="sh-btn sh-btn--ghost sh-btn--danger" onClick={deleteList}><FaTrash aria-hidden /> מחיקת הרשימה</button>
              </div>
              {itemCount > 0 && (
              <>
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
              <div className="sh-options">
                <label className="sh-toggle"><input type="checkbox" checked={clubs} onChange={(e) => setClubs(e.target.checked)} /> לחשב מבצעי מועדון</label>
                <label className="sh-toggle"><input type="checkbox" checked={coupons} onChange={(e) => setCoupons(e.target.checked)} /> לחשב קופונים</label>
              </div>
              </>
              )}
            </section>
            )}

            {result && (
              <Results ref={resultsRef} result={result} list={list} updating={stale || comparing} tab={tab} setTab={setTab} open={open} setOpen={setOpen}
                onPricesSaved={() => compare()} />
            )}
            {!result && hasItems && !compareError && <div className="sh-skeleton" aria-label="משווה מחירים" />}
            {compareError && (
              <p className="sh-error sh-retry">
                לא הצלחנו להשוות את המחירים.{' '}
                <button type="button" className="sh-link" onClick={() => setCompareError(false)}>לנסות שוב</button>
              </p>
            )}
          </>
        )}
        {scanning && (
          <Scanner onClose={() => setScanning(false)}
            onCode={(code) => { setScanning(false); setProduct({ key: code, scanned: true }); }} />
        )}
        {product && !(narrow && hits?.some((h) => h.key === product.key) && !product.scanned) && (
          <ProductSheet itemKey={product.key} scanned={product.scanned} city={city} inList={qtyOf}
            onAdd={addItem} onClose={() => setProduct(null)} />
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
  const full = result.physical.filter((b) => !b.missing.length);
  const bestOnline = result.online[0];
  const partial = result.physical.filter((b) => b.missing.length);
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
          {worst && worst !== best && (
            <span className="sh-hero-meta">{ils(worst.total - best.total)} פחות מהסניף היקר ברשימה</span>
          )}
          {updating && <span className="sh-updating">מעדכן…</span>}
          {splitSaving >= SPLIT_WORTH && (
            <button type="button" className="sh-hero-split" onClick={() => setTab('stores')}>
              <span>
                <b>בשתי חנויות: {ils(splitSaving)} פחות</b>
                <small>{bestSplit.stores.map((b) => result.stores[b.store]?.chainName ?? '?').join(' ו־')}, {ils(bestSplit.total)} ביחד</small>
              </span>
              <FaChevronDown className="sh-hero-split-go" aria-hidden />
            </button>
          )}
        </div>
      ) : (
        !result.physical.length ? (
        <div className="sh-hero is-partial">
          <span className="sh-hero-kicker">אין עדיין מחירים בחנויות שליד הבית</span>
          <span className="sh-hero-meta">
            {result.manual.length > 0
              ? <>לחנויות השכונתיות כאן אין קובץ מחירים. אפשר להקליד מחירים למטה, ובינתיים להשוות אונליין.</>
              : <>אפשר להשוות בינתיים בחנויות אונליין.</>}
          </span>
          {bestOnline && (
            <button type="button" className="sh-hero-split" onClick={() => setTab('online')}>
              <span>
                <b>הכי זול אונליין: {ils(bestOnline.total)}</b>
                <small>{storeName(result.stores[bestOnline.store])}{bestOnline.missing.length ? `, חסרים ${bestOnline.missing.length}` : ''}</small>
              </span>
              <FaChevronDown className="sh-hero-split-go" aria-hidden />
            </button>
          )}
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
            <button type="button" className="sh-link" onClick={() => setTab('item')}>לראות איפה כל מוצר הכי זול</button>
          </span>
          {updating && <span className="sh-updating">מעדכן…</span>}
        </div>
        )
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
          {!result.physical.length && !result.manual.length && <p className="sh-empty">אין חנויות עם מחירים ליד הבית.</p>}
          {full.length > 0 && partial.length > 0 && <h3 className="sh-group-title">יש בהן את כל המוצרים</h3>}
          {full.map((b, i) => (
            <StoreCard key={b.store} basket={b} result={result} rank={i} best={best}
              open={open === `s${b.store}`} toggle={() => toggle(`s${b.store}`)} />
          ))}
          {partial.length > 0 && <h3 className="sh-group-title">חסרים בהן מוצרים</h3>}
          {partial.map((b, i) => (
            <StoreCard key={b.store} basket={b} result={result} rank={full.length + i} best={best}
              open={open === `s${b.store}`} toggle={() => toggle(`s${b.store}`)} />
          ))}
          {result.manual.length > 0 && (
            <ManualStores key={result.city} baskets={result.manual} result={result} list={list} onSaved={onPricesSaved}
              startOpen={!result.physical.length} />
          )}
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
                <button type="button" className="sh-store-head sh-store-head--split" onClick={() => toggle(id)} aria-expanded={open === id}>
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

    </section>
  );
});

/** A manufacturer worth showing: the files often say "לא ידוע", "---" or nothing. */
const realMaker = (m: string | null | undefined) => {
  const t = (m ?? '').trim();
  return !t || /^(-+|לא ידוע|לא\s*ידוע|כללי|unknown|n\/a)$/i.test(t) ? null : t;
};

const storeName = (s: StoreInfo | undefined) => (s ? `${s.chainName} ${s.name}` : '?');

/**
 * The street part of an official address. Some files append notes
 * ("הרצל 91,עובר להרצל 114)"), so keep the text before the first comma or
 * parenthesis.
 */
const cleanAddress = (a: string | null | undefined) => (a ?? '').split(/[,(]/)[0].replace(/[()]/g, '').trim();

/** The small line next to the city name. */
const LOC_NOTE: Record<LocState | 'manual', string> = {
  idle: '',
  locating: 'מאתר מיקום…',
  found: 'לפי המיקום שלך',
  far: 'אין לנו מחירים באזור שלך',
  denied: 'בלי גישה למיקום',
  unavailable: 'המיקום לא זמין',
  manual: 'נבחר ידנית',
};

/** A two-store split is offered only when it saves at least this (agorot). */
const SPLIT_WORTH = 500;

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
  const address = cleanAddress(store.address);
  return (
    <article className={`sh-card sh-store ${isBest ? 'is-best' : ''}`}>
      <button type="button" className="sh-store-head" onClick={toggle} aria-expanded={open}>
        <span className="sh-rank">{rank + 1}</span>
        <span className="sh-store-name">{store.chainName} <span className="sh-branch">{store.name}</span></span>
        <span className="sh-store-total">{ils(basket.total)}</span>
        <FaChevronDown className={`sh-caret ${open ? 'is-open' : ''}`} aria-hidden />
        <span className="sh-store-meta">
          {basket.missing.length > 0 && <span className="sh-badge-miss">חסרים {basket.missing.length}</span>}
          {more > 0 && <span className="sh-more">+{ils(more)}</span>}
          <SourceBadge store={store} now={result.now} />
          {address && <span className="sh-addr">{address}</span>}
        </span>
        {saved > 0 && <span className="sh-store-save">מבצעים חוסכים {ils(saved)}</span>}
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
  if (!sold.length) {
    return <p className="sh-view-note">לאף מוצר ברשימה אין עדיין מחיר בחנויות שליד הבית.</p>;
  }
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

/** Manual stores listed before "show all". */
const MANUAL_SHOWN = 5;

function ManualStores({ baskets, result, list, onSaved, startOpen }: {
  baskets: StoreBasket[];
  result: CompareResponse;
  list: ShoppingList;
  onSaved: () => void;
  /** Open from the start: when these are the only stores near home. */
  startOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(!!startOpen);
  // A city can have dozens; the API puts the best-priced first, so show those.
  const [all, setAll] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  // Hiding a single shop behind "show more" isn't worth a tap.
  const shown = all || baskets.length <= MANUAL_SHOWN + 1 ? baskets : baskets.slice(0, MANUAL_SHOWN);
  const priced = baskets.filter((b) => b.lines.some((l) => l.available)).length;
  return (
    <section className="sh-card sh-unpriced">
      <button type="button" className="sh-unpriced-head" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span>
          <b>{baskets.length} חנויות שכונתיות</b>
          <small>{priced ? `ב־${priced} מהן כבר יש מחירים. אפשר להקליד עוד.` : 'אין להן קובץ מחירים. אפשר להקליד מחירים בעצמנו.'}</small>
        </span>
        <FaChevronDown className={`sh-caret ${expanded ? 'is-open' : ''}`} aria-hidden />
      </button>
      {expanded && (
        <>
          <ul className="sh-unpriced-list">
            {shown.map((b) => {
              const st = result.stores[b.store];
              const n = b.lines.filter((l) => l.available).length;
              const open = editing === b.store;
              return (
                <li key={b.store}>
                  <button type="button" className="sh-shop-row" onClick={() => setEditing(open ? null : b.store)} aria-expanded={open}>
                    <span className="sh-shop-name">
                      {st?.name ?? b.store}
                      {st?.address && <small>{cleanAddress(st.address)}</small>}
                    </span>
                    <span className="sh-shop-state">{n ? `${n}/${b.lines.length}, ${ils(b.total)}` : 'הקלדה'}</span>
                    <FaChevronDown className={`sh-caret ${open ? 'is-open' : ''}`} aria-hidden />
                  </button>
                  {open && <ManualPrices store={b.store} basket={b} list={list} onSaved={onSaved} />}
                </li>
              );
            })}
          </ul>
          {baskets.length > shown.length && (
            <button type="button" className="sh-btn sh-more-btn" onClick={() => setAll(true)}>
              עוד {baskets.length - shown.length} חנויות
            </button>
          )}
        </>
      )}
    </section>
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

// ── one product: every store's price ──

function ProductSheet({ itemKey, scanned, city, inList, onAdd, onClose, inline }: {
  itemKey: string;
  /** Under its search result (phone) instead of a window over the page. */
  inline?: boolean;
  /** It came from the camera: say "barcode not found" rather than "product not found". */
  scanned: boolean;
  city: string;
  inList: Map<string, number>;
  onAdd: (item: { key: string; name: string; w: boolean }) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<ItemResponse | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const ctl = new AbortController();
    setState('loading');
    fetch(`${SHOPPING_API_PATH}/item?key=${encodeURIComponent(itemKey)}&city=${city}`, { signal: ctl.signal })
      .then(async (res) => {
        if (res.status === 404) return setState('missing');
        if (!res.ok) throw new Error(String(res.status));
        setData(await res.json());
        setState('ok');
      })
      .catch(() => {
        if (!ctl.signal.aborted) setState('error');
      });
    return () => ctl.abort();
  }, [itemKey, city]);

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!inline) closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    if (inline) return () => window.removeEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, inline]);
  useEffect(() => {
    if (inline && state === 'ok') panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [inline, state]);

  const it = data?.item;
  const qty = it ? inList.get(it.key) : undefined;
  const body = (
      <>
        <button ref={closeRef} type="button" className="sh-icon-btn sh-sheet-close" onClick={onClose} aria-label="סגירה"><FaTimes /></button>
        {state === 'loading' && <div className="sh-skeleton" aria-label="טוען" />}
        {state === 'missing' && (
          <div className="sh-sheet-empty">
            <h2 id="sh-sheet-title" className="sh-h2">{scanned ? 'הברקוד לא נמצא' : 'המוצר לא נמצא'}</h2>
            <p className="sh-muted">
              {scanned ? <>הברקוד <bdi>{itemKey}</bdi> לא מופיע בקבצי המחירים של הרשתות שאנחנו קוראים.</> : 'אולי הוא הוסר מקבצי המחירים.'}
            </p>
          </div>
        )}
        {state === 'error' && (
          <div className="sh-sheet-empty">
            <h2 id="sh-sheet-title" className="sh-h2">לא הצלחנו לטעון את המחירים</h2>
            <p className="sh-muted">בדקו את החיבור ונסו לפתוח שוב.</p>
          </div>
        )}
        {state === 'ok' && data && it && (
          <>
            <div className="sh-sheet-head">
              <Thumb src={it.img} size={88} />
              <div>
                <h2 id="sh-sheet-title" className="sh-sheet-title">{it.name}</h2>
                <p className="sh-sheet-sub">
                  {it.barcode && <span>ברקוד <bdi>{it.key}</bdi></span>}
                  {realMaker(it.manufacturer) && <span>יצרן/מותג: {realMaker(it.manufacturer)}</span>}
                  {it.w && <span>מחיר לק״ג</span>}
                </p>
              </div>
            </div>
            <button type="button" className="sh-btn sh-btn--primary" onClick={() => onAdd(it)}>
              {qty ? <>עוד אחד לרשימה <small>כבר {qtyLabel(qty, it.w)}</small></> : <><FaPlus aria-hidden /> הוספה לרשימה</>}
            </button>
            <PriceTable title="בחנויות בעיר" rows={data.physical} data={data} empty="לא נמכר בחנויות בעיר." />
            {data.online.length > 0 && <PriceTable title="אונליין" rows={data.online} data={data} />}
          </>
        )}
      </>
  );
  if (inline) {
    return (
      <div ref={panelRef} className="sh-sheet sh-sheet--inline" role="region" aria-labelledby="sh-sheet-title">
        {body}
      </div>
    );
  }
  return (
    <div className="sh-sheet-backdrop" onClick={onClose}>
      <div className="sh-sheet" role="dialog" aria-modal="true" aria-labelledby="sh-sheet-title" onClick={(e) => e.stopPropagation()}>
        {body}
      </div>
    </div>
  );
}

/**
 * One store's price. Where it came from (source, update time) shows on hover
 * over the price, or on tap where there's no hover.
 */
function PriceRow({ r, best, data }: { r: ItemPrice; best: boolean; data: ItemResponse }) {
  const [showSrc, setShowSrc] = useState(false);
  const st = data.stores[r.store];
  const discounted = r.cost < r.regularUnit;
  return (
    <li className={`sh-sheet-row ${best ? 'is-best' : ''} ${showSrc ? 'is-src' : ''}`}>
      <span className="sh-sheet-store">
        <b>{st ? <>{st.chainName} <span className="sh-branch">{st.name}</span></> : r.store}</b>
        {r.applied.map((p) => <small key={p.id} className="sh-promo">{p.description} <small>עד {dayMonth(p.end)}</small></small>)}
        {/* A chain can publish the same deal twice under two ids; show it once. */}
        {r.offers.filter((o, j, all) => all.findIndex((x) => x.reason === o.reason && x.description === o.description) === j).map((o) => (
          <small key={o.id} className="sh-promo is-offer">{OFFER_LABEL[o.reason]}: {o.description}</small>
        ))}
      </span>
      <button type="button" className="sh-price-btn" onClick={() => setShowSrc(!showSrc)} aria-expanded={showSrc}
        aria-label={`${ils(r.cost)}${st ? `, ${SOURCE[st.source].label}` : ''}`}>
        <span className="sh-line-price">
          <b>{ils(r.cost)}</b>
          {discounted && <s>{ils(r.regularUnit)}</s>}
        </span>
        {st && <span className="sh-price-src"><SourceBadge store={st} now={data.now} /></span>}
      </button>
    </li>
  );
}

function PriceTable({ title, rows, data, empty }: { title: string; rows: ItemPrice[]; data: ItemResponse; empty?: string }) {
  return (
    <section className="sh-sheet-section">
      <h3 className="sh-section-title">{title} <small>{rows.length}</small></h3>
      {!rows.length && empty && <p className="sh-empty">{empty}</p>}
      <ol className="sh-sheet-rows">
        {rows.map((r, i) => <PriceRow key={r.store} r={r} best={i === 0} data={data} />)}
      </ol>
    </section>
  );
}
