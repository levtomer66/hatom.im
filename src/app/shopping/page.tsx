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
import { FaMinus, FaPlus, FaTrash, FaSearch, FaChevronDown, FaTimes, FaCheck, FaPen, FaBarcode, FaMapMarkerAlt, FaLocationArrow, FaLock, FaShoppingCart, FaArrowRight, FaEllipsisH } from 'react-icons/fa';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import { CITIES } from '@/lib/shopping/cities';
import { distanceM } from '@/lib/shopping/places';
import { SHOPPING_API_PATH } from '@/lib/shopping/config';
import { normalizeQty, type ShoppingList, type ShoppingListItem } from '@/lib/shopping/lists';
import type { CompareResponse, ShoppingPlan, ItemBest, ItemPrice, ItemResponse, ManualPriceResponse, PriceSource, PromoDetail, SearchHit, StoreInfo } from '@/lib/shopping/api-types';
import type { LineResult, Offer, PromoRef, StoreBasket } from '@/lib/shopping/pricing';
import { dealNudge, groupByDepartment, progress, withPending, type PlanKind, type Trip, type TripCreate, type TripItem } from '@/lib/shopping/trips';
import { cleanAddress, dayMonth, ils, MultiStar, multiNote, qtyLabel, SaleLabel, storeName, Thumb } from './ui';
import Here from './Here';

/** "2026-11-28T23:59" → "28.11" */
const stamp = (local: string) => `${dayMonth(local)} ${local.slice(11, 16)}`;
/** Whole days between two Israel-local stamps (date part only). */
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86_400_000);

