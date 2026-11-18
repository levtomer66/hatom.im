'use client';

// "אני בסופר" (docs/shopping-here-mode.md): pick the store you're in (nearest
// first when the phone shares its location), then see what on your lists is
// worth buying here, the deals here on things you buy, and a verdict for any
// product you scan. Read-only towards the lists apart from "+ לרשימה".
// The picker lists the stores within 10 km of you (the page's location, sent
// only to our API, never stored; else the household's home spot) with each
// store's location, sorted here. Favorite stores (☆) come first, and the
// picker's search finds a store anywhere. "Cheaper elsewhere", the search and
// the scan verdict measure the page's radius around the store, not around you.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { FaArrowRight, FaBarcode, FaChevronDown, FaLocationArrow, FaPlus, FaSearch, FaShoppingCart, FaTimes } from 'react-icons/fa';
import { SHOPPING_API_PATH } from '@/lib/shopping/config';
import { walkMinutes } from '@/lib/shopping/near';
import type { HereDealsResponse, HereResponse, HereRow, HereStore, HereStoresResponse, ItemPrice, ItemResponse, PromoDetail, SearchHit, StoreInfo, StoresResponse } from '@/lib/shopping/api-types';
import { DEPARTMENTS } from '@/lib/shopping/departments';
import {
  dealGap, distanceLabel, endsLabel, groupHere, HERE_REMEMBER_MS, inStorePickable, isTwin, mergeStores, nearbyStore, sortStores, storeQueryWords, verdict,
  type HereGroup, type LatLng,
} from '@/lib/shopping/here';
import { cleanAddress, dayMonth, FavStar, ils, MultiStar, multiNote, qtyLabel, SaleLabel, storeName, Thumb } from './ui';

const Scanner = dynamic(() => import('./Scanner'), { ssr: false });

const LS_HERE = 'shopping:here';

interface Remembered { store: number; at: number }

const readRemembered = (): number | null => {
  try {
    const r = JSON.parse(localStorage.getItem(LS_HERE) ?? 'null') as Remembered | null;
    return r && typeof r.store === 'number' && Date.now() - r.at < HERE_REMEMBER_MS ? r.store : null;
  } catch {
    return null;
  }
};
const remember = (store: number | null) => {
  try {
    if (store === null) localStorage.removeItem(LS_HERE);
    else localStorage.setItem(LS_HERE, JSON.stringify({ store, at: Date.now() } satisfies Remembered));
  } catch {
    /* private mode */
  }
};

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(SHOPPING_API_PATH + path, { signal });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

type Pos = { state: 'idle' | 'locating' | 'denied' | 'unavailable' } | { state: 'found'; at: LatLng };

const walkLabel = (s: StoreInfo | undefined) => (s?.walkMin != null ? ` (~${s.walkMin} דק׳ הליכה)` : '');

export interface HereProps {
  /** The pricing routes' location query (where.ts nearQuery): the picker's centre. */
  near: string;
  /** The page's radius chip (km): "cheaper elsewhere" looks this far around the store. */
  radius: number;
  /** Item keys on the open trip's stops, by store (to hand over to the trip's checklist). */
  tripStores: Record<number, number>;
  onOpenTrip: () => void;
  /** Open the product window for an item key or a scanned barcode. */
  onOpenItem: (key: string, scanned: boolean) => void;
  /** "+ לרשימה": adds to the list open on the page. */
  onAdd: (item: { key: string; name: string; w: boolean }) => void;
  listName: string | null;
  onClose: () => void;
  /** The household's favorite stores, and the ☆ / ★ toggle. */
  favs: ReadonlySet<number>;
  onFav: (k: number) => void;
}

export default function Here(props: HereProps) {
  const { near, onClose, favs, onFav } = props;
  const [storeKey, setStoreKey] = useState<number | null>(() => readRemembered());
  const [stores, setStores] = useState<HereStore[] | null>(null);
  const [storesError, setStoresError] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.sh-sheet-backdrop, .sh-scan')) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    const ctl = new AbortController();
    setStores(null);
    setStoresError(false);
    getJson<HereStoresResponse>(`/here/stores?${near}`, ctl.signal)
      .then((r) => setStores(r.stores))
      .catch(() => { if (!ctl.signal.aborted) setStoresError(true); });
    return () => ctl.abort();
  }, [near]);

  // Favorites wherever they are (the list above holds only the nearby ones); reloaded when one is starred.
  const [favStores, setFavStores] = useState<HereStore[]>([]);
  const favKey = [...favs].join(',');
  useEffect(() => {
    const ctl = new AbortController();
    getJson<StoresResponse>('/stores', ctl.signal).then((r) => setFavStores(inStorePickable(r.stores))).catch(() => {});
    return () => ctl.abort();
  }, [favKey]);
  /** A store picked from the search, farther away (not in the lists above). */
  const [picked, setPicked] = useState<HereStore | null>(null);
  const all = useMemo(() => mergeStores(stores ?? [], favStores, picked ? [picked] : []), [stores, favStores, picked]);

  const choose = (s: HereStore | null) => {
    remember(s?.k ?? null);
    if (s) setPicked(s);
    setStoreKey(s?.k ?? null);
  };

  const store = all.find((s) => s.k === storeKey) ?? null;
  return (
    <div className="sh-instore sh-here" role="dialog" aria-modal="true" aria-label="אני בסופר">
      {store ? (
        <StoreView {...props} store={store} onChangeStore={() => choose(null)} />
      ) : (
        <Picker stores={stores ? mergeStores(stores, favStores) : null} favs={favs} onFav={onFav}
          error={storesError} onPick={choose} onClose={onClose} />
      )}
    </div>
  );
}

