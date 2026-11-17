'use client';

// "אני בחנות" (docs/shopping-here-mode.md): pick the store you're in (nearest
// first when the phone shares its location), then see what on your lists is
// worth buying here, the deals here on things you buy, and a verdict for any
// product you scan. Read-only towards the lists apart from "+ לרשימה".
// The user's position stays on the device: the store list comes with each
// store's location and is sorted here.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { FaArrowRight, FaBarcode, FaChevronDown, FaLocationArrow, FaPlus, FaSearch, FaShoppingCart, FaTimes } from 'react-icons/fa';
import { SHOPPING_API_PATH } from '@/lib/shopping/config';
import type { HereResponse, HereRow, HereStore, HereStoresResponse, ItemPrice, ItemResponse, PromoDetail, StoreInfo } from '@/lib/shopping/api-types';
import {
  dealGap, distanceLabel, endsLabel, groupHere, HERE_REMEMBER_MS, isTwin, nearbyStore, sortStores, verdict, type HereGroup, type LatLng,
} from '@/lib/shopping/here';
import { cleanAddress, dayMonth, ils, qtyLabel, SaleLabel, storeName, Thumb } from './ui';

const Scanner = dynamic(() => import('./Scanner'), { ssr: false });

const LS_HERE = 'shopping:here';

interface Remembered { city: string; store: number; at: number }

const readRemembered = (city: string): number | null => {
  try {
    const r = JSON.parse(localStorage.getItem(LS_HERE) ?? 'null') as Remembered | null;
    return r && r.city === city && Date.now() - r.at < HERE_REMEMBER_MS ? r.store : null;
  } catch {
    return null;
  }
};
const remember = (city: string, store: number | null) => {
  try {
    if (store === null) localStorage.removeItem(LS_HERE);
    else localStorage.setItem(LS_HERE, JSON.stringify({ city, store, at: Date.now() } satisfies Remembered));
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

const walkLabel = (s: StoreInfo | undefined) => (s?.walkMin != null ? ` (${s.walkMin} דק׳ הליכה)` : '');

export interface HereProps {
  city: string;
  /** Item keys on the open trip's stops, by store (to hand over to the trip's checklist). */
  tripStores: Record<number, number>;
  onOpenTrip: () => void;
  /** Open the product window for an item key or a scanned barcode. */
  onOpenItem: (key: string, scanned: boolean) => void;
  /** "+ לרשימה": adds to the list open on the page. */
  onAdd: (item: { key: string; name: string; w: boolean }) => void;
  listName: string | null;
  onClose: () => void;
}

export default function Here(props: HereProps) {
  const { city, onClose } = props;
  const [storeKey, setStoreKey] = useState<number | null>(() => readRemembered(city));
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
    getJson<HereStoresResponse>(`/here/stores?city=${city}`, ctl.signal)
      .then((r) => setStores(r.stores))
      .catch(() => { if (!ctl.signal.aborted) setStoresError(true); });
    return () => ctl.abort();
  }, [city]);

  const choose = (k: number | null) => {
    remember(city, k);
    setStoreKey(k);
  };

  const store = stores?.find((s) => s.k === storeKey) ?? null;
  return (
    <div className="sh-instore sh-here" role="dialog" aria-modal="true" aria-label="אני בחנות">
      {store ? (
        <StoreView {...props} store={store} onChangeStore={() => choose(null)} />
      ) : (
        <Picker stores={stores} error={storesError} onPick={choose} onClose={onClose} />
      )}
    </div>
  );
}

// ── picking the store ──