const OFFER_LABEL: Record<Offer['reason'], string> = {
  club: 'במועדון',
  coupon: 'בקופון',
  'min-purchase': 'בקנייה מעל סכום',
  unclear: 'לבדוק במדף, המחיר בקובץ לא סביר',
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
/** Offline copies: the lists, each list's open trip, and each trip's unsent ticks. */
const LS_LISTS_CACHE = 'shopping:lists-cache';
const lsTrip = (listId: string) => `shopping:trip:${listId}`;
const lsQueue = (tripId: string) => `shopping:trip-queue:${tripId}`;
const lsJson = <T,>(k: string): T | null => {
  try {
    return JSON.parse(lsGet(k) ?? 'null') as T | null;
  } catch {
    return null;
  }
};
const lsDel = (k: string) => {
  try {
    localStorage.removeItem(k);
  } catch {
    /* private mode */
  }
};
/** No connection, as opposed to the server saying no (api() throws Error(status) then). */
const isNetworkError = (e: unknown) => e instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine);
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
/** The store count last picked on the "הכי זול" card. */
const PLAN_STORES_KEY = 'sh-plan-stores';
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
  /** The active list's open trip, and whether its in-store screen is showing. */
  const [trip, setTrip] = useState<Trip | null>(null);
  const [inStore, setInStore] = useState(false);
  /** The "אני בסופר" screen. */
  const [here, setHere] = useState(false);
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
        if (!all.length) all = [await api<ShoppingList>('/lists', { method: 'POST', body: JSON.stringify({ name: 'רשימת קניות', shared: true }) })];
        setLists(all);
        lsSet(LS_LISTS_CACHE, JSON.stringify(all));
        const saved = lsGet(LS_LIST);
        setActiveId(all.some((l) => l.id === saved) ? saved : all[0].id);
      } catch (e) {
        // In the store without signal: the last lists seen on this phone, so an open trip still opens.
        const cached = isNetworkError(e) ? lsJson<ShoppingList[]>(LS_LISTS_CACHE) : null;
        if (cached?.length) {
          setLists(cached);
          const saved = lsGet(LS_LIST);
          setActiveId(cached.some((l) => l.id === saved) ? saved : cached[0].id);
          setToast('אין חיבור. מוצגים הנתונים האחרונים מהטלפון.');
        } else {
          setLoadError(true);
        }
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
  useEffect(() => {
    if (!activeId) return;
    let live = true;
    api<Trip | null>(`/trips?listId=${activeId}`)
      .then((t) => { if (live) setTrip(t); })
      .catch((e) => { if (live && isNetworkError(e)) setTrip(lsJson<Trip>(lsTrip(activeId))); });
    return () => { live = false; };
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    if (trip && !trip.endedAt) lsSet(lsTrip(activeId), JSON.stringify(trip));
    else lsDel(lsTrip(activeId));
  }, [trip, activeId]);

  /** Start a trip on the chosen plan, or join the list's open one. */
  const startTrip = async (plan: ShoppingPlan) => {
    if (!list || !result) return;
    if (trip) return setInStore(true);
    try {
      const t = await api<Trip>('/trips', { method: 'POST', body: JSON.stringify(tripSnapshot(result, plan, list.id, city)) });
      setTrip(t);
      setInStore(true);
    } catch {
      setToast('לא הצלחנו להתחיל את הקנייה. נסו שוב.');
    }
  };

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
      setToast('רשימה אישית. אפשר לשתף אותה בעריכה.');
    } catch {
      setSaveError(true);
    }
  };
  /** Shared with everyone, or personal (only the creator may switch it). */
  const setShared = async (shared: boolean) => {
    if (!list?.mine) return;
    try {
      await api(`/lists/${list.id}`, { method: 'PATCH', body: JSON.stringify({ shared }) });
      setLists((ls) => ls!.map((l) => (l.id === list.id ? { ...l, shared } : l)));
      setToast(shared ? 'הרשימה משותפת עכשיו לכל מי שיש לו גישה לדף' : 'הרשימה אישית עכשיו, רק לך');
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
        const created = await api<ShoppingList>('/lists', { method: 'POST', body: JSON.stringify({ name: 'רשימת קניות', shared: true }) });
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
          {lists && (
            <button type="button" className="sh-btn sh-here-entry" onClick={() => setHere(true)}>
              <FaMapMarkerAlt aria-hidden /> אני בסופר
            </button>
          )}
        </header>

        {loadError && <p className="sh-error">לא הצלחנו לטעון את הרשימות. נסו לרענן.</p>}
        {!lists && !loadError && <div className="sh-skeleton" aria-label="טוען" />}

        {lists && list && (
          <>
            {trip && !inStore && (
              <button type="button" className="sh-resume" onClick={() => setInStore(true)}>
                <FaShoppingCart aria-hidden />
                <span>
                  <b>קנייה בתהליך</b>
                  <small>{progress(trip).count} מתוך {progress(trip).of} מוצרים, {trip.stops.map((st) => st.storeName).join(', ')}</small>
                </span>
                <span className="sh-resume-go">להמשיך</span>
              </button>
            )}
            <nav className="sh-scroller" aria-label="רשימות">
              {lists.map((l) => (
                <React.Fragment key={l.id}>
                  <button type="button" className={`sh-chip ${l.id === list.id ? 'is-on' : ''}`}
                    aria-pressed={l.id === list.id} onClick={() => pickList(l.id)}>
                    {!l.shared && <FaLock className="sh-chip-lock" aria-label="אישית" />}
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
                          <Thumb src={h.img} size={44} by={h.imgBy} />
                          <span className="sh-hit-name">
                            {h.name}{h.w && <small className="sh-weighed">לפי משקל</small>}
                            {realMaker(h.manufacturer) && <small className="sh-hit-maker">{realMaker(h.manufacturer)}</small>}
                          </span>
                          <span className="sh-hit-meta">
                            {h.minPrice !== null ? (
                              <>
                                <b title={h.multi ? '* מחיר ליחידה במבצע כמות' : undefined}>
                                  {h.minPrice === h.maxPrice ? ils(h.minPrice) : `${ils(h.minPrice)}–${ils(h.maxPrice!)}`}{h.multi && <MultiStar />}
                                </b>
                                {h.onSale && <SaleLabel applied idle={false} offers={false} />}
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
              {list.mine ? (
                <label className="sh-toggle sh-share">
                  <input type="checkbox" checked={list.shared} onChange={(e) => setShared(e.target.checked)} />
                  <span>
                    רשימה משותפת
                    <small>{list.shared ? 'כל מי שיש לו גישה לדף רואה ועורך אותה' : 'אישית: רק לך'}</small>
                  </span>
                </label>
              ) : (
                <p className="sh-share-note">רשימה משותפת. רק החשבון שיצר אותה יכול להפוך אותה לאישית.</p>
              )}
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
                onPricesSaved={() => compare()} onStartTrip={startTrip} tripOpen={!!trip} />
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
        {(hits?.some((h) => h.img && h.imgBy === 'off') || Object.values(result?.items ?? {}).some((i) => i.img && i.imgBy === 'off')) && (
          <p className="sh-credit">חלק מתמונות המוצרים: <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer">Open Food Facts</a>, ברישיון CC BY-SA.</p>
        )}
        {scanning && (
          <Scanner onClose={() => setScanning(false)}
            onCode={(code) => { setScanning(false); setProduct({ key: code, scanned: true }); }} />
        )}
        {here && (
          <Here city={city} listName={list?.name ?? null} onAdd={addItem} onClose={() => setHere(false)}
            onOpenItem={(key, scanned) => setProduct({ key, scanned })}
            tripStores={trip && !trip.endedAt ? Object.fromEntries(trip.stops.map((st) => [st.store, st.items.length])) : {}}
            onOpenTrip={() => { setHere(false); setInStore(true); }} />
        )}
        {product && (here || !(narrow && hits?.some((h) => h.key === product.key) && !product.scanned)) && (
          <ProductSheet itemKey={product.key} scanned={product.scanned} city={city} inList={qtyOf}
            onAdd={addItem} onClose={() => setProduct(null)} />
        )}
        {trip && inStore && (
          <InStore trip={trip} onTrip={setTrip} onClose={() => setInStore(false)}
            onEnded={() => { setTrip(null); setInStore(false); setToast('הקנייה הסתיימה'); }} />
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
  onStartTrip: (plan: ShoppingPlan) => void;
  tripOpen: boolean;
}>(function Results({ result, list, updating, tab, setTab, open, setOpen, onPricesSaved, onStartTrip, tripOpen }, ref) {
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

  const hasPlans = !!result.plans?.oneStore;
  const [showAll, setShowAll] = useState(false);

  return (
    <section ref={ref} className={`sh-results ${updating ? 'is-updating' : ''}`} aria-live="polite" aria-busy={updating}>
      {hasPlans && <PlansView key={result.city} result={result} updating={updating} onStart={onStartTrip} tripOpen={tripOpen} />}
      {hasPlans && (
        <button type="button" className="sh-all-toggle" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
          {showAll ? 'הסתרת כל החנויות' : 'כל החנויות והשוואה מפורטת'}
          <FaChevronDown className={`sh-caret ${showAll ? 'is-open' : ''}`} aria-hidden />
        </button>
      )}
      {(!hasPlans || showAll) && (<>
      {hasPlans ? null : best ? (
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
      </>)}
      {hasPlans && !showAll && result.manual.length > 0 && (
        <ManualStores key={`m-${result.city}`} baskets={result.manual} result={result} list={list} onSaved={onPricesSaved} />
      )}
    </section>
  );
});

// ── plans: how to shop the list ──

/**
 * The two ways to shop the list, as cards: "הכי זול" (each item at its
 * cheapest store, up to three stores) and "חנות אחת". The split is only
 * offered as the default when it saves at least ₪15 or covers more items.
 * Below the cards, the chosen plan: its stops and what to buy at each.
 */
function PlansView({ result, updating, onStart, tripOpen }: {
  result: CompareResponse;
  updating: boolean;
  onStart: (plan: ShoppingPlan) => void;
  tripOpen: boolean;
}) {
  const { oneStore, byCount, worth } = result.plans;
  const counts = Object.keys(byCount).map(Number).filter((k) => byCount[k]).sort((x, y) => x - y);
  const [choice, setChoice] = useState<PlanKind>(worth > 1 ? 'cheapest' : 'one-store');
  // How many stores the "הכי זול" card uses: the one picked by hand last time, else the count worth walking to.
  const [picked, setPicked] = useState<number | null>(() => Number(lsGet(PLAN_STORES_KEY)) || null);
  if (!oneStore) return null;
  const count = picked && byCount[picked] ? picked : worth > 1 ? worth : counts[0];
  const cheapest = count ? byCount[count] ?? null : null;
  const plan = choice === 'cheapest' && cheapest ? cheapest : oneStore;
  const saving = cheapest ? oneStore.total - cheapest.total : 0;
  const more = cheapest ? oneStore.missing.length - cheapest.missing.length : 0;
  const pays = !!cheapest && count <= worth;
  const cheapNote = !cheapest
    ? 'חנות אחת כבר הכי זולה'
    : more > 0
      ? `כולל עוד ${more} ${more === 1 ? 'מוצר' : 'מוצרים'} שחסרים בחנות אחת`
      : pays
        ? `${ils(saving)} פחות מחנות אחת`
        : `לא שווה לפצל: ${saving > 0 ? `רק ${ils(saving)} פחות` : 'לא זול יותר'}`;
  // A count that neither covers more nor costs less than the one below it gets a dimmed chip.
  const helps = (k: number) => {
    const p = byCount[k];
    const q = (k > 2 && byCount[k - 1]) || oneStore;
    return !!p && (p.missing.length < q.missing.length || p.total < q.total);
  };
  const pick = (k: number) => {
    setPicked(k);
    setChoice('cheapest');
    lsSet(PLAN_STORES_KEY, String(k));
  };
  const one = result.stores[oneStore.stops[0].store];
  // Walking: the one store's minutes; for a split, the stops' minutes from home summed (store-to-store isn't routed).
  const splitWalk = cheapest?.stops.every((st) => result.stores[st.store]?.walkMin != null)
    ? cheapest.stops.reduce((m, st) => m + (result.stores[st.store].walkMin ?? 0), 0) : null;
  const selectCheapest = () => {
    if (cheapest) setChoice('cheapest');
  };
  const chips = counts.length > 1;
  return (
    <div className="sh-plans">
      {updating && <span className="sh-updating">מעדכן…</span>}
      <div className="sh-plan-cards" role="radiogroup" aria-label="איך לקנות">
        <div role="radio" aria-checked={plan.kind === 'cheapest'} aria-disabled={!cheapest} tabIndex={cheapest ? 0 : -1}
          className={`sh-plan-card ${plan.kind === 'cheapest' ? 'is-on' : ''} ${cheapest && !pays && more <= 0 ? 'is-weak' : ''} ${!cheapest ? 'is-off' : ''}`}
          onClick={selectCheapest}
          onKeyDown={(e) => {
            if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              selectCheapest();
            }
          }}>
          <span className="sh-plan-kind">הכי זול</span>
          <b className="sh-plan-total">{cheapest ? ils(cheapest.total) : ils(oneStore.total)}</b>
          {chips && (
            <span className="sh-plan-counts" role="group" aria-label="עד כמה חנויות">
              <span>עד</span>
              {counts.map((k) => (
                <button key={k} type="button" className={`sh-count ${k === count ? 'is-on' : ''} ${helps(k) ? '' : 'is-flat'}`}
                  aria-pressed={k === count} title={helps(k) ? `עד ${k} חנויות` : 'לא זול יותר'}
                  onClick={(e) => {
                    e.stopPropagation();
                    pick(k);
                  }}>
                  {k}
                </button>
              ))}
              <span>חנויות</span>
            </span>
          )}
          <span className="sh-plan-sub">
            {cheapest ? (chips ? null : `${cheapest.stops.length} חנויות`) : storeName(one)}
            {cheapest && splitWalk != null && <>{chips ? '' : ', '}כ־{splitWalk} דק׳ הליכה</>}
            {!cheapest && one?.walkMin != null && <>, {one.walkMin} דק׳ הליכה</>}
          </span>
          <span className={`sh-plan-note ${cheapest && (pays || more > 0) ? 'is-good' : ''}`}>{cheapNote}</span>
        </div>
        <button type="button" role="radio" aria-checked={plan.kind === 'one-store'}
          className={`sh-plan-card ${plan.kind === 'one-store' ? 'is-on' : ''}`} onClick={() => setChoice('one-store')}>
          <span className="sh-plan-kind">חנות אחת</span>
          <b className="sh-plan-total">{ils(oneStore.total)}</b>
          <span className="sh-plan-sub">{storeName(one)}</span>
          {one?.walkMin != null && <span className="sh-plan-sub">{one.walkMin} דק׳ הליכה</span>}
          <span className={`sh-plan-note ${oneStore.missing.length ? 'is-miss' : ''}`}>
            {oneStore.missing.length ? `חסרים ${oneStore.missing.length}` : 'יש בה הכול'}
          </span>
        </button>
      </div>

      <button type="button" className="sh-btn sh-btn--primary sh-go" onClick={() => onStart(plan)}>
        <FaShoppingCart aria-hidden /> {tripOpen ? 'להמשיך בקנייה' : 'יוצאים לקניות'}
      </button>

      <div className="sh-plan-detail">
        {plan.stops.map((stop, i) => (
          <section key={stop.store} className="sh-plan-stop">
            <h3 className="sh-plan-stop-head">
              {plan.stops.length > 1 && <span className="sh-rank">{i + 1}</span>}
              <span className="sh-store-name">{storeName(result.stores[stop.store])}</span>
              <span className="sh-store-total">{ils(stop.basket.total)}</span>
            </h3>
            {result.stores[stop.store] && (
              <span className="sh-plan-stop-meta">
                {result.stores[stop.store].walkMin != null && <span className="sh-walk">{result.stores[stop.store].walkMin} דק׳ הליכה</span>}
                <SourceBadge store={result.stores[stop.store]} now={result.now} />
                {cleanAddress(result.stores[stop.store].address) && <span className="sh-addr">{cleanAddress(result.stores[stop.store].address)}</span>}
              </span>
            )}
            <Breakdown basket={stop.basket} result={result} onlyAvailable />
          </section>
        ))}
        {plan.missing.length > 0 && <MissingHere keys={plan.missing} result={result} />}
      </div>
    </div>
  );
}

/** Items the plan's stores don't sell, with where they can be had nearby. */
function MissingHere({ keys, result }: { keys: string[]; result: CompareResponse }) {
  return (
    <section className="sh-plan-missing">
      <h3 className="sh-section-title">חסר כאן</h3>
      <ul>
        {keys.map((k) => {
          const it = result.items[k];
          const best = result.perItem.find((x) => x.key === k)?.options[0];
          const st = best ? result.stores[best.store] : undefined;
          return (
            <li key={k}>
              <span>{it?.name ?? k}</span>
              <small>{best && st ? <>{ils(best.cost)} ב{st.chainName} {st.name}</> : 'לא נמכר בחנויות שליד הבית'}</small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A manufacturer worth showing: the files often say "לא ידוע", "---" or nothing. */
const realMaker = (m: string | null | undefined) => {
  const t = (m ?? '').trim();
  return !t || /^(-+|לא ידוע|לא\s*ידוע|כללי|unknown|n\/a)$/i.test(t) ? null : t;
};



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
          {store.walkMin != null && <span className="sh-walk">{store.walkMin} דק׳</span>}
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
      {lines.map((l) => <Line key={l.key} line={l} result={result} store={basket.store} />)}
    </ul>
  );
}

function Line({ line, result, store }: { line: LineResult; result: CompareResponse; store: number }) {
  const it = result.items[line.key];
  const w = it?.w ?? false;
  if (!line.available) {
    return (
      <li className="sh-line is-missing">
        <span className="sh-line-name"><Thumb src={it?.img} size={36} by={it?.imgBy} /><span>{it?.name ?? line.key}</span></span>
        <span className="sh-line-price">לא נמכר כאן</span>
      </li>
    );
  }
  const discounted = line.cost < line.regularCost;
  const idle = result.idle?.[`${store}|${line.key}`] ?? [];
  const deals = [...line.applied, ...line.offers, ...idleRefs(idle, result.promos)];
  return (
    <li className="sh-line">
      <span className="sh-line-name"><Thumb src={it?.img} size={36} by={it?.imgBy} /><span>{it?.name ?? line.key} <small>{qtyLabel(line.qty, w)}</small></span></span>
      <PriceReveal label={ils(line.cost)} pop={deals.length ? <DealInfo deals={deals} promos={result.promos} /> : null}>
        <SaleLabel applied={line.applied.length > 0} idle={idle.length > 0} offers={line.offers.length > 0} />
        <span className="sh-line-price">
          {discounted && <s>{ils(line.regularCost)}</s>} <b>{ils(line.cost)}</b>
          {(line.qty !== 1 || discounted) && <small>{ils(line.effectiveUnit)} ל{w ? 'ק״ג' : 'יח׳'}</small>}
        </span>
      </PriceReveal>
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
      <span className="sh-line-name"><Thumb src={it?.img} size={44} by={it?.imgBy} /><span>{it?.name ?? row.key} <small>{qtyLabel(row.qty, w)}</small></span></span>
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
              <div className="sh-sheet-photo">
                <Thumb src={it.img} size={88} by={it.imgBy} />
                {it.img && it.imgBy === 'off' && <OffCredit barcode={it.barcode ? it.key : null} />}
                {it.img && it.imgBy === 'name' && <span className="sh-photo-credit is-plain">תמונה להמחשה</span>}
              </div>
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
  const st = data.stores[r.store];
  // Always the price of one unit: a multi-buy at its per-unit price (r.cost), with an asterisk.
  const multi = r.multi ?? null;
  const unit = r.cost;
  const discounted = unit < r.regularUnit;
  return (
    <li className={`sh-sheet-row ${best ? 'is-best' : ''}`}>
      <span className="sh-sheet-store">
        <b>{st ? <>{st.chainName} <span className="sh-branch">{st.name}</span></> : r.store}</b>
        {r.applied.map((p) => <small key={p.id} className="sh-promo">{p.description} <small>עד {dayMonth(p.end)}</small></small>)}
        {/* A chain can publish the same deal twice under two ids; show it once. */}
        {r.offers.filter((o, j, all) => all.findIndex((x) => x.reason === o.reason && x.description === o.description) === j).map((o) => (
          <small key={o.id} className="sh-promo is-offer">{OFFER_LABEL[o.reason]}: {o.description}</small>
        ))}
      </span>
      <PriceReveal label={`${ils(unit)}${multi ? `, ${multiNote(multi)}` : ''}${st ? `, ${SOURCE[st.source].label}` : ''}`}
        pop={<>
          {multi && <span className="sh-multi-note">{multiNote(multi)}</span>}
          {st && <SourceBadge store={st} now={data.now} />}
          {(r.applied.length > 0 || r.offers.length > 0 || r.idle.length > 0) && (
            <DealInfo deals={[...r.applied, ...r.offers, ...idleRefs(r.idle, data.promos)]} promos={data.promos} />
          )}
        </>}>
        <SaleLabel applied={r.applied.length > 0 || !!multi} idle={!multi && r.idle.length > 0} offers={r.offers.length > 0} />
        <span className="sh-line-price">
          <b>{ils(unit)}{multi && <MultiStar />}</b>
          {discounted && <s>{ils(r.regularUnit)}</s>}
        </span>
      </PriceReveal>
    </li>
  );
}

/**
 * A price that reveals more about itself (its source, its deals' terms) on
 * hover, or on tap where there's no hover. With nothing to reveal it's a
 * plain price.
 */
function PriceReveal({ label, pop, children }: { label: string; pop: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!pop) return <>{children}</>;
  return (
    <span className={`sh-reveal ${open ? 'is-open' : ''}`}>
      <button type="button" className="sh-price-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={label}>
        {children}
      </button>
      <span className="sh-reveal-pop" role="note">{pop}</span>
    </span>
  );
}

/** Untriggered deals as refs for DealInfo (their text is in the details map). */
function idleRefs(ids: string[], promos: Record<string, PromoDetail> | undefined): PromoRef[] {
  return ids.flatMap((id) => (promos?.[id] ? [{ id, description: promos[id].description, end: promos[id].end }] : []));
}

/** The terms of each deal: dates, basket minimum, limit, club or coupon, the chain's remarks. */
function DealInfo({ deals, promos }: { deals: PromoRef[]; promos: Record<string, PromoDetail> | undefined }) {
  const seen = new Set<string>();
  const unique = deals.filter((d) => !seen.has(d.description) && seen.add(d.description));
  return (
    <span className="sh-deal-info">
      {unique.map((d) => {
        const p = promos?.[d.id];
        return (
          <span key={d.id} className="sh-deal">
            <b>{d.description}</b>
            {p?.minQty != null && p.minQty > 1 && <span>מ־{p.minQty} יחידות</span>}
            <span>{p ? `${dayMonth(p.start)}–${dayMonth(p.end)}` : `עד ${dayMonth(d.end)}`}</span>
            {p?.minAmt != null && <span>בקנייה מעל {ils(p.minAmt)}</span>}
            {p?.limit != null && <span>עד {p.limit} ללקוח</span>}
            {p?.clubName && <span>לחברי {p.clubName}</span>}
            {p?.coupon && <span>בהצגת קופון</span>}
            {/* Remarks often just repeat the description. */}
            {p?.remarks && !d.description.includes(p.remarks.trim()) && !p.remarks.includes(d.description.trim()) && <span>{p.remarks}</span>}
          </span>
        );
      })}
    </span>
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

// ── a trip: the plan taken into the store ──

/** What a trip keeps of the plan: each stop's items with name, quantity, estimated cost and department. */
function tripSnapshot(result: CompareResponse, plan: ShoppingPlan, listId: string, city: string): TripCreate {
  return {
    listId,
    plan: plan.kind as PlanKind,
    city,
    stops: plan.stops.map((s) => ({
      store: s.store,
      storeName: storeName(result.stores[s.store]),
      items: s.basket.lines.filter((l) => l.available).map((l) => {
        const it = result.items[l.key];
        // A deal this quantity doesn't reach yet, for the in-store "add one more?" nudge.
        const idle = (result.idle?.[`${s.store}|${l.key}`] ?? []).map((id) => result.promos?.[id]).find((p) => p?.minQty && p.minQty > l.qty);
        return {
          key: l.key, name: it?.name ?? l.key, qty: l.qty, w: it?.w ?? false, cost: l.cost, d: it?.d ?? null, img: it?.img ?? null, imgBy: it?.imgBy ?? null,
          deal: idle ? { text: idle.description, minQty: idle.minQty! } : null,
        };
      }),
    })),
    missing: plan.missing.map((k) => ({ key: k, name: result.items[k]?.name ?? k })),
    estimate: plan.total,
  };
}

/** Keep the phone's screen on while the in-store screen is open (where the browser allows it). */
function useWakeLock() {
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> };
    const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock;
    if (!wl) return;
    let sentinel: Sentinel | null = null;
    const grab = () => { wl.request('screen').then((s) => { sentinel = s; }).catch(() => {}); };
    const onVisible = () => { if (document.visibilityState === 'visible') grab(); };
    grab();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      sentinel?.release().catch(() => {});
    };
  }, []);
}

/**
 * The in-store checklist: one tab per store, its items by department in
 * walking order, one tap to tick (ticked items sink, a second tap undoes).
 * Replaces the page until "חזרה" (the trip stays open) or "סיום קנייה".
 */
function InStore({ trip, onTrip, onClose, onEnded }: {
  trip: Trip;
  onTrip: React.Dispatch<React.SetStateAction<Trip | null>>;
  onClose: () => void;
  onEnded: () => void;
}) {
  useWakeLock();
  const [stopIdx, setStopIdx] = useState(0);
  const [error, setError] = useState(false);
  /** The row whose "לא היה" options are open, and the end-of-trip form. */
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const ticked = new Set(trip.ticked);
  const gone = new Set(trip.notThere ?? []);
  const stop = trip.stops[Math.min(stopIdx, trip.stops.length - 1)];
  // Ticked and "לא היה" items both sink to the bottom of their department.
  const groups = groupByDepartment(stop.items, new Set([...ticked, ...gone]));
  const prog = progress(trip);
  // Everything in the cart: the end sheet opens by itself and counts down, so
  // nobody has to look for "סיום קנייה". It opens each time the list becomes
  // complete (an untick and re-tick opens it again), never on a list that was already complete.
  const complete = prog.of > 0 && prog.count === prog.of;
  const wasComplete = useRef(complete);
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    if (complete && !wasComplete.current) {
      setEnding(true);
      setAuto(true);
    }
    if (!complete) setAuto(false);
    wasComplete.current = complete;
  }, [complete]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Taps not answered yet: item key → [the state it set, its sequence number].
  // Taps made without signal wait in a queue on the phone (and stay pending)
  // until they can be sent.
  const pending = useRef(new Map<string, [boolean, number]>());
  const seq = useRef(0);
  const queue = useRef<{ key: string; on: boolean; n: number }[]>([]);
  const [offline, setOffline] = useState(false);
  const saveQueue = () => {
    if (queue.current.length) lsSet(lsQueue(trip.id), JSON.stringify(queue.current));
    else lsDel(lsQueue(trip.id));
  };
  useEffect(() => {
    // Ticks left unsent from an earlier visit.
    const saved = lsJson<{ key: string; on: boolean; n: number }[]>(lsQueue(trip.id)) ?? [];
    queue.current = saved;
    for (const op of saved) {
      seq.current = Math.max(seq.current, op.n);
      pending.current.set(op.key, [op.on, op.n]);
    }
    if (saved.length) setOffline(true);
  }, [trip.id]);
  const pendingStates = () => new Map([...pending.current].map(([k, [on]]) => [k, on]));
  /** Adopt a trip from the server, keeping the taps still in flight. */
  const adopt = useCallback((t: Trip) => onTrip({ ...t, ticked: withPending(t.ticked, pendingStates()) }), [onTrip]);

  const send = (key: string, on: boolean) =>
    api<Trip>(`/trips/${trip.id}`, { method: 'PATCH', body: JSON.stringify({ tick: { key, on } }) });
  const settle = (key: string, n: number) => {
    if (pending.current.get(key)?.[1] === n) pending.current.delete(key);
  };

  /** Send the queued ticks in order; stop at the first that still can't get through. */
  const flush = useCallback(async () => {
    while (queue.current.length) {
      const op = queue.current[0];
      try {
        const res = await send(op.key, op.on);
        queue.current.shift();
        settle(op.key, op.n);
        adopt(res);
      } catch (e) {
        if (isNetworkError(e)) break;
        queue.current.shift(); // the server refused it (trip ended, item gone): drop it
        settle(op.key, op.n);
      }
      saveQueue();
    }
    setOffline(queue.current.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs and stable helpers
  }, [adopt, trip.id]);

  const tick = async (key: string) => {
    const on = !ticked.has(key);
    const n = ++seq.current;
    pending.current.set(key, [on, n]);
    onTrip((t) => t && { ...t, ticked: withPending(t.ticked, pendingStates()) });
    if (queue.current.length) {
      // Already offline: keep the order, queue behind the others.
      queue.current.push({ key, on, n });
      saveQueue();
      return void flush();
    }
    try {
      const res = await send(key, on);
      settle(key, n);
      adopt(res);
      setError(false);
    } catch (e) {
      if (isNetworkError(e)) {
        queue.current.push({ key, on, n });
        saveQueue();
        setOffline(true);
        return;
      }
      settle(key, n);
      onTrip((t) => t && { ...t, ticked: on ? t.ticked.filter((k) => k !== key) : [...new Set([...t.ticked, key])] });
      setError(true);
    }
  };

  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;

  // Shopping together: while this screen is open and in view, read the trip
  // every 5 s (others' ticks, or the trip ended elsewhere), sending queued
  // ticks first. Back online sends them at once.
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      if (stop || document.visibilityState !== 'visible') return;
      await flush();
      if (queue.current.length) return;
      try {
        const t = await api<Trip>(`/trips/${trip.id}`);
        if (stop) return;
        if (t.endedAt) return endedRef.current();
        adopt(t);
      } catch (e) {
        if (!isNetworkError(e) && !stop) endedRef.current(); // 404: ended and gone, or no longer visible
      }
    };
    const timer = window.setInterval(poll, 5000);
    const onOnline = () => { void poll(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onOnline);
    return () => {
      stop = true;
      window.clearInterval(timer);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onOnline);
    };
  }, [trip.id, flush, adopt]);
  /** A change other than a tick ("לא היה", swap, move, +1): needs a connection, applied from the server's answer. */
  const change = async (body: Record<string, unknown>) => {
    try {
      adopt(await api<Trip>(`/trips/${trip.id}`, { method: 'PATCH', body: JSON.stringify(body) }));
      setMenuFor(null);
      setError(false);
    } catch {
      setError(true);
    }
  };
  const end = async () => {
    try {
      await api(`/trips/${trip.id}`, { method: 'PATCH', body: JSON.stringify({ end: true }) });
      onEnded();
    } catch {
      setError(true);
    }
  };

  return (
    <div className="sh-instore" role="dialog" aria-modal="true" aria-label="בחנות">
      <header className="sh-instore-head">
        <button type="button" className="sh-icon-btn" onClick={onClose} aria-label="חזרה לרשימה"><FaArrowRight /></button>
        <div className="sh-instore-title">
          <b>{trip.stops.length > 1 ? 'הכי זול' : stop.storeName}</b>
          <small>{ils(prog.done)} מתוך {ils(prog.total)} · {prog.count}/{prog.of}</small>
        </div>
        <button type="button" className="sh-btn sh-btn--ghost" onClick={() => { setAuto(false); setEnding(true); }}>סיום קנייה</button>
      </header>
      <div className="sh-instore-bar" aria-hidden><span style={{ width: `${prog.of ? (100 * prog.count) / prog.of : 0}%` }} /></div>
      {trip.stops.length > 1 && (
        <div className="sh-seg sh-instore-tabs" role="tablist">
          {trip.stops.map((st, i) => {
            const left = st.items.filter((it) => !ticked.has(it.key)).length;
            return (
              <button key={st.store} type="button" role="tab" aria-selected={i === stopIdx} className={i === stopIdx ? 'is-on' : ''}
                onClick={() => setStopIdx(i)}>
                {st.storeName.split(' ').slice(0, 2).join(' ')} <small>{left ? left : '✓'}</small>
              </button>
            );
          })}
        </div>
      )}
      {offline && <p className="sh-instore-offline" role="status">אין חיבור. הסימונים נשמרים בטלפון וישלחו כשהחיבור יחזור.</p>}
      {error && !offline && <p className="sh-error sh-instore-error">השינוי לא נשמר. נסו שוב.</p>}
      <div className="sh-instore-body">
        {trip.stops.length > 1 && <p className="sh-instore-store">{stop.storeName}</p>}
        {groups.map((g) => (
          <section key={g.id} className="sh-dept">
            <h3>{g.name} <small>{g.left || '✓'}</small></h3>
            <ul>
              {g.items.map((it) => {
                const done = ticked.has(it.key);
                const missing = gone.has(it.key);
                const nudge = !done && !missing ? dealNudge(it) : null;
                return (
                  <li key={it.key} className={`sh-tick-row ${missing ? 'is-gone' : ''}`}>
                    <button type="button" className={`sh-tick ${done ? 'is-done' : ''}`} onClick={() => tick(it.key)} aria-pressed={done} disabled={missing}>
                      <span className="sh-tick-box" aria-hidden>{done && <FaCheck />}</span>
                      <Thumb src={it.img} size={40} by={it.imgBy} />
                      <span className="sh-tick-name">{it.name}<small>{missing ? 'לא היה' : qtyLabel(it.qty, it.w)}</small></span>
                      <span className="sh-tick-cost">{ils(it.cost)}</span>
                    </button>
                    {!done && (
                      <button type="button" className="sh-icon-btn sh-tick-more" onClick={() => setMenuFor(menuFor === it.key ? null : it.key)}
                        aria-expanded={menuFor === it.key} aria-label={`לא היה, או אפשרויות: ${it.name}`}><FaEllipsisH /></button>
                    )}
                    {nudge && (
                      <p className="sh-nudge">
                        <span>מבצע {nudge.text}: יש לך {it.qty}, להוסיף עוד {nudge.add === 1 ? 'אחד' : nudge.add}?</span>
                        <button type="button" className="sh-btn sh-btn--ghost" onClick={() => change({ qty: { key: it.key, qty: it.qty + nudge.add } })}>+{nudge.add}</button>
                      </p>
                    )}
                    {menuFor === it.key && (
                      <NotThere item={it} stop={stop} trip={trip} missing={missing} onChange={change} />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {trip.missing.length > 0 && stopIdx === trip.stops.length - 1 && (
          <p className="sh-instore-missing">לא בתוכנית: {trip.missing.map((m) => m.name).join(', ')}</p>
        )}
        {stop.items.some((i) => i.img && i.imgBy === 'off') && (
          <p className="sh-credit">חלק מהתמונות: Open Food Facts, ברישיון CC BY-SA.</p>
        )}
      </div>
      {ending && <EndTrip auto={auto && complete} onEnd={end} onCancel={() => { setEnding(false); setAuto(false); }} />}
    </div>
  );
}

/**
 * "לא היה": the cheapest similar items in the same department at this store
 * (tap one to swap it in), another stop of the plan, or skip the item.
 */
function NotThere({ item, stop, trip, missing, onChange }: {
  item: TripItem;
  stop: Trip['stops'][number];
  trip: Trip;
  missing: boolean;
  onChange: (body: Record<string, unknown>) => void;
}) {
  const [alts, setAlts] = useState<{ key: string; name: string; w: boolean; img: string | null; d: string | null; price: number }[] | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`${SHOPPING_API_PATH}/alternatives?key=${encodeURIComponent(item.key)}&store=${stop.store}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then(setAlts)
      .catch(() => setAlts([]));
    return () => ctl.abort();
  }, [item.key, stop.store]);
  const onTrip = new Set(trip.stops.flatMap((s) => s.items.map((i) => i.key)));
  const others = trip.stops.filter((s) => s.store !== stop.store);
  return (
    <div className="sh-notthere">
      {missing ? (
        <button type="button" className="sh-btn sh-btn--ghost" onClick={() => onChange({ notThere: { key: item.key, on: false } })}>בכל זאת היה</button>
      ) : (
        <>
          <p className="sh-notthere-title">לא היה כאן? במקום:</p>
          {alts === null && <p className="sh-muted">מחפש דומים…</p>}
          {alts?.filter((a) => !onTrip.has(a.key)).map((a) => (
            <button key={a.key} type="button" className="sh-alt" onClick={() => onChange({
              // Same kind (both by weight, or both units): same quantity; otherwise one unit, or 1 kg.
              replace: { key: item.key, item: (() => {
                const qty = a.w === item.w ? item.qty : 1;
                return { key: a.key, name: a.name, qty, w: a.w, cost: Math.round(a.price * qty), d: a.d, img: a.img };
              })() },
            })}>
              <Thumb src={a.img} size={32} />
              <span>{a.name}</span>
              <b>{ils(a.price)}</b>
            </button>
          ))}
          {alts?.length === 0 && <p className="sh-muted">לא מצאנו מוצר דומה בחנות הזאת.</p>}
          {others.map((o) => (
            <button key={o.store} type="button" className="sh-btn sh-btn--ghost" onClick={() => onChange({ move: { key: item.key, toStore: o.store } })}>
              לקנות ב{o.storeName}
            </button>
          ))}
          <button type="button" className="sh-btn sh-btn--ghost" onClick={() => onChange({ notThere: { key: item.key, on: true } })}>לדלג, לא היה</button>
        </>
      )}
    </div>
  );
}

/** Seconds the end sheet waits, once everything is ticked, before it closes the trip. */
const AUTO_END_SECONDS = 4;

/**
 * End of trip: one confirmation (a stray tap would close it for everyone on
 * the trip). With `auto` (the last item just got ticked) it ends by itself
 * after a short countdown; "עוד לא" stops it.
 */
function EndTrip({ auto, onEnd, onCancel }: { auto: boolean; onEnd: () => void; onCancel: () => void }) {
  const [left, setLeft] = useState(AUTO_END_SECONDS);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    if (!auto) return;
    setLeft(AUTO_END_SECONDS);
    let n = AUTO_END_SECONDS;
    const timer = window.setInterval(() => {
      n -= 1;
      setLeft(n);
      if (n <= 0) {
        window.clearInterval(timer);
        endRef.current();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [auto]);
  return (
    <div className="sh-end" role="dialog" aria-label="סיום קנייה">
      <p className="sh-end-title">{auto ? 'הכול בעגלה!' : 'לסיים את הקנייה?'}</p>
      {auto && <p className="sh-end-count" aria-live="polite">מסיימים את הקנייה בעוד {Math.max(left, 0)}…</p>}
      <div className="sh-end-actions">
        <button type="button" className="sh-btn sh-btn--primary" onClick={onEnd}>סיום הקנייה</button>
        <button type="button" className="sh-btn sh-btn--ghost" onClick={onCancel}>עוד לא</button>
      </div>
    </div>
  );
}

/** Open Food Facts photos are CC BY-SA: credited where they're shown, with a link to the product there. */
function OffCredit({ barcode }: { barcode: string | null }) {
  return (
    <a className="sh-photo-credit" target="_blank" rel="noopener noreferrer"
      href={barcode ? `https://world.openfoodfacts.org/product/${barcode}` : 'https://world.openfoodfacts.org'}>
      תמונה: Open Food Facts, CC BY-SA
    </a>
  );
}