// ── picking the store ──

function Picker({ stores, favs, onFav, error, onPick, onClose }: {
  /** The stores near you plus the favorites, wherever they are. */
  stores: HereStore[] | null;
  favs: ReadonlySet<number>;
  onFav: (k: number) => void;
  error: boolean;
  onPick: (s: HereStore) => void;
  onClose: () => void;
}) {
  const [pos, setPos] = useState<Pos>({ state: 'idle' });
  const [filter, setFilter] = useState('');
  /** The search's matches anywhere (null until it has 2+ letters). */
  const [found, setFound] = useState<HereStore[] | null>(null);
  useEffect(() => {
    if (!storeQueryWords(filter).length) return setFound(null);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      getJson<StoresResponse>(`/stores?q=${encodeURIComponent(filter.trim())}`, ctl.signal)
        .then((r) => setFound(inStorePickable(r.stores))).catch(() => {});
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [filter]);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return setPos({ state: 'unavailable' });
    setPos({ state: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ state: 'found', at: { lat: p.coords.latitude, lng: p.coords.longitude } }),
      (err) => setPos({ state: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, []);
  useEffect(() => { locate(); }, [locate]);

  const me = pos.state === 'found' ? pos.at : null;
  const sorted = useMemo(() => (stores ? sortStores(stores, me, favs) : []), [stores, me, favs]);
  const near = nearbyStore(sorted);
  const anyLoc = stores?.some((s) => s.loc) ?? false;
  const q = filter.trim();
  const shown = useMemo(() => {
    if (!q) return sorted;
    const local = sorted.filter((s) => `${s.chainName} ${s.name} ${cleanAddress(s.address)}`.includes(q));
    return sortStores(mergeStores(local, found ?? []), me, favs);
  }, [q, sorted, found, me, favs]);

  const note =
    pos.state === 'locating' ? 'מאתר מיקום…'
      : pos.state === 'found' ? (anyLoc ? 'לפי המרחק ממך' : 'אין עדיין מיקום לחנויות. לפי זמן ההליכה מהבית')
        : pos.state === 'denied' ? 'בלי גישה למיקום. לפי זמן ההליכה מהבית'
          : pos.state === 'unavailable' ? 'המיקום לא זמין. לפי זמן ההליכה מהבית' : '';

  return (
    <>
      <header className="sh-instore-head">
        <button type="button" className="sh-icon-btn" onClick={onClose} aria-label="סגירה"><FaTimes /></button>
        <div className="sh-instore-title">
          <b>באיזו חנות את/ה?</b>
          <small>{note}</small>
        </div>
        {pos.state !== 'locating' && pos.state !== 'found' && (
          <button type="button" className="sh-btn sh-btn--ghost" onClick={locate}><FaLocationArrow aria-hidden /> מיקום</button>
        )}
      </header>
      <div className="sh-instore-body">
        {near && !q && (
          <button type="button" className="sh-resume sh-here-near" onClick={() => onPick(near)}>
            <FaLocationArrow aria-hidden />
            <span>
              <b>נראה שאת/ה ב{storeName(near)}</b>
              <small>{distanceLabel(near.distM!)} ממך</small>
            </span>
            <span className="sh-resume-go">נכון</span>
          </button>
        )}
        {stores && (
          <label className="sh-search-box sh-here-filter">
            <FaSearch aria-hidden />
            <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder="חיפוש חנות, גם רחוקה" aria-label="חיפוש חנות" autoComplete="off" />
          </label>
        )}
        {error && <p className="sh-error">לא הצלחנו לטעון את החנויות. נסו שוב.</p>}
        {!stores && !error && <div className="sh-skeleton" aria-label="טוען" />}
        {stores && !stores.length && <p className="sh-empty">אין לנו חנויות עד 10 ק״מ ממך. אפשר לחפש חנות למעלה.</p>}
        <ul className="sh-here-stores">
          {shown.map((s, i) => (
            <li key={s.k} className="sh-here-store-li">
              {!s.priced && (i === 0 || shown[i - 1].priced) && <p className="sh-here-unpriced">חנויות שאין לנו מחירים מהן</p>}
              <div className="sh-here-store-row">
              <button type="button" className="sh-here-store" onClick={() => onPick(s)}>
                <span className="sh-tick-name">
                  <span>{s.chainName} <span className="sh-branch">{s.name}</span></span>
                  {cleanAddress(s.address) && <small>{cleanAddress(s.address)}</small>}
                </span>
                <span className="sh-here-dist">
                  {s.distM !== null ? `${distanceLabel(s.distM)} · ~${walkMinutes(s.distM)} דק׳` : ''}
                  {!s.priced ? <small>אין מחירים</small> : s.source === 'manual' ? <small>מחירים ידניים</small> : null}
                </span>
              </button>
              {s.priced && <FavStar on={favs.has(s.k)} name={storeName(s)} onToggle={() => onFav(s.k)} />}
              </div>
            </li>
          ))}
        </ul>
        {q && !shown.length && <p className="sh-empty">לא נמצאה חנות.</p>}
      </div>
    </>
  );
}

// ── in the store ──

type Tab = 'worth' | 'deals';

const GROUP_TITLE: Record<HereGroup, string> = {
  best: 'הכי זול כאן',
  ok: 'סביר: זול יותר במקום אחר, לא שווה הליכה',
  elsewhere: 'עדיף במקום אחר',
  missing: 'אין כאן',
};

function StoreView({ store, near: userNear, radius, tripStores, onOpenTrip, onOpenItem, onAdd, listName, onClose, onChangeStore }: HereProps & {
  store: HereStore;
  onChangeStore: () => void;
}) {
  // Search, scan and "cheaper elsewhere" look around this store (else around you, for a store with no point).
  const near = store.loc ? `lat=${store.loc.lat}&lng=${store.loc.lng}&r=${radius}` : userNear;
  const [data, setData] = useState<HereResponse | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>('worth');
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  /** The store's other deals, loaded when the deals tab first opens. */
  const [allDeals, setAllDeals] = useState<HereDealsResponse | null>(null);
  const [allDealsError, setAllDealsError] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    setError(false);
    getJson<HereResponse>(`/here?store=${store.k}&r=${radius}`, ctl.signal)
      .then(setData)
      .catch(() => { if (!ctl.signal.aborted) setError(true); });
    return () => ctl.abort();
  }, [store.k, radius, reload]);

  useEffect(() => {
    if (tab !== 'deals' || allDeals) return;
    const ctl = new AbortController();
    setAllDealsError(false);
    getJson<HereDealsResponse>(`/here/deals?store=${store.k}`, ctl.signal)
      .then(setAllDeals)
      .catch(() => { if (!ctl.signal.aborted) setAllDealsError(true); });
    return () => ctl.abort();
  }, [tab, allDeals, store.k]);

  const rows = useMemo(
    () => data?.rows ?? [],
    [data],
  );
  // The tab counts what to buy here: the cheapest, and "סביר" (not worth the walk).
  const groups = useMemo(() => groupHere(rows), [rows]);
  // The shopping list's items, then the rest of My items (each part grouped on its own).
  const listRows = useMemo(() => rows.filter((r) => r.onList), [rows]);
  const restRows = useMemo(() => rows.filter((r) => !r.onList), [rows]);
  // On a deal here: the shopping list's items first (rows already come list-first).
  const dealRows = rows.filter((r) => r.here && (r.here.applied.length || r.here.idle.length || r.here.offers.some((o) => o.reason !== 'unclear')));
  const onTrip = tripStores[store.k] ?? 0;
  // The store's other deals: not My items or the past trips' (shown above them).
  const otherDeals = useMemo(() => {
    if (!allDeals || !data) return null;
    const shown = new Set([...data.rows.map((r) => r.key), ...data.before.map((d) => d.key)]);
    return allDeals.deals.filter((d) => !shown.has(d.key));
  }, [allDeals, data]);

  return (
    <>
      <header className="sh-instore-head">
        <button type="button" className="sh-icon-btn" onClick={onChangeStore} aria-label="החלפת חנות"><FaArrowRight /></button>
        <div className="sh-instore-title">
          <b>{storeName(store)}</b>
          <small>{store.pricesAt ? `מחירים מ־${dayMonth(store.pricesAt)} ${store.pricesAt.slice(11, 16)}` : store.source === 'manual' ? 'מחירים שהוזנו ידנית' : 'אין מחירים'}</small>
        </div>
        <button type="button" className="sh-icon-btn" onClick={onClose} aria-label="סגירה"><FaTimes /></button>
      </header>
      <div className="sh-seg sh-instore-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'worth'} className={tab === 'worth' ? 'is-on' : ''} onClick={() => setTab('worth')}>
          כדאי כאן {data && <small>{groups.best.length + groups.ok.length}</small>}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'deals'} className={tab === 'deals' ? 'is-on' : ''} onClick={() => setTab('deals')}>
          מבצעים {data && <small>{dealRows.length + data.before.length + (otherDeals?.length ?? 0)}</small>}
        </button>
      </div>
      <div className="sh-instore-body sh-here-body">
        {onTrip > 0 && (
          <button type="button" className="sh-resume" onClick={onOpenTrip}>
            <FaShoppingCart aria-hidden />
            <span><b>יש קנייה פתוחה עם {onTrip} מוצרים כאן</b><small>לרשימת הקנייה</small></span>
            <span className="sh-resume-go">להמשיך</span>
          </button>
        )}
        {error && (
          <p className="sh-error">לא הצלחנו לטעון את המחירים. <button type="button" className="sh-link" onClick={() => setReload((n) => n + 1)}>לנסות שוב</button></p>
        )}
        {!data && !error && <div className="sh-skeleton" aria-label="טוען" />}

        {data && tab === 'worth' && (
          <>
            {!rows.length && <p className="sh-empty">עוד אין מוצרים שלי. אפשר לחפש או לסרוק מוצר ולראות אם כדאי לקנות אותו כאן.</p>}
            {listRows.length > 0 ? (
              <>
                <h2 className="sh-here-part">רשימת הקניות <small>{listRows.length}</small></h2>
                <WorthGroups rows={listRows} data={data} onOpen={(key) => onOpenItem(key, false)} />
                {restRows.length > 0 && (
                  <>
                    <h2 className="sh-here-part">עוד מהמוצרים שלי <small>{restRows.length}</small></h2>
                    <WorthGroups rows={restRows} data={data} onOpen={(key) => onOpenItem(key, false)} />
                  </>
                )}
              </>
            ) : (
              <WorthGroups rows={restRows} data={data} onOpen={(key) => onOpenItem(key, false)} />
            )}
          </>
        )}

        {data && tab === 'deals' && (
          <>
            <section className="sh-dept">
              <h3>במוצרים שלי <small>{dealRows.length}</small></h3>
              {!dealRows.length && <p className="sh-empty">אין כאן מבצע על המוצרים שלי.</p>}
              <ul>{dealRows.map((r) => <DealRow key={r.key} itemKey={r.key} price={r.here!} qty={r.qty} onList={r.onList} data={data} onOpen={() => onOpenItem(r.key, false)} />)}</ul>
            </section>
            <section className="sh-dept">
              <h3>קנית בעבר <small>{data.before.length}</small></h3>
              {!data.before.length && <p className="sh-empty">אין כאן מבצע על מה שקנית בקניות האחרונות.</p>}
              <ul>
                {data.before.map((d) => (
                  <DealRow key={d.key} itemKey={d.key} price={d.here} qty={null} data={data} onOpen={() => onOpenItem(d.key, false)}
                    onAdd={() => { const it = data.items[d.key]; if (it) onAdd({ key: d.key, name: it.name, w: it.w }); }} listName={listName} />
                ))}
              </ul>
            </section>
            <OtherDeals deals={otherDeals} data={allDeals} error={allDealsError} onOpen={(key) => onOpenItem(key, false)}
              onAdd={onAdd} listName={listName} />
          </>
        )}
        {data && Object.values(data.items).some((i) => i.img && i.imgBy === 'off') && (
          <p className="sh-credit">חלק מהתמונות: Open Food Facts, ברישיון CC BY-SA.</p>
        )}
      </div>
      <FindBar near={near} onScan={() => setScanning(true)} onPick={setScanned} />
      {scanning && (
        <Scanner onClose={() => setScanning(false)} onCode={(code) => { setScanning(false); setScanned(code); }} />
      )}
      {scanned && (
        <Verdict code={scanned} store={store} near={near} rows={data?.rows ?? []} listName={listName}
          onAdd={onAdd} onDetails={(key) => onOpenItem(key, true)} onClose={() => setScanned(null)}
          onScanAgain={() => { setScanned(null); setScanning(true); }} />
      )}
    </>
  );
}