function Picker({ stores, error, onPick, onClose }: {
  stores: HereStore[] | null;
  error: boolean;
  onPick: (k: number) => void;
  onClose: () => void;
}) {
  const [pos, setPos] = useState<Pos>({ state: 'idle' });
  const [filter, setFilter] = useState('');

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
  const sorted = useMemo(() => (stores ? sortStores(stores, me) : []), [stores, me]);
  const near = nearbyStore(sorted);
  const anyLoc = stores?.some((s) => s.loc) ?? false;
  const q = filter.trim();
  const shown = q ? sorted.filter((s) => `${s.chainName} ${s.name} ${cleanAddress(s.address)}`.includes(q)) : sorted;

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
          <button type="button" className="sh-resume sh-here-near" onClick={() => onPick(near.k)}>
            <FaLocationArrow aria-hidden />
            <span>
              <b>נראה שאת/ה ב{storeName(near)}</b>
              <small>{distanceLabel(near.distM!)} ממך</small>
            </span>
            <span className="sh-resume-go">נכון</span>
          </button>
        )}
        {stores && stores.length > 6 && (
          <label className="sh-search-box sh-here-filter">
            <FaSearch aria-hidden />
            <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder="חיפוש חנות" aria-label="חיפוש חנות" autoComplete="off" />
          </label>
        )}
        {error && <p className="sh-error">לא הצלחנו לטעון את החנויות. נסו שוב.</p>}
        {!stores && !error && <div className="sh-skeleton" aria-label="טוען" />}
        {stores && !stores.length && <p className="sh-empty">אין לנו חנויות בעיר הזאת.</p>}
        <ul className="sh-here-stores">
          {shown.map((s) => (
            <li key={s.k}>
              <button type="button" className="sh-here-store" onClick={() => onPick(s.k)}>
                <span className="sh-tick-name">
                  <span>{s.chainName} <span className="sh-branch">{s.name}</span></span>
                  {cleanAddress(s.address) && <small>{cleanAddress(s.address)}</small>}
                </span>
                <span className="sh-here-dist">
                  {s.distM !== null ? distanceLabel(s.distM) : s.walkMin !== null ? `${s.walkMin} דק׳` : ''}
                  {!s.pricesAt && <small>{s.source === 'manual' ? 'מחירים ידניים' : 'אין מחירים'}</small>}
                </span>
              </button>
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

function StoreView({ store, city, tripStores, onOpenTrip, onOpenItem, onAdd, listName, onClose, onChangeStore }: HereProps & {
  store: HereStore;
  onChangeStore: () => void;
}) {
  const [data, setData] = useState<HereResponse | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>('worth');
  const [listFilter, setListFilter] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const ctl = new AbortController();
    setError(false);
    getJson<HereResponse>(`/here?store=${store.k}&city=${city}`, ctl.signal)
      .then(setData)
      .catch(() => { if (!ctl.signal.aborted) setError(true); });
    return () => ctl.abort();
  }, [store.k, city, reload]);

  const rows = useMemo(
    () => (data ? data.rows.filter((r) => !listFilter || r.listIds.includes(listFilter)) : []),
    [data, listFilter],
  );
  const groups = useMemo(() => groupHere(rows), [rows]);
  const dealRows = rows.filter((r) => r.here && (r.here.applied.length || r.here.idle.length || r.here.offers.length));
  const onTrip = tripStores[store.k] ?? 0;
  const listsWithItems = data?.lists.filter((l) => data.rows.some((r) => r.listIds.includes(l.id))) ?? [];

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
          כדאי כאן {data && <small>{groups.best.length}</small>}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'deals'} className={tab === 'deals' ? 'is-on' : ''} onClick={() => setTab('deals')}>
          מבצעים {data && <small>{dealRows.length + data.before.length}</small>}
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
        {data && listsWithItems.length > 1 && (
          <nav className="sh-scroller sh-here-lists" aria-label="רשימות">
            <button type="button" className={`sh-chip ${!listFilter ? 'is-on' : ''}`} aria-pressed={!listFilter} onClick={() => setListFilter(null)}>כל הרשימות</button>
            {listsWithItems.map((l) => (
              <button key={l.id} type="button" className={`sh-chip ${listFilter === l.id ? 'is-on' : ''}`} aria-pressed={listFilter === l.id}
                onClick={() => setListFilter(listFilter === l.id ? null : l.id)}>{l.name}</button>
            ))}
          </nav>
        )}

        {data && tab === 'worth' && (
          <>
            {!rows.length && <p className="sh-empty">הרשימות ריקות. אפשר לסרוק מוצר ולראות אם כדאי לקנות אותו כאן.</p>}
            {(['best', 'ok', 'elsewhere'] as const).map((g) => groups[g].length > 0 && (
              <section key={g} className={`sh-dept sh-here-group is-${g}`}>
                <h3>{GROUP_TITLE[g]} <small>{groups[g].length}</small></h3>
                <ul>{groups[g].map((r) => <WorthRow key={r.key} row={r} data={data} onOpen={() => onOpenItem(r.key, false)} />)}</ul>
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
                {showMissing && <ul>{groups.missing.map((r) => <WorthRow key={r.key} row={r} data={data} onOpen={() => onOpenItem(r.key, false)} />)}</ul>}
              </section>
            )}
          </>
        )}

        {data && tab === 'deals' && (
          <>
            <section className="sh-dept">
              <h3>ברשימות שלך <small>{dealRows.length}</small></h3>
              {!dealRows.length && <p className="sh-empty">אין כאן מבצע על מה שברשימות.</p>}
              <ul>{dealRows.map((r) => <DealRow key={r.key} itemKey={r.key} price={r.here!} qty={r.qty} data={data} onOpen={() => onOpenItem(r.key, false)} />)}</ul>
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
          </>
        )}
        {data && Object.values(data.items).some((i) => i.img && i.imgBy === 'off') && (
          <p className="sh-credit">חלק מהתמונות: Open Food Facts, ברישיון CC BY-SA.</p>
        )}
      </div>
      <button type="button" className="sh-here-scan" onClick={() => setScanning(true)} aria-label="סריקת מוצר">
        <FaBarcode aria-hidden /> סריקה
      </button>
      {scanning && (
        <Scanner onClose={() => setScanning(false)} onCode={(code) => { setScanning(false); setScanned(code); }} />
      )}
      {scanned && (
        <Verdict code={scanned} store={store} city={city} rows={data?.rows ?? []} listName={listName}
          onAdd={onAdd} onDetails={(key) => onOpenItem(key, true)} onClose={() => setScanned(null)}
          onScanAgain={() => { setScanned(null); setScanning(true); }} />
      )}
    </>
  );
}

