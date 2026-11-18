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
import { FaMinus, FaPlus, FaTrash, FaSearch, FaChevronDown, FaTimes, FaCheck, FaBarcode, FaMapMarkerAlt, FaLocationArrow, FaShoppingCart, FaArrowRight, FaEllipsisH, FaListUl, FaStore } from 'react-icons/fa';
import { storeQueryWords } from '@/lib/shopping/here';
import { LuRefrigerator } from 'react-icons/lu';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import { CITIES } from '@/lib/shopping/cities';
import { distanceM } from '@/lib/shopping/places';
import { SHOPPING_API_PATH } from '@/lib/shopping/config';
import { MAX_FAV_STORES, normalizeQty, type ListLine, type MyItem } from '@/lib/shopping/home';
import type { ShoppingSettings } from '@/lib/shopping/api-types';
import type { CompareResponse, FarResponse, HouseholdResponse, HereStore, StoreCardData, StoresResponse, ShoppingPlan, ItemPrice, ItemResponse, ManualPriceResponse, PriceSource, PromoDetail, SearchHit, StoreInfo } from '@/lib/shopping/api-types';
import type { LineResult, Offer, PromoRef, StoreBasket } from '@/lib/shopping/pricing';
import { dealNudge, groupByDepartment, progress, withPending, type PlanKind, type Trip, type TripCreate, type TripItem } from '@/lib/shopping/trips';
import { cleanAddress, dayMonth, FavStar, ils, MultiStar, multiNote, photoBroken, qtyLabel, SaleLabel, storeName, Thumb } from './ui';
import Here from './Here';
import MyItemsSheet from './MyItems';
import { HouseholdSheet, householdAction, InviteCard, loadHousehold } from './Household';
import Missing from './Missing';
import { api, loadHome, saveHome, type HomeView } from './home-client';
import { NutritionHero, NutritionPanel, SettingsMenu } from './Nutrition';
import { useTypedPlaceholder } from './typed-placeholder';

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

/** Offline copies: My items and the list, the open trip, and each trip's unsent ticks. */
const LS_HOME_CACHE = 'shopping:home-cache';
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

/**
 * The result views: per item (each item's cheapest store), per list (the best
 * single store for the whole list), per stores (how to split the list between
 * stores), and online stores.
 */
// The scanner (and the decoder it may load) only downloads when opened.
const Scanner = dynamic(() => import('./Scanner'), { ssr: false });

/** The one shopping list, in the shape the result views take. */
type PageList = { id: string; name: string; items: ListLine[] };

const step = (w: boolean) => (w ? 0.5 : 1);
/** The search placeholder types these in turn (the first is also the static one). */
const SEARCH_PHRASES = ['חיפוש מוצר או ברקוד', 'חלב 3%', 'במבה', 'קפה טורקי', 'לחם מלא', 'עגבניות שרי', 'שוקולד פרה'];

