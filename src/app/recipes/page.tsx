'use client';

// /recipes: the caller's recipe book and the shared feed
// (docs/superpowers/specs/2026-11-24-recipes-design.md § Screens).

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaDownload, FaPlus, FaSearch, FaTimes } from 'react-icons/fa';
import { filterRecipes, tagsOf } from '@/lib/recipes/filter';
import type { RecipeSummary } from '@/lib/recipes/types';
import ImportSheet from './ImportSheet';
import RecipeCard from './RecipeCard';
import * as api from './api';

type Tab = 'mine' | 'feed';
const TAB_KEY = 'recipes:tab';

export default function RecipesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('mine');
  const [lists, setLists] = useState<Record<Tab, RecipeSummary[] | null>>({ mine: null, feed: null });
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(TAB_KEY) === 'feed') setTab('feed');
    } catch { /* private mode */ }
  }, []);

  useEffect(() => {
    let live = true;
    setError(null);
    (tab === 'mine' ? api.listMine() : api.listFeed())
      .then((list) => { if (live) setLists((l) => ({ ...l, [tab]: list })); })
      .catch((e: unknown) => { if (live) setError(e instanceof Error ? e.message : 'לא נטען'); });
    return () => { live = false; };
  }, [tab]);

  const pick = (t: Tab) => {
    setTab(t);
    setTags([]);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* private mode */ }
  };

  const list = lists[tab];
  const shown = useMemo(() => (list ? filterRecipes(list, q, tags) : []), [list, q, tags]);
  const allTags = useMemo(() => (list ? tagsOf(list) : []), [list]);

  const create = async () => {
    setCreating(true);
    try {
      const r = await api.createRecipe();
      router.push(`/recipes/${r.id}?edit=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא נוצר');
      setCreating(false);
    }
  };

  return (
    <main className="sh-page rc-page">
      <header className="rc-head">
        <h1 className="rc-title">מתכונים</h1>
        <button type="button" className="sh-btn rc-head-btn" onClick={() => setImporting(true)}><FaDownload aria-hidden /> ייבוא</button>
        <button type="button" className="sh-btn sh-btn--primary rc-head-btn" disabled={creating} onClick={() => void create()}><FaPlus aria-hidden /> חדש</button>
      </header>

      <div className="rc-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'mine'} className={`rc-tab ${tab === 'mine' ? 'is-on' : ''}`} onClick={() => pick('mine')}>שלי</button>
        <button type="button" role="tab" aria-selected={tab === 'feed'} className={`rc-tab ${tab === 'feed' ? 'is-on' : ''}`} onClick={() => pick('feed')}>פיד</button>
      </div>

      <label className="sh-search-box rc-search">
        <FaSearch aria-hidden />
        <input type="search" value={q} placeholder="חיפוש לפי שם, מצרך או תגית" onChange={(e) => setQ(e.target.value)} />
        {q ? <button type="button" className="sh-icon-btn" aria-label="ניקוי" onClick={() => setQ('')}><FaTimes /></button> : null}
      </label>

      {allTags.length ? (
        <div className="rc-chips" aria-label="תגיות">
          {allTags.map((t) => (
            <button key={t} type="button" className={`sh-chip ${tags.includes(t) ? 'is-on' : ''}`} aria-pressed={tags.includes(t)}
              onClick={() => setTags((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))}>{t}</button>
          ))}
        </div>
      ) : null}

      {error ? <p className="cal-error" role="alert">{error}</p> : null}
      {!list && !error ? <div className="rc-grid" aria-label="טוען">{[0, 1, 2].map((n) => <div key={n} className="rc-card is-loading" />)}</div> : null}
      {list && !list.length ? (
        <p className="sh-empty rc-empty">{tab === 'mine' ? 'עוד אין מתכונים. אפשר להתחיל ב״חדש״ או לייבא מהרשת.' : 'אין עדיין מתכונים בפיד. מתכון שתשתפו יופיע כאן.'}</p>
      ) : null}
      {list && list.length && !shown.length ? <p className="sh-empty rc-empty">אין מתכון שמתאים לחיפוש.</p> : null}
      {shown.length ? <div className="rc-grid">{shown.map((r) => <RecipeCard key={r.id} r={r} showOwner={tab === 'feed'} />)}</div> : null}

      {importing ? <ImportSheet onClose={() => setImporting(false)} /> : null}
    </main>
  );
}