/** "₪3.00 פחות ב־רמי לוי (6 דק׳ הליכה)". */
function cheaperAt(row: Pick<HereRow, 'best' | 'saving'>, stores: Record<number, StoreInfo>) {
  const s = row.best ? stores[row.best.store] : undefined;
  return `${ils(row.saving)} פחות ב${storeName(s)}${walkLabel(s)}`;
}

function WorthRow({ row, data, onOpen }: { row: HereRow; data: HereResponse; onOpen: () => void }) {
  const it = data.items[row.key];
  const here = row.here;
  let sub: string;
  if (row.group === 'missing') {
    sub = row.best ? `הכי זול: ${ils(row.best.cost)} ב${storeName(data.stores[row.best.store])}` : 'לא נמכר בעיר';
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
          {here && <SaleLabel applied={here.applied.length > 0} idle={here.idle.length > 0} offers={here.offers.length > 0} />}
          {here ? <b>{ils(here.cost)}</b> : <span className="sh-muted">—</span>}
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
    ...price.offers.map((o) => ({ id: o.id, description: o.description, end: o.end, kind: 'offer' as const })),
  ];
  return all.filter((d) => !seen.has(d.description) && seen.add(d.description));
}

function DealRow({ itemKey, price, qty, data, onOpen, onAdd, listName }: {
  itemKey: string;
  price: ItemPrice;
  /** The list quantity, or null for an item not on a list. */
  qty: number | null;
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
          {add !== null && <small className="sh-here-gap">ברשימה {qty}, עוד {add === 1 ? 'אחד' : add} למבצע</small>}
        </span>
        <span className="sh-here-price">
          <b>{ils(price.cost)}</b>
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

function Verdict({ code, store, city, rows, listName, onAdd, onDetails, onClose, onScanAgain }: {
  code: string;
  store: StoreInfo;
  city: string;
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
    getJson<ItemResponse>(`/item?key=${encodeURIComponent(code)}&city=${city}`, ctl.signal)
      .then((d) => { setData(d); setState('ok'); })
      .catch((e: Error) => { if (!ctl.signal.aborted) setState(e.message === '404' ? 'missing' : 'error'); });
    return () => ctl.abort();
  }, [code, city]);

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
              <p className="sh-muted sh-here-verdict-item">{it.name}{listed && <> · ברשימה {qtyLabel(qty, it.w)}</>}</p>
              <p id="sh-verdict-title" className={`sh-end-title sh-here-verdict-title is-${v.group}`}>
                <span aria-hidden>{VERDICT[v.group].mark}</span> {v.group === 'elsewhere' && bestStore ? `עדיף ב${storeName(bestStore)}` : VERDICT[v.group].title}
              </p>
            </div>
          </div>
          {here && (
            <p className="sh-here-verdict-price">
              <b>{ils(here.cost)}</b> כאן{here.cost < here.regularUnit && <> <s>{ils(here.regularUnit)}</s></>}
              {it.w && <small> לק״ג</small>}
            </p>
          )}
          <p className="sh-here-verdict-why">
            {v.group === 'best' && (!best || best.store === store.k || best.cost >= here!.cost
              ? 'הכי זול באזור.'
              : `כמעט כמו ב${storeName(bestStore)} (${ils(best.cost)}).`)}
            {v.group === 'ok' && <>{cheaperAt({ best, saving: v.saving }, data!.stores)}. לא שווה הליכה.</>}
            {v.group === 'elsewhere' && best && <>{ils(best.cost)} ב{storeName(bestStore)}{walkLabel(bestStore)}: {ils(v.saving)} פחות{qty !== 1 ? ` על ${qtyLabel(qty, it.w)}` : ''}.</>}
            {v.group === 'missing' && (best ? <>הכי זול באזור: {ils(best.cost)} ב{storeName(bestStore)}{walkLabel(bestStore)}.</> : 'לא נמכר בחנויות בעיר.')}
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