/** A deal's price for one unit: whole units split evenly; weighted deals are already per kg. */
const perUnit = (cost: number, qty: number, w?: boolean) => (w || qty <= 1 ? cost : Math.round(cost / qty));

/** Rows of "all deals here" shown at first, and per "עוד". */
const DEALS_PAGE = 30;

/** "עוד מבצעים בסניף": the store's other deals, biggest share saved first, by department. */
function OtherDeals({ deals, data, error, onOpen, onAdd, listName }: {
  deals: HereDealsResponse['deals'] | null;
  data: HereDealsResponse | null;
  error: boolean;
  onOpen: (key: string) => void;
  onAdd: HereProps['onAdd'];
  listName: string | null;
}) {
  const [dept, setDept] = useState<string | null>(null);
  const [shown, setShown] = useState(DEALS_PAGE);
  const depts = useMemo(() => {
    if (!deals || !data) return [];
    const have = new Set(deals.map((d) => data.items[d.key]?.d ?? 'other'));
    return [...DEPARTMENTS.filter((d) => have.has(d.id)), ...(have.has('other') ? [{ id: 'other', name: 'אחר' }] : [])];
  }, [deals, data]);
  const list = deals && data ? deals.filter((d) => !dept || (data.items[d.key]?.d ?? 'other') === dept) : [];

  return (
    <section className="sh-dept">
      <h3>עוד מבצעים בסניף {deals && <small>{deals.length}{data?.more ? '+' : ''}</small>}</h3>
      {error && <p className="sh-error">לא הצלחנו לטעון את המבצעים.</p>}
      {!deals && !error && <div className="sh-skeleton sh-here-deals-skel" aria-label="טוען" />}
      {deals && !deals.length && <p className="sh-empty">אין עוד מבצעים בסניף הזה.</p>}
      {depts.length > 1 && (
        <nav className="sh-scroller sh-here-lists" aria-label="מחלקות">
          <button type="button" className={`sh-chip ${!dept ? 'is-on' : ''}`} aria-pressed={!dept} onClick={() => { setDept(null); setShown(DEALS_PAGE); }}>הכול</button>
          {depts.map((d) => (
            <button key={d.id} type="button" className={`sh-chip ${dept === d.id ? 'is-on' : ''}`} aria-pressed={dept === d.id}
              onClick={() => { setDept(dept === d.id ? null : d.id); setShown(DEALS_PAGE); }}>{d.name}</button>
          ))}
        </nav>
      )}
      {data && (
        <ul>
          {list.slice(0, shown).map((d) => {
            const it = data.items[d.key];
            const p = data.promos[d.promo];
            const multi = !it?.w && d.qty > 1;
            return (
              <li key={d.key} className="sh-here-deal">
                <button type="button" className="sh-tick sh-here-row" onClick={() => onOpen(d.key)}>
                  <Thumb src={it?.img} size={40} by={it?.imgBy} />
                  <span className="sh-tick-name">
                    <span>{it?.name ?? d.key}</span>
                    <small className={d.club || d.coupon ? 'sh-promo is-offer' : 'sh-promo'}>
                      {p?.description ?? 'מבצע'} · {endsLabel(d.end, data.now)}
                      {d.club && ` · ${p?.clubName ? `לחברי ${p.clubName}` : 'מועדון'}`}{d.coupon && ' · בקופון'}
                    </small>
                  </span>
                  {/* Per unit, as the product view shows it: "2 ב-10" on ₪23.90 is ₪5*, the terms on hover. */}
                  <span className="sh-here-price"
                    title={multi ? multiNote({ qty: d.qty, unit: perUnit(d.cost, d.qty), total: d.cost }) : undefined}>
                    <span className="sh-here-pct" dir="ltr">−{Math.round(d.pct * 100)}%</span>
                    <b>{ils(perUnit(d.cost, d.qty, it?.w))}{multi && <MultiStar />}</b>
                    <s>{ils(perUnit(d.regularCost, d.qty, it?.w))}</s>
                    {it?.w && <small className="sh-muted">לק״ג</small>}
                  </span>
                </button>
                <button type="button" className="sh-icon-btn sh-here-add" onClick={() => it && onAdd({ key: d.key, name: it.name, w: it.w })}
                  aria-label={`הוספה ל${listName ? `"${listName}"` : 'רשימה'}: ${it?.name ?? d.key}`}><FaPlus /></button>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > shown && (
        <button type="button" className="sh-btn sh-here-more" onClick={() => setShown(shown + DEALS_PAGE)}>
          עוד {Math.min(DEALS_PAGE, list.length - shown)} מבצעים
        </button>
      )}
    </section>
  );
}

/**
 * The bar at the bottom: type a product name (the main page's search) or a
 * barcode, or open the camera. Picking a result shows its verdict here.
 */
function FindBar({ near, onScan, onPick }: { near: string; onScan: () => void; onPick: (key: string) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setHits(null);
      return;
    }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        setHits(await getJson<SearchHit[]>(`/search?q=${encodeURIComponent(t)}&${near}`, ctl.signal));
      } catch {
        /* aborted or offline */
      } finally {
        if (!ctl.signal.aborted) setBusy(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [q, near]);

  const pick = (key: string) => {
    setQ('');
    setHits(null);
    (document.activeElement as HTMLElement | null)?.blur();
    onPick(key);
  };

  return (
    <div className="sh-here-find">
      {hits && (
        <ul className="sh-hits sh-here-hits" role="listbox" aria-label="תוצאות">
          {!busy && !hits.length && <li className="sh-muted sh-hits-empty">לא נמצאו מוצרים</li>}
          {hits.map((h) => (
            <li key={h.key}>
              <button type="button" className="sh-here-hit" onClick={() => pick(h.key)}>
                <Thumb src={h.img} size={36} by={h.imgBy} />
                <span className="sh-tick-name">
                  <span>{h.name}</span>
                  {h.minPrice !== null && <small>{h.minPrice === h.maxPrice ? ils(h.minPrice) : `${ils(h.minPrice)}–${ils(h.maxPrice!)}`} בסביבה</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="sh-here-findrow">
        <label className="sh-search-box">
          <FaSearch aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQ('');
              if (e.key === 'Enter') {
                const t = q.trim();
                if (/^\d{8,14}$/.test(t)) pick(t);
                else if (hits?.length) pick(hits[0].key);
              }
            }}
            placeholder="מוצר או ברקוד" aria-label="חיפוש מוצר או ברקוד" enterKeyHint="search" autoComplete="off" />
          {busy && <span className="sh-spinner" aria-hidden />}
          {q && <button type="button" className="sh-icon-btn" onClick={() => setQ('')} aria-label="ניקוי החיפוש"><FaTimes /></button>}
        </label>
        <button type="button" className="sh-here-scan" onClick={onScan} aria-label="סריקת ברקוד">
          <FaBarcode aria-hidden /> סריקה
        </button>
      </div>
    </div>
  );
}

/** "₪3.00 פחות ב־רמי לוי (6 דק׳ הליכה)". */
/** One part's rows by verdict: worth buying here first, "אין כאן" folded. */
function WorthGroups({ rows, data, onOpen }: { rows: HereRow[]; data: HereResponse; onOpen: (key: string) => void }) {
  const [showMissing, setShowMissing] = useState(false);
  const groups = useMemo(() => groupHere(rows), [rows]);
  return (
    <>
      {(['best', 'ok', 'elsewhere'] as const).map((g) => groups[g].length > 0 && (
        <section key={g} className={`sh-dept sh-here-group is-${g}`}>
          <h3>{GROUP_TITLE[g]} <small>{groups[g].length}</small></h3>
          <ul>{groups[g].map((r) => <WorthRow key={r.key} row={r} data={data} onOpen={() => onOpen(r.key)} />)}</ul>
        </section>
      ))}
      {groups.missing.length > 0 && (
        <section className="sh-dept sh-here-group is-missing">
          <h3>
            <button type="button" className="sh-here-fold" onClick={() => setShowMissing(!showMissing)} aria-expanded={showMissing}>
              {GROUP_TITLE.missing} <FaChevronDown aria-hidden className={showMissing ? 'is-open' : ''} />
            </button>
            <small>{groups.missing.length}</small>
          </h3>
          {showMissing && <ul>{groups.missing.map((r) => <WorthRow key={r.key} row={r} data={data} onOpen={() => onOpen(r.key)} />)}</ul>}
        </section>
      )}
    </>
  );
}

function cheaperAt(row: Pick<HereRow, 'best' | 'saving'>, stores: Record<number, StoreInfo>) {
  const s = row.best ? stores[row.best.store] : undefined;
  return `${ils(row.saving)} פחות ב${storeName(s)}${walkLabel(s)}`;
}

function WorthRow({ row, data, onOpen }: { row: HereRow; data: HereResponse; onOpen: () => void }) {
  const it = data.items[row.key];
  const here = row.here;
  let sub: string;
  if (row.group === 'missing') {
    sub = row.best ? `הכי זול: ${ils(row.best.cost)} ב${storeName(data.stores[row.best.store])}` : 'לא נמכר בסביבה';
  } else if (row.group === 'best') {
    sub = !row.best || row.best.store === data.store.k || row.best.cost >= here!.cost
      ? 'הכי זול באזור'
      : `כמעט כמו ב${storeName(data.stores[row.best.store])} (${ils(row.best.cost)})`;
  } else {
    sub = cheaperAt(row, data.stores);
  }
  return (
    <li>
      <button type="button" className={`sh-tick sh-here-row is-${row.group}`} onClick={onOpen}>
        <Thumb src={it?.img} size={40} by={it?.imgBy} />
        <span className="sh-tick-name">
          <span>{it?.name ?? row.key} <small className="sh-here-qty">{qtyLabel(row.qty, it?.w ?? false)}</small></span>
          <small>{sub}</small>
        </span>
        <span className="sh-here-price">
          {here && <SaleLabel applied={here.applied.length > 0 || !!here.multi} idle={!here.multi && here.idle.length > 0} offers={here.offers.length > 0} />}
          {here ? <b title={here.multi ? multiNote(here.multi) : undefined}>{ils(here.cost)}{here.multi && <MultiStar />}</b> : <span className="sh-muted">—</span>}
          {here && here.cost < here.regularUnit && <s>{ils(here.regularUnit)}</s>}
        </span>
      </button>
    </li>
  );
}

/** The text of an item's deals here: applied first, then multi-buys it doesn't reach, then club/coupon offers. */
function dealsOf(price: ItemPrice, promos: Record<string, PromoDetail>) {
  const seen = new Set<string>();
  const all = [
    ...price.applied.map((p) => ({ id: p.id, description: p.description, end: p.end, kind: 'applied' as const })),
    ...price.idle.flatMap((id) => (promos[id] ? [{ id, description: promos[id].description, end: promos[id].end, kind: 'idle' as const }] : [])),
    ...price.offers.filter((o) => o.reason !== 'unclear').map((o) => ({ id: o.id, description: o.description, end: o.end, kind: 'offer' as const })),
  ];
  return all.filter((d) => !seen.has(d.description) && seen.add(d.description));
}

function DealRow({ itemKey, price, qty, onList = false, data, onOpen, onAdd, listName }: {
  itemKey: string;
  price: ItemPrice;
  /** The quantity wanted (the list's, else the usual one), or null for an item not in My items. */
  qty: number | null;
  /** `qty` is the shopping list's (else My items' usual quantity). */
  onList?: boolean;
  data: HereResponse;
  onOpen: () => void;
  onAdd?: () => void;
  listName?: string | null;
}) {
  const it = data.items[itemKey];
  const deals = dealsOf(price, data.promos);
  const idle = deals.find((d) => d.kind === 'idle');
  const add = idle && qty !== null ? dealGap(data.promos[idle.id]?.minQty ?? null, qty, it?.w ?? false) : null;
  return (
    <li className="sh-here-deal">
      <button type="button" className="sh-tick sh-here-row" onClick={onOpen}>
        <Thumb src={it?.img} size={40} by={it?.imgBy} />
        <span className="sh-tick-name">
          <span>{it?.name ?? itemKey}</span>
          {deals.map((d) => (
            <small key={d.id} className={d.kind === 'applied' ? 'sh-promo' : 'sh-promo is-offer'}>
              {d.description} · {endsLabel(d.end, data.now)}
            </small>
          ))}
          {add !== null && <small className="sh-here-gap">{onList ? 'ברשימה' : 'בדרך כלל'} {qty}, עוד {add === 1 ? 'אחד' : add} למבצע</small>}
        </span>
        <span className="sh-here-price">
          <b title={price.multi ? multiNote(price.multi) : undefined}>{ils(price.cost)}{price.multi && <MultiStar />}</b>
          {price.cost < price.regularUnit && <s>{ils(price.regularUnit)}</s>}
        </span>
      </button>
      {onAdd && (
        <button type="button" className="sh-icon-btn sh-here-add" onClick={onAdd}
          aria-label={`הוספה ל${listName ? `"${listName}"` : 'רשימה'}: ${it?.name ?? itemKey}`}><FaPlus /></button>
      )}
    </li>
  );
}

// ── the scan verdict ──

const VERDICT: Record<HereGroup, { title: string; mark: string }> = {
  best: { title: 'כדאי כאן', mark: '🟢' },
  ok: { title: 'סביר', mark: '🟡' },
  elsewhere: { title: 'עדיף במקום אחר', mark: '🔴' },
  missing: { title: 'אין לנו מחיר בחנות הזאת', mark: '⚪' },
};

type Alt = { key: string; name: string; w: boolean; img: string | null; price: number };

function Verdict({ code, store, near, rows, listName, onAdd, onDetails, onClose, onScanAgain }: {
  code: string;
  store: StoreInfo;
  near: string;
  rows: HereRow[];
  listName: string | null;
  onAdd: HereProps['onAdd'];
  onDetails: (key: string) => void;
  onClose: () => void;
  onScanAgain: () => void;
}) {
  const [data, setData] = useState<ItemResponse | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const [twin, setTwin] = useState<Alt | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    setState('loading');
    setTwin(null);
    getJson<ItemResponse>(`/item?key=${encodeURIComponent(code)}&${near}`, ctl.signal)
      .then((d) => { setData(d); setState('ok'); })
      .catch((e: Error) => { if (!ctl.signal.aborted) setState(e.message === '404' ? 'missing' : 'error'); });
    return () => ctl.abort();
  }, [code, near]);

  const it = data?.item;
  const listed = it ? rows.find((r) => r.key === it.key) : undefined;
  const qty = listed?.qty ?? 1;
  const here = data?.physical.find((p) => p.store === store.k) ?? null;
  const best = data?.physical[0] ?? null;
  const v = data ? verdict(here?.cost ?? null, best?.cost ?? null, qty) : null;
  const bestStore = best ? data?.stores[best.store] : undefined;

  // Cheaper elsewhere: a similar item this store sells for less than this one here.
  useEffect(() => {
    if (!it || !here || !v || (v.group !== 'ok' && v.group !== 'elsewhere')) return;
    const ctl = new AbortController();
    getJson<Alt[]>(`/alternatives?key=${encodeURIComponent(it.key)}&store=${store.k}`, ctl.signal)
      .then((alts) => setTwin(alts.find((a) => a.price < here.cost && a.w === it.w && isTwin(it.name, it.manufacturer, a.name)) ?? null))
      .catch(() => {});
    return () => ctl.abort();
  }, [it, here, v?.group, store.k]); // eslint-disable-line react-hooks/exhaustive-deps -- v is derived from data

  return (
    <div className="sh-end sh-here-verdict" role="dialog" aria-modal="true" aria-labelledby="sh-verdict-title">
      <button type="button" className="sh-icon-btn sh-sheet-close" onClick={onClose} aria-label="סגירה"><FaTimes /></button>
      {state === 'loading' && <div className="sh-skeleton sh-here-verdict-skel" aria-label="טוען" />}
      {state === 'missing' && (
        <>
          <p id="sh-verdict-title" className="sh-end-title">הברקוד לא נמצא</p>
          <p className="sh-muted">הברקוד <bdi>{code}</bdi> לא מופיע בקבצי המחירים שאנחנו קוראים.</p>
        </>
      )}
      {state === 'error' && (
        <>
          <p id="sh-verdict-title" className="sh-end-title">לא הצלחנו לבדוק</p>
          <p className="sh-muted">בדקו את החיבור ונסו לסרוק שוב.</p>
        </>
      )}
      {state === 'ok' && it && v && (
        <>
          <div className="sh-here-verdict-head">
            <Thumb src={it.img} size={56} by={it.imgBy} />
            <div>
              <p className="sh-muted sh-here-verdict-item">{it.name}{listed && <> · {listed.onList ? 'ברשימה' : 'במוצרים שלי'} {qtyLabel(qty, it.w)}</>}</p>
              <p id="sh-verdict-title" className={`sh-end-title sh-here-verdict-title is-${v.group}`}>
                <span aria-hidden>{VERDICT[v.group].mark}</span> {v.group === 'elsewhere' && bestStore ? `עדיף ב${storeName(bestStore)}` : VERDICT[v.group].title}
              </p>
            </div>
          </div>
          {here && (
            <p className="sh-here-verdict-price">
              <b>{ils(here.cost)}{here.multi && <MultiStar />}</b> כאן{here.cost < here.regularUnit && <> <s>{ils(here.regularUnit)}</s></>}
              {it.w && <small> לק״ג</small>}
              {here.multi && <small className="sh-here-multi">{multiNote(here.multi)}</small>}
            </p>
          )}
          <p className="sh-here-verdict-why">
            {v.group === 'best' && (!best || best.store === store.k || best.cost >= here!.cost
              ? 'הכי זול באזור.'
              : `כמעט כמו ב${storeName(bestStore)} (${ils(best.cost)}).`)}
            {v.group === 'ok' && <>{cheaperAt({ best, saving: v.saving }, data!.stores)}. לא שווה הליכה.</>}
            {v.group === 'elsewhere' && best && <>{ils(best.cost)} ב{storeName(bestStore)}{walkLabel(bestStore)}: {ils(v.saving)} פחות{qty !== 1 ? ` על ${qtyLabel(qty, it.w)}` : ''}.</>}
            {v.group === 'missing' && (best ? <>הכי זול באזור: {ils(best.cost)} ב{storeName(bestStore)}{walkLabel(bestStore)}.</> : 'לא נמכר בחנויות בסביבה.')}
          </p>
          {twin && (
            <p className="sh-here-twin">או כאן: <b>{twin.name}</b> ב־{ils(twin.price)}{twin.w ? ' לק״ג' : ''}</p>
          )}
          <div className="sh-end-actions">
            <button type="button" className="sh-btn sh-btn--primary" onClick={onScanAgain}><FaBarcode aria-hidden /> סריקה נוספת</button>
            <div className="sh-here-verdict-more">
              <button type="button" className="sh-btn" onClick={() => onAdd({ key: it.key, name: it.name, w: it.w })}
                aria-label={`הוספה ל${listName ? `"${listName}"` : 'רשימה'}`}>
                <FaPlus aria-hidden /> לרשימה
              </button>
              <button type="button" className="sh-btn" onClick={() => onDetails(it.key)}>כל המחירים</button>
            </div>
          </div>
        </>
      )}
      {state !== 'ok' && (
        <div className="sh-end-actions">
          <button type="button" className="sh-btn sh-btn--primary" onClick={onScanAgain}><FaBarcode aria-hidden /> סריקה נוספת</button>
        </div>
      )}
    </div>
  );
}
