'use client';

// /recipes: the caller's recipe book and the shared feed
// (docs/superpowers/specs/2026-11-24-recipes-design.md § Screens).

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { FaArrowRight, FaPlus, FaSearch, FaTimes } from 'react-icons/fa';
import { hasPermission } from '@/lib/permissions';
import { PotArt } from './art';
import TabBar, { type View } from './TabBar';
import { filterRecipes, tagsOf } from '@/lib/recipes/filter';
import type { RecipeSummary } from '@/lib/recipes/types';
import StartSheet from './StartSheet';
import ImportsList from './ImportsList';
import type { ImportRequest } from '@/lib/recipes/imports';
import RecipeCard from './RecipeCard';
import ListView from './ListView';
import * as api from './api';

type Tab = Exclude<View, 'list'>;
const VIEWS: Record<View, string> = { mine: '/recipes', feed: '/recipes?view=feed', list: '/recipes?view=list' };

export default function RecipesPage() {
  return <Suspense fallback={<main className="sh-page cal-page rc-page" />}><Book /></Suspense>;
}

function Book() {
  const router = useRouter();
  const { data: session } = useSession();
  // The view lives in the URL (?view=feed / list) so the back button returns to שלי.
  const param = useSearchParams().get('view');
  const view: View = param === 'feed' || param === 'list' ? param : 'mine';
  const tab: Tab = view === 'feed' ? 'feed' : 'mine'; // the recipe list the book view shows
  const [lists, setLists] = useState<Record<Tab, RecipeSummary[] | null>>({ mine: null, feed: null });
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  /** Came from /calories' ארוחות sheet (?from=calories): the header offers the way back. */
  const [fromCalories, setFromCalories] = useState(false);
  useEffect(() => { setFromCalories(new URLSearchParams(window.location.search).get('from') === 'calories'); }, []);
  const [creating, setCreating] = useState(false);
  const [imports, setImports] = useState<ImportRequest[]>([]);
  const open = imports.some((r) => r.status === 'queued' || r.status === 'working');

  // Import requests: loaded once, then every 5 s while one is open (and visible).
  useEffect(() => {
    let live = true;
    const load = () => api.listImports().then((list) => { if (live) setImports(list); }).catch(() => undefined);
    void load();
    if (!open) return () => { live = false; };
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 5000);
    return () => { live = false; window.clearInterval(t); };
  }, [open]);

  // A request that finishes while the page is open brings its recipe into the book.
  const seenDone = useRef<Set<string> | null>(null);
  useEffect(() => {
    const done = imports.filter((r) => r.status === 'done').map((r) => r.id);
    if (seenDone.current === null) { seenDone.current = new Set(done); return; }
    const fresh = done.filter((id) => !seenDone.current!.has(id));
    fresh.forEach((id) => seenDone.current!.add(id));
    if (fresh.length) void api.listMine().then((mine) => setLists((l) => ({ ...l, mine }))).catch(() => undefined);
  }, [imports]);

  const dismiss = (id: string) => {
    setImports((l) => l.filter((r) => r.id !== id));
    void api.dismissImport(id).catch(() => undefined);
  };

  useEffect(() => {
    let live = true;
    setError(null);
    setTags([]); // a tag picked in the other view (also when Back switched it) would hide everything here
    (tab === 'mine' ? api.listMine() : api.listFeed())
      .then((list) => { if (live) setLists((l) => ({ ...l, [tab]: list })); })
      .catch((e: unknown) => { if (live) setError(e instanceof Error ? e.message : 'לא נטען'); });
    return () => { live = false; };
  }, [tab]);

  const pick = (v: View) => {
    if (v === view) return;
    router.push(VIEWS[v], { scroll: false });
  };
  const start = () => setStarting(true);

  const list = lists[tab];
  const shown = useMemo(() => (list ? filterRecipes(list, q, tags) : []), [list, q, tags]);
  const allTags = useMemo(() => (list ? tagsOf(list) : []), [list]);

  // "מאפס": a new empty recipe, opened in the editor (errors show in the sheet).
  const create = async () => {
    setCreating(true);
    try {
      const r = await api.createRecipe();
      router.push(`/recipes/${r.id}?edit=1`);
    } catch (e) {
      setCreating(false);
      throw e;
    }
  };

  return (
    <main className="sh-page cal-page rc-page">
      {fromCalories ? <Link href="/calories" className="rc-back-link"><FaArrowRight aria-hidden /> חזרה ליומן הקלוריות</Link> : null}
      <header className="rc-head">
        <h1 className="rc-serif rc-title">{view === 'list' ? 'רשימת קניות' : view === 'feed' ? 'פיד' : 'מתכונים'}</h1>
        {view === 'list' ? null : <button type="button" className="rc-plus" aria-label="מתכון חדש" disabled={creating} onClick={start}><FaPlus /></button>}
      </header>

      {view === 'list' ? <ListView /> : <>
      <label className="sh-search-box rc-search">
        <FaSearch aria-hidden />
        <input type="search" value={q} placeholder="חיפוש לפי שם, מצרך או תגית" onChange={(e) => setQ(e.target.value)} />
        {q ? <button type="button" className="sh-icon-btn" aria-label="ניקוי" onClick={() => setQ('')}><FaTimes /></button> : null}
      </label>

      <ImportsList imports={imports} onDismiss={dismiss} />

      {allTags.length ? (
        <div className="cal-chips is-scroll" aria-label="תגיות">
          {allTags.map((t) => (
            <button key={t} type="button" className={`sh-chip ${tags.includes(t) ? 'is-on' : ''}`} aria-pressed={tags.includes(t)}
              onClick={() => setTags((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))}>{t}</button>
          ))}
        </div>
      ) : null}

      {error ? <p className="cal-error" role="alert">{error}</p> : null}
      {!list && !error ? <div className="cal-ring-card is-loading rc-loading" aria-label="טוען" /> : null}
      {list && !list.length ? (
        <div className="rc-empty-state">
          <PotArt />
          <p>{tab === 'mine' ? 'הוסיפו את המתכון הראשון' : 'עוד אין מתכונים בפיד'}</p>
          {tab === 'mine' ? <button type="button" className="rc-cta" onClick={start}>הוספת מתכון</button> : null}
        </div>
      ) : null}
      {list && list.length && !shown.length ? <p className="cal-muted rc-empty">לא נמצאו מתכונים</p> : null}
      {shown.length ? (
        <section className="sh-card cal-meal" aria-label={tab === 'mine' ? 'המתכונים שלי' : 'פיד'}>
          <ul className="cal-entries">{shown.map((r) => <RecipeCard key={r.id} r={r} showOwner={tab === 'feed'} />)}</ul>
        </section>
      ) : null}
      </>}

      <TabBar view={view} onView={pick} showList={hasPermission(session, 'shopping')} />

      {starting ? <StartSheet onClose={() => setStarting(false)} onScratch={create} onQueued={(r) => { setStarting(false); setImports((l) => [r, ...l]); }} /> : null}
    </main>
  );
}