export default function ShoppingPage() {
  /** The household's My items and its one shopping list (null until loaded). */
  const [home, setHome] = useState<HomeView | null>(null);
  /** The "מה חסר?" sheet. */
  const [missingOpen, setMissingOpen] = useState(false);
  /** The "המוצרים שלי" sheet. */
  const [myItemsOpen, setMyItemsOpen] = useState(false);
  /** "כמה יעלה לי ב…": the list at the favorite stores. */
  const [farOpen, setFarOpen] = useState(false);
  /** Invites to the caller from other households (cards above the search), and the "משק הבית" sheet. */
  const [incoming, setIncoming] = useState<HouseholdResponse['incoming']>([]);
  const [householdOpen, setHouseholdOpen] = useState(false);
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
  const placeholder = useTypedPlaceholder(SEARCH_PHRASES, !query);
  /** The product window: an item key or a scanned barcode. */
  const [product, setProduct] = useState<{ key: string; scanned: boolean } | null>(null);
  const [scanning, setScanning] = useState(false);
  /** The list's open trip, and whether its in-store screen is showing. */
  const [trip, setTrip] = useState<Trip | null>(null);
  const [inStore, setInStore] = useState(false);
  /** The "אני בסופר" screen. */
  const [here, setHere] = useState(false);
  /** The caller's preferences (the ⚙ menu); null until loaded. */
  const [settings, setSettings] = useState<ShoppingSettings | null>(null);
  useEffect(() => {
    api<ShoppingSettings>('/settings').then(setSettings).catch(() => setSettings({ nutritionHero: false, city: null }));
  }, []);
  const changeSettings = (patch: Partial<ShoppingSettings>) => {
    setSettings((s) => (s ? { ...s, ...patch } : s));
    api<ShoppingSettings>('/settings', { method: 'PUT', body: JSON.stringify(patch) })
      .then(setSettings)
      .catch(() => setToast('ההגדרה לא נשמרה. נסו שוב.'));
  };
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
  const [open, setOpen] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement>(null);

  /** The list in the shape the result views take (they predate My items). */
  const list = useMemo(() => (home ? { id: home.id, name: 'רשימת הקניות', items: home.list } : null), [home]);

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

  // ── load My items and the list ──
  useEffect(() => {
    const savedCity = lsGet(LS_CITY);
    const manual = lsGet(LS_CITY_MODE) === 'manual';
    if (manual) setCityMode('manual');
    else detectCity();
    if (savedCity && CITIES.some((c) => c.id === savedCity && c.picker !== false)) setCity(savedCity);
    loadHome()
      .then(setHome)
      .catch((e) => {
        // In the store without signal: the last copy seen on this phone, so an open trip still opens.
        const cached = isNetworkError(e) ? lsJson<HomeView>(LS_HOME_CACHE) : null;
        if (cached) {
          // A copy cached before favorites or households existed was the one household, 'home'.
          setHome({ ...cached, id: cached.id ?? 'home', members: cached.members ?? [], invites: cached.invites ?? [], favStores: cached.favStores ?? [] });
          setToast('אין חיבור. מוצגים הנתונים האחרונים מהטלפון.');
        } else {
          setLoadError(true);
        }
      });
  }, []);

  useEffect(() => lsSet(LS_CITY, city), [city]);
  useEffect(() => lsSet(LS_CITY_MODE, cityMode), [cityMode]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  // The offline copy follows every change, so a phone without signal opens what it last showed.
  useEffect(() => {
    if (home) lsSet(LS_HOME_CACHE, JSON.stringify(home));
  }, [home]);

  // ── save, debounced: the list, My items and the favorite stores each have their own timer ──
  // Saves replace the whole array, so the page must never save a copy older
  // than the server's: pending saves are sent before any server copy is
  // adopted, and the page reloads when it comes back into view or online
  // (the other phone, or a trip that ended, may have changed the list).
  type Field = 'list' | 'items' | 'favStores';
  const timers = useRef<Partial<Record<Field, ReturnType<typeof setTimeout>>>>({});
  const pendingSave = useRef<{ list?: ListLine[]; items?: MyItem[]; favStores?: number[] }>({});
  const sendSave = useCallback(async (field: Field) => {
    clearTimeout(timers.current[field]);
    const value = pendingSave.current[field];
    if (!value) return;
    delete pendingSave.current[field];
    try {
      const res = await saveHome({ [field]: value });
      // Only the looked-up photos and departments: local edits made since stay.
      setHome((h) => (h ? { ...h, meta: { ...h.meta, ...res.meta } } : res));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, []);
  const save = useCallback((field: Field, value: ListLine[] | MyItem[] | number[]) => {
    clearTimeout(timers.current[field]);
    (pendingSave.current as Record<Field, unknown>)[field] = value;
    timers.current[field] = setTimeout(() => void sendSave(field), 600);
  }, [sendSave]);
  /** Send what's waiting to be saved, now. */
  const flushSaves = useCallback(() => Promise.all([sendSave('list'), sendSave('items'), sendSave('favStores')]), [sendSave]);
  /** The server's copy, after this page's own pending saves have reached it. */
  const refreshHome = useCallback(async () => {
    await flushSaves();
    try {
      const fresh = await loadHome();
      // An edit made while loading wins: it saves after this and the next refresh syncs.
      if (pendingSave.current.list || pendingSave.current.items || pendingSave.current.favStores) return;
      setHome(fresh);
    } catch {
      /* offline: keep what's on screen */
    }
  }, [flushSaves]);
  /** Accept or decline an invite; joining swaps the whole household on the page. */
  const answerInvite = useCallback(async (id: string, accept: boolean) => {
    try {
      const h = await householdAction(accept ? { accept: id } : { decline: id });
      setIncoming(h.incoming);
      if (accept) {
        await refreshHome();
        setToast('הצטרפת למשק הבית');
      }
    } catch (e) {
      setToast((e as Error).message);
    }
  }, [refreshHome]);
  useEffect(() => {
    const onBack = () => { if (document.visibilityState === 'visible') void refreshHome(); };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('online', onBack);
    return () => {
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('online', onBack);
    };
  }, [refreshHome]);
  // The latest state, so an edit queues its save at once (not inside a state updater, which runs later).
  const homeRef = useRef(home);
  homeRef.current = home;
  const setListLines = useCallback((fn: (lines: ListLine[]) => ListLine[]) => {
    const h = homeRef.current;
    if (!h) return;
    const next = fn(h.list);
    homeRef.current = { ...h, list: next };
    setHome(homeRef.current);
    save('list', next);
  }, [save]);
  const setMyItems = useCallback((items: MyItem[]) => {
    const h = homeRef.current;
    if (!h) return;
    homeRef.current = { ...h, items };
    setHome(homeRef.current);
    save('items', items);
  }, [save]);
  /** The household's favorite stores (any city). */
  const favs = useMemo(() => new Set(home?.favStores ?? []), [home]);
  /** ☆ / ★: add or remove a favorite store; at the cap, say so and change nothing. */
  const toggleFav = useCallback((k: number) => {
    const h = homeRef.current;
    if (!h) return;
    const cur = h.favStores ?? [];
    if (!cur.includes(k) && cur.length >= MAX_FAV_STORES) return setToast('אפשר עד 10 חנויות מועדפות');
    const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
    homeRef.current = { ...h, favStores: next };
    setHome(homeRef.current);
    save('favStores', next);
  }, [save]);

  /** My items by key (the search marks the ones already saved). */
  const saved = useMemo(() => new Map(home?.items.map((i) => [i.key, i.qty]) ?? []), [home]);

  /** Search, scan and the product window save to My items. */
  const saveItem = (h: { key: string; name: string; w: boolean }) => {
    if (!home) return;
    if (saved.has(h.key)) {
      setToast(`כבר במוצרים שלי: ${h.name}`);
    } else {
      setMyItems([...home.items, { key: h.key, name: h.name, w: h.w, qty: 1, addedBy: '', addedAt: '' }]);
      setToast(`נוסף למוצרים שלי: ${h.name}`);
    }
    // Straight back to the search for the next product (unless this came from in-store mode):
    // the product window closes, the results stay, and the query is selected so typing replaces it.
    if (here) return;
    setProduct(null);
    setScanning(false);
    setHitsOpen(true);
    const input = searchRef.current;
    input?.focus({ preventScroll: true });
    input?.select();
    requestAnimationFrame(() => {
      input?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      if (document.activeElement !== input) input?.focus();
    });
  };
  /** The "מה חסר?" search: save now and wait, so the pick has a My item behind it. */
  const saveItemNow = async (h: { key: string; name: string; w: boolean }) => {
    if (!home || saved.has(h.key)) return;
    const items = [...home.items, { key: h.key, name: h.name, w: h.w, qty: 1, addedBy: '', addedAt: '' }];
    clearTimeout(timers.current.items);
    delete pendingSave.current.items;
    const res = await saveHome({ items });
    setHome((hh) => (hh ? { ...hh, items: res.items, meta: { ...hh.meta, ...res.meta } } : res));
  };
  /** In-store "+ לרשימה": straight onto the list (one more if it's there), and into My items if new. */
  const addToList = (h: { key: string; name: string; w: boolean }) => {
    setListLines((lines) =>
      lines.some((i) => i.key === h.key)
        ? lines.map((i) => (i.key === h.key ? { ...i, qty: normalizeQty(i.qty + step(h.w), h.w) ?? i.qty } : i))
        : [...lines, { key: h.key, name: h.name, qty: 1, w: h.w }],
    );
    if (home && !saved.has(h.key)) setMyItems([...home.items, { key: h.key, name: h.name, w: h.w, qty: 1, addedBy: '', addedAt: '' }]);
    setToast(`נוסף לרשימה: ${h.name}`);
  };
  const stepQty = (key: string, dir: 1 | -1) =>
    setListLines((lines) =>
      lines.flatMap((i) => {
        if (i.key !== key) return [i];
        const q = normalizeQty(i.qty + dir * step(i.w), i.w);
        return q === null ? [] : [{ ...i, qty: q }];
      }),
    );
  const removeLine = (key: string) => setListLines((lines) => lines.filter((i) => i.key !== key));
  const clearList = () => {
    if (window.confirm('לנקות את הרשימה? המוצרים שלי נשארים.')) setListLines(() => []);
  };
  // A click outside the search closes its results. Clicks inside the product
  // window or the scanner don't count. What was typed stays; it just folds away.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t?.closest || t.closest('.sh-sheet-backdrop, .sh-scan')) return;
      if (!t.closest('.sh-search')) setHitsOpen(false);
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

  // ── the list's open trip ──
  // The household's id: the trips' listId, and the key of the trip kept on the phone.
  const homeId = home?.id ?? null;
  useEffect(() => {
    if (!homeId) return;
    loadHousehold().then((h) => setIncoming(h.incoming)).catch(() => {});
  }, [homeId]);
  useEffect(() => {
    if (!homeId) return;
    let live = true;
    api<Trip | null>('/trips')
      .then((t) => { if (live) setTrip(t); })
      .catch((e) => { if (live && isNetworkError(e)) setTrip(lsJson<Trip>(lsTrip(homeId))); });
    return () => { live = false; };
  }, [homeId]);

  useEffect(() => {
    if (!homeId) return;
    if (trip && !trip.endedAt) lsSet(lsTrip(homeId), JSON.stringify(trip));
    else lsDel(lsTrip(homeId));
  }, [trip, homeId]);

  // Opening the trip takes on what the list gained since it started (a "מה חסר?"
  // after "יוצאים לקניות"): the server places each new line at its cheapest stop.
  const tripId = trip && !trip.endedAt ? trip.id : null;
  useEffect(() => {
    if (!inStore || !tripId) return;
    let live = true;
    (async () => {
      await flushSaves();
      const t = await api<Trip>(`/trips/${tripId}`, { method: 'PATCH', body: JSON.stringify({ sync: true }) });
      if (live) setTrip(t);
    })().catch(() => { /* offline: the trip as it was */ });
    return () => { live = false; };
  }, [inStore, tripId, flushSaves]);

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
        <header className="sh-home-head">
          <h1 className="sh-logo">כיף לי <span>בסופר</span></h1>
        </header>
        {incoming.map((inv) => <InviteCard key={inv.id} invite={inv} onAnswer={(accept) => answerInvite(inv.id, accept)} />)}

        {loadError && <p className="sh-error">לא הצלחנו לטעון את המוצרים והרשימה. נסו לרענן.</p>}
        {!home && !loadError && <div className="sh-skeleton" aria-label="טוען" />}

        {home && list && (
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
            <section className="sh-search">
              <label className="sh-search-box">
                <FaSearch aria-hidden />
                <input ref={searchRef} type="search" value={query}
                  onChange={(e) => { setQuery(e.target.value); setHitsOpen(true); }} onFocus={() => setHitsOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') clearSearch();
                    if (e.key === 'Enter' && hits?.length) saveItem(hits[0]);
                  }}
                  placeholder={placeholder} aria-label="חיפוש מוצר או ברקוד" enterKeyHint="search" autoComplete="off" />
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
                    const isSaved = saved.has(h.key);
                    return (
                      <li key={h.key} className={`sh-hit ${isSaved ? 'is-in' : ''} ${product?.key === h.key ? 'is-open' : ''}`}>
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
                        <button type="button" className="sh-hit-btn sh-hit-btn--add" onClick={() => saveItem(h)}
                          aria-label={isSaved ? `כבר במוצרים שלי: ${h.name}` : `הוספה למוצרים שלי: ${h.name}`}>
                          {isSaved ? <FaCheck aria-hidden /> : <FaPlus aria-hidden />}
                        </button>
                        {narrow && product?.key === h.key && (
                          <ProductSheet inline itemKey={h.key} scanned={false} city={city} saved={saved}
                            onSave={saveItem} onClose={() => setProduct(null)} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {saveError && <p className="sh-error">לא נשמר, נסו שוב</p>}
            <div className="sh-home-actions">
              <button type="button" className="sh-btn sh-home-btn" onClick={() => setMyItemsOpen(true)}>
                <FaListUl aria-hidden /> המוצרים שלי {home.items.length > 0 && <small>{home.items.length}</small>}
              </button>
              <button type="button" className="sh-btn sh-home-btn" onClick={() => setHere(true)}>
                <FaMapMarkerAlt aria-hidden /> אני בסופר
              </button>
            </div>
            {home.items.length > 0 && (
              <button type="button" className="sh-fridge" onClick={() => { void flushSaves(); setMissingOpen(true); }}>
                <span className="sh-fridge-handle" aria-hidden />
                <LuRefrigerator className="sh-fridge-icon" aria-hidden />
                <span className="sh-fridge-text">
                  <small>לך למקרר ותבדוק</small>
                  <b>מה חסר?</b>
                </span>
              </button>
            )}
            {itemCount > 0 && (
            <section className="sh-card" id="sh-list-body" aria-label="רשימת הקניות">
              <div className="sh-list-head">
                <h2 className="sh-h2">רשימת הקניות <small>· {itemCount}</small></h2>
                <button type="button" className="sh-btn sh-btn--ghost sh-btn--danger" onClick={clearList}><FaTrash aria-hidden /> נקה רשימה</button>
              </div>
              <ul className="sh-items">
                {list.items.map((i) => {
                  const atMin = normalizeQty(i.qty - step(i.w), i.w) === null;
                  return (
                    <li key={i.key} className="sh-item">
                      <Thumb src={home.meta[i.key]?.img ?? imgs[i.key]} size={40} by={home.meta[i.key]?.imgBy} />
                      <span className="sh-item-name">{i.name}</span>
                      <span className="sh-stepper">
                        <button type="button" onClick={() => stepQty(i.key, 1)} aria-label={`עוד ${i.name}`}><FaPlus /></button>
                        <span className="sh-qty" aria-live="polite">{i.w ? `${i.qty} ק״ג` : i.qty}</span>
                        <button type="button" onClick={() => (atMin ? removeLine(i.key) : stepQty(i.key, -1))}
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
              <button type="button" className="sh-btn sh-home-btn sh-far-open" onClick={() => setFarOpen(true)}>
                <FaStore aria-hidden /> כמה יעלה לי ב…
              </button>
            </section>
            )}

            {result && (
              <Results ref={resultsRef} result={result} list={list} updating={stale || comparing} open={open} setOpen={setOpen}
                onPricesSaved={() => compare()} onStartTrip={startTrip} tripOpen={!!trip} favs={favs} onFav={toggleFav} />
            )}
            {!result && hasItems && !compareError && <div className="sh-skeleton" aria-label="משווה מחירים" />}
            {compareError && (
              <p className="sh-error sh-retry">
                לא הצלחנו להשוות את המחירים.{' '}
                <button type="button" className="sh-link" onClick={() => setCompareError(false)}>לנסות שוב</button>
              </p>
            )}

            <footer className="sh-home-foot">
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
                  {CITIES.filter((c) => c.picker !== false).map((c) => (
                    <button key={c.id} type="button" role="radio" aria-checked={cityMode === 'manual' && city === c.id}
                      className={`sh-chip ${cityMode === 'manual' && city === c.id ? 'is-on' : ''}`} onClick={() => pickCity(c.id)}>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
              <SettingsMenu settings={settings} onChange={changeSettings} onHousehold={() => setHouseholdOpen(true)} />
            </footer>
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
          <Here city={city} listName={list?.name ?? null} onAdd={addToList} onClose={() => setHere(false)} favs={favs} onFav={toggleFav}
            onOpenItem={(key, scanned) => setProduct({ key, scanned })}
            tripStores={trip && !trip.endedAt ? Object.fromEntries(trip.stops.map((st) => [st.store, st.items.length])) : {}}
            onOpenTrip={() => { setHere(false); setInStore(true); }} />
        )}
        {product && (here || !(narrow && hits?.some((h) => h.key === product.key) && !product.scanned)) && (
          <ProductSheet itemKey={product.key} scanned={product.scanned} city={city} saved={saved}
            onSave={saveItem} onClose={() => setProduct(null)} />
        )}
        {trip && inStore && (
          <InStore trip={trip} onTrip={setTrip} onClose={() => setInStore(false)}
            onEnded={() => {
              setTrip(null);
              setInStore(false);
              setToast('הקנייה הסתיימה');
              // Ending took what was bought off the list.
              void refreshHome();
            }} />
        )}
        {myItemsOpen && home && (
          <MyItemsSheet items={home.items} meta={home.meta} onChange={setMyItems} onClose={() => setMyItemsOpen(false)}>
            {settings?.nutritionHero && home.list.length > 0 && (
              <NutritionHero lines={home.list.map((i) => ({ key: i.key, qty: i.qty, name: i.name }))} />
            )}
          </MyItemsSheet>
        )}
        {householdOpen && (
          <HouseholdSheet onClose={() => setHouseholdOpen(false)} onChanged={() => { setHouseholdOpen(false); void refreshHome(); }} />
        )}
        {farOpen && list && list.items.length > 0 && (
          <FarSheet lines={list.items} clubs={clubs} coupons={coupons} favs={favs} onFav={toggleFav}
            onClose={() => setFarOpen(false)} />
        )}
        {missingOpen && home && (
          <Missing items={home.items} list={home.list} meta={home.meta} city={city} onSaveItem={saveItemNow}
            onAdded={(h) => { setHome(h); setMissingOpen(false); setToast('נוסף לרשימה'); }} onClose={() => setMissingOpen(false)} />
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
  list: PageList;
  updating: boolean;
  open: string | null;
  setOpen: (k: string | null) => void;
  /** A manual price was saved: re-price the list. */
  onPricesSaved: () => void;
  onStartTrip: (plan: ShoppingPlan) => void;
  tripOpen: boolean;
  favs: ReadonlySet<number>;
  onFav: (k: number) => void;
}>(function Results({ result, list, updating, open, setOpen, onPricesSaved, onStartTrip, tripOpen, favs, onFav }, ref) {
  const favOf = (k: number) => ({ on: favs.has(k), toggle: () => onFav(k) });
  const full = result.physical.filter((b) => !b.missing.length);
  const best = full[0];
  const partial = result.physical.filter((b) => b.missing.length);
  const bestOnline = result.online[0];
  const toggle = (id: string) => setOpen(open === id ? null : id);
  const onlineRef = useRef<HTMLElement>(null);

  // No physical store has prices → no plans; the stores and online show straight away.
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
      {!hasPlans && (
        <div className="sh-hero is-partial">
          <span className="sh-hero-kicker">אין עדיין מחירים בחנויות שליד הבית</span>
          <span className="sh-hero-meta">
            {result.manual.length > 0
              ? <>לחנויות השכונתיות כאן אין קובץ מחירים. אפשר להקליד מחירים למטה, ובינתיים להשוות אונליין.</>
              : <>אפשר להשוות בינתיים בחנויות אונליין.</>}
          </span>
          {bestOnline && (
            <button type="button" className="sh-hero-split" onClick={() => onlineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <span>
                <b>הכי זול אונליין: {ils(bestOnline.total)}</b>
                <small>{storeName(result.stores[bestOnline.store])}{bestOnline.missing.length ? `, חסרים ${bestOnline.missing.length}` : ''}</small>
              </span>
              <FaChevronDown className="sh-hero-split-go" aria-hidden />
            </button>
          )}
          {updating && <span className="sh-updating">מעדכן…</span>}
        </div>
      )}
      {/* Every store for the whole list (one page, no tabs): full baskets, then partial, then online. */}
      {(!hasPlans || showAll) && (
        <>
          {full.length > 0 && partial.length > 0 && <h3 className="sh-group-title">יש בהן את כל המוצרים</h3>}
          {full.map((b, i) => (
            <StoreCard key={b.store} basket={b} result={result} fav={favOf(b.store)} rank={i} best={best}
              open={open === `s${b.store}`} toggle={() => toggle(`s${b.store}`)} />
          ))}
          {partial.length > 0 && <h3 className="sh-group-title">חסרים בהן מוצרים</h3>}
          {partial.map((b, i) => (
            <StoreCard key={b.store} basket={b} result={result} fav={favOf(b.store)} rank={full.length + i} best={best}
              open={open === `s${b.store}`} toggle={() => toggle(`s${b.store}`)} />
          ))}
          <section ref={onlineRef} className="sh-online">
            <h3 className="sh-group-title">אונליין</h3>
            {result.online.length
              ? result.online.map((b, i) => (
                <StoreCard key={b.store} basket={b} result={result} fav={favOf(b.store)} rank={i} best={result.online.find((x) => !x.missing.length)}
                  open={open === `o${b.store}`} toggle={() => toggle(`o${b.store}`)} />
              ))
              : <p className="sh-empty">אין חנויות אונליין עם מחירים.</p>}
          </section>
        </>
      )}
      {result.manual.length > 0 && (
        <ManualStores key={`m-${result.city}`} baskets={result.manual} result={result} list={list} onSaved={onPricesSaved}
          startOpen={!hasPlans} />
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

function StoreCard({ basket, result, rank, best, open, toggle, fav }: {
  basket: StoreBasket;
  result: StoreCardData;
  rank: number;
  best: StoreBasket | undefined;
  open: boolean;
  toggle: () => void;
  /** The ☆ / ★ for this store. */
  fav?: { on: boolean; toggle: () => void };
}) {
  const store = result.stores[basket.store];
  const saved = basket.regularTotal - basket.total;
  const isBest = basket === best;
  const more = best && !isBest && !basket.missing.length ? basket.total - best.total : 0;
  const address = cleanAddress(store.address);
  return (
    <article className={`sh-card sh-store ${isBest ? 'is-best' : ''}`}>
      <div className="sh-store-top">
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
      {fav && <FavStar on={fav.on} name={storeName(store)} onToggle={fav.toggle} />}
      </div>
      {open && <Breakdown basket={basket} result={result} />}
    </article>
  );
}

function Breakdown({ basket, result, onlyAvailable }: { basket: StoreBasket; result: StoreCardData; onlyAvailable?: boolean }) {
  // Missing items last: what you can buy here first.
  const lines = [...basket.lines].filter((l) => !onlyAvailable || l.available).sort((a, b) => Number(b.available) - Number(a.available));
  return (
    <ul className="sh-lines">
      {lines.map((l) => <Line key={l.key} line={l} result={result} store={basket.store} />)}
    </ul>
  );
}

function Line({ line, result, store }: { line: LineResult; result: StoreCardData; store: number }) {
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

// ── product photos ──

// ── "כמה יעלה לי ב…": the list at the favorite stores ──

/**
 * The shopping list priced at each favorite store, whatever its city, ranked
 * like the store list; ★ removes one, and the search below (always open) adds any priced
 * store. The favorites go with the request, so a star counts before it's saved.
 */
function FarSheet({ lines, clubs, coupons, favs, onFav, onClose }: {
  lines: ListLine[];
  clubs: boolean;
  coupons: boolean;
  favs: ReadonlySet<number>;
  onFav: (k: number) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<FarResponse | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<HereStore[] | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const favKey = [...favs].join(',');
  const sig = JSON.stringify(lines.map((l) => [l.key, l.qty]));
  useEffect(() => {
    let live = true;
    setError(false);
    (async () => {
      const res = await api<FarResponse>('/far', {
        method: 'POST',
        body: JSON.stringify({ stores: favKey ? favKey.split(',').map(Number) : [], clubs, coupons, lines: JSON.parse(sig).map(([key, qty]: [string, number]) => ({ key, qty })) }),
      });
      if (live) setData(res);
    })().catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [favKey, sig, clubs, coupons, reload]);

  useEffect(() => {
    if (!storeQueryWords(q).length) return setFound(null);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`${SHOPPING_API_PATH}/stores?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : null)).then((r: StoresResponse | null) => r && setFound(r.stores)).catch(() => {});
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const none = favs.size === 0;
  const best = data?.baskets.find((b) => !b.missing.length);
  const cityOfStore = (s: HereStore) => CITIES.find((c) => c.id === s.city)?.name ?? (s.kind === 'online' ? 'אונליין' : '');
  return (
    <div className="sh-sheet-backdrop" onClick={onClose}>
      <div className="sh-sheet sh-far" role="dialog" aria-modal="true" aria-labelledby="sh-far-title" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} type="button" className="sh-icon-btn sh-sheet-close" onClick={onClose} aria-label="סגירה"><FaTimes /></button>
        <h2 id="sh-far-title" className="sh-h2">כמה יעלה לי ב…</h2>
        {error && <p className="sh-error">לא הצלחנו לטעון. <button type="button" className="sh-link" onClick={() => setReload((n) => n + 1)}>לנסות שוב</button></p>}
        {none && <p className="sh-empty">עוד אין חנויות מועדפות. חפשו חנות וסמנו ☆.</p>}
        {!none && !data && !error && <div className="sh-skeleton" aria-label="טוען" />}
        {!none && data && data.baskets.map((b, i) => (
          <StoreCard key={b.store} basket={b} result={data} rank={i} best={best} open={open === b.store}
            toggle={() => setOpen(open === b.store ? null : b.store)} fav={{ on: favs.has(b.store), toggle: () => onFav(b.store) }} />
        ))}
        <section className="sh-far-add">
            <label className="sh-search-box">
              <FaSearch aria-hidden />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="הוסף רשת, סניף או עיר"
                aria-label="חיפוש חנות להוספה" autoComplete="off" />
            </label>
            {found && !found.length && <p className="sh-empty">לא נמצאה חנות.</p>}
            {found && found.length > 0 && (
              <ul className="sh-here-stores">
                {found.map((s) => (
                  <li key={s.k} className="sh-here-store-row">
                    <span className="sh-tick-name sh-far-found">
                      <span>{s.chainName} <span className="sh-branch">{s.name}</span></span>
                      <small>{[cityOfStore(s), cleanAddress(s.address)].filter(Boolean).join(' · ')}</small>
                    </span>
                    <FavStar on={favs.has(s.k)} name={storeName(s)} onToggle={() => onFav(s.k)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
      </div>
    </div>
  );
}

// ── stores priced by hand ──

/** Manual stores listed before "show all". */
const MANUAL_SHOWN = 5;

function ManualStores({ baskets, result, list, onSaved, startOpen }: {
  baskets: StoreBasket[];
  result: CompareResponse;
  list: PageList;
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
  list: PageList;
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

function ProductSheet({ itemKey, scanned, city, saved, onSave, onClose, inline }: {
  itemKey: string;
  /** Under its search result (phone) instead of a window over the page. */
  inline?: boolean;
  /** It came from the camera: say "barcode not found" rather than "product not found". */
  scanned: boolean;
  city: string;
  /** My items by key: the button says when the product is already saved. */
  saved: Map<string, number>;
  onSave: (item: { key: string; name: string; w: boolean }) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<ItemResponse | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  /** The photo link that failed to load (its credit hides with it). */
  const [photoFailed, setPhotoFailed] = useState<string | null>(null);
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
  const showPhoto = !!it?.img && it.img !== photoFailed && !photoBroken(it.img);
  const isSaved = !!it && saved.has(it.key);
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
                <Thumb src={it.img} size={88} by={it.imgBy} onFail={() => setPhotoFailed(it.img)} />
                {/* The credit goes with the photo: hidden when it doesn't load. */}
                {showPhoto && it.imgBy === 'off' && <OffCredit barcode={it.barcode ? it.key : null} />}
                {showPhoto && it.imgBy === 'name' && <span className="sh-photo-credit is-plain">תמונה להמחשה</span>}
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
            <button type="button" className="sh-btn sh-btn--primary" onClick={() => onSave(it)} disabled={isSaved}>
              {isSaved ? <>במוצרים שלי ✓</> : <>+ למוצרים שלי</>}
            </button>
            <NutritionPanel item={it}
              best={data.physical[0] ? { cost: data.physical[0].cost, store: storeName(data.stores[data.physical[0].store]) } : null} />
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
    // Ending takes the ticked items off the list, so the server needs every tick first.
    await flush();
    if (queue.current.length) {
      setOffline(true); // its banner says the ticks wait for a connection; end again once they're sent
      return;
    }
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
