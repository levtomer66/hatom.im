'use client';

// /recipes/[id]: one recipe — read (anyone while it's on the feed), edit
// (?edit=1, the owner) or cook (?cook=1).

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FaChevronRight } from 'react-icons/fa';
import { hasPermission } from '@/lib/permissions';
import type { Recipe } from '@/lib/recipes/types';
import CookMode from '../CookMode';
import RecipeEditor from '../RecipeEditor';
import RecipeView from '../RecipeView';
import * as api from '../api';

export default function RecipePage() {
  return <Suspense fallback={<main className="sh-page cal-page rc-page" />}><RecipeScreen /></Suspense>;
}

function RecipeScreen() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const me = session?.user?.email?.toLowerCase() ?? '';
  const can = { shop: hasPermission(session, 'shopping'), calories: hasPermission(session, 'calories') };
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<{ msg: string; gone: boolean } | null>(null);
  const [servings, setServings] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api.getRecipe(id)
      .then((r) => { if (live) setRecipe(r); })
      .catch((e: unknown) => {
        if (!live) return;
        const gone = e instanceof api.ApiError && e.status === 404;
        setError({ msg: gone ? 'המתכון לא נמצא — אולי כבר לא משותף.' : e instanceof Error ? e.message : 'לא נטען', gone });
      });
    return () => { live = false; };
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const go = useCallback((q: string) => router.replace(`/recipes/${id}${q ? `?${q}` : ''}`, { scroll: false }), [router, id]);

  if (error) {
    return (
      <main className="sh-page cal-page rc-page">
        <Link href="/recipes" className="sh-btn sh-btn--ghost cal-back rc-back"><FaChevronRight aria-hidden /> כל המתכונים</Link>
        <p className="cal-error" role="alert">{error.msg}</p>
      </main>
    );
  }
  if (!recipe || !session) return <main className="sh-page cal-page rc-page"><div className="rc-photo is-loading" /></main>;

  const mine = recipe.owner === me;
  const editing = mine && search.get('edit') === '1';
  const cooking = search.get('cook') === '1';
  const shownServings = servings ?? recipe.servings;

  return (
    <main className="sh-page cal-page rc-page">
      <Link href="/recipes" className="sh-btn sh-btn--ghost cal-back rc-back"><FaChevronRight aria-hidden /> כל המתכונים</Link>
      {editing
        ? <RecipeEditor recipe={recipe} can={can} onChanged={setRecipe} onDone={() => go('')} toast={setToast} />
        : <RecipeView recipe={recipe} me={me} can={can} servings={shownServings} setServings={setServings}
            onEdit={() => go('edit=1')} onCook={() => go('cook=1')} onChanged={setRecipe} toast={setToast} />}
      {cooking && !editing ? <CookMode recipe={recipe} servings={shownServings} onClose={() => go('')} /> : null}
      {toast ? <div className="sh-toast" role="status">{toast}</div> : null}
    </main>
  );
}
