'use client';

// One recipe, read: photo, servings (rescales the amounts), ingredients with
// their original line and swap note, steps, values per serving, actions.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaBookmark, FaEllipsisH, FaFire, FaPen, FaShareAlt, FaShoppingCart, FaUtensils } from 'react-icons/fa';
import { perServing } from '@/lib/recipes/nutrition';
import { scaleLine } from '@/lib/recipes/scale';
import { shareText } from '@/lib/recipes/share';
import type { Recipe } from '@/lib/recipes/types';
import Macros from '../calories/Macros';
import Sheet from '../calories/Sheet';
import LogSheet from './LogSheet';
import ServingsStepper from './ServingsStepper';
import ToListSheet from './ToListSheet';
import * as api from './api';

export interface Can { shop: boolean; calories: boolean }

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

export default function RecipeView({ recipe, me, can, servings, setServings, onEdit, onCook, onChanged, toast }: {
  recipe: Recipe; me: string; can: Can; servings: number; setServings: (n: number) => void;
  onEdit: () => void; onCook: () => void; onChanged: (r: Recipe) => void; toast: (m: string) => void;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<'list' | 'log' | 'more' | null>(null);
  const [busy, setBusy] = useState(false);
  const mine = recipe.owner === me;
  const factor = servings / recipe.servings;
  const { totals, partial } = perServing(recipe);
  const unlinked = recipe.ingredients.filter((i) => i.qty !== null && !(i.link && i.grams)).length;
  const total = (recipe.prepMin ?? 0) + (recipe.cookMin ?? 0);
  const steps = recipe.steps.filter((s) => s.trim());
  const lines = recipe.ingredients.filter((i) => i.text.trim() || i.name.trim());

  const share = async () => {
    const text = shareText(recipe, servings);
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast('הועתק'); }
    } catch { /* the share sheet was closed */ }
  };

  const toggleFeed = async () => {
    setBusy(true);
    try {
      onChanged(await api.patchRecipe(recipe.id, { shared: !recipe.shared }));
      toast(recipe.shared ? 'הוסר מהפיד' : 'שותף בפיד');
      setSheet(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'לא נשמר');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm(`למחוק את ״${recipe.name}״?`)) return;
    setBusy(true);
    try {
      await api.deleteRecipe(recipe.id);
      router.replace('/recipes');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'לא נמחק');
      setBusy(false);
    }
  };

  const saveCopy = async () => {
    setBusy(true);
    try {
      const copy = await api.copyRecipe(recipe.id);
      router.push(`/recipes/${copy.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'לא נשמר');
      setBusy(false);
    }
  };

  return (
    <article className="rc-recipe">
      {recipe.photo ? <img className="rc-photo" src={recipe.photo} alt="" /> : null}
      <h1 className="rc-name">{recipe.name}</h1>
      <p className="rc-meta">
        {recipe.prepMin ? <span>הכנה {recipe.prepMin} דק׳</span> : null}
        {recipe.cookMin ? <span>בישול {recipe.cookMin} דק׳</span> : null}
        {total && recipe.prepMin && recipe.cookMin ? <span>⏱ {total} דק׳</span> : null}
        {!mine && recipe.ownerName ? <span>מאת {recipe.ownerName}</span> : null}
        {recipe.source?.url ? <a href={recipe.source.url} target="_blank" rel="noreferrer noopener">מ־<bdi>{hostOf(recipe.source.url)}</bdi></a> : null}
      </p>
      {recipe.tags.length ? <p className="rc-tags">{recipe.tags.map((t) => <span key={t} className="sh-chip">{t}</span>)}</p> : null}

      <div className="cal-actions rc-actions">
        {can.shop ? <button type="button" className="sh-btn sh-home-btn" onClick={() => setSheet('list')}><FaShoppingCart aria-hidden /> לרשימה</button> : null}
        <button type="button" className="sh-btn sh-home-btn" onClick={onCook} disabled={!steps.length}><FaUtensils aria-hidden /> בישול</button>
        {can.calories ? <button type="button" className="sh-btn sh-home-btn" disabled={!totals} title={totals ? undefined : 'אין מצרכים מקושרים'} onClick={() => setSheet('log')}><FaFire aria-hidden /> רשום מנה</button> : null}
        <button type="button" className="sh-btn sh-home-btn" onClick={() => void share()}><FaShareAlt aria-hidden /> שתף</button>
        {mine
          ? <button type="button" className="sh-icon-btn rc-more" aria-label="עוד" onClick={() => setSheet('more')}><FaEllipsisH /></button>
          : <button type="button" className="sh-btn sh-home-btn" disabled={busy} onClick={() => void saveCopy()}><FaBookmark aria-hidden /> שמור אצלי</button>}
      </div>

      <section className="sh-card cal-meal rc-section">
        <header className="cal-meal-head">
          <h2>מצרכים</h2>
          <ServingsStepper value={servings} onChange={setServings} />
        </header>
        {lines.length ? (
          <ul className="rc-ings">
            {lines.map((i) => (
              <li key={i.id} className="rc-ing">
                <span>{scaleLine(i, factor)}{mine && i.auto ? <small className="rc-check" title="קושר אוטומטית — כדאי לבדוק">לבדוק</small> : null}</span>
                {i.orig ? <small className="rc-orig" dir="auto">{i.orig}</small> : null}
                {i.alt ? <small className="rc-alt">🔁 {i.alt}</small> : null}
              </li>
            ))}
          </ul>
        ) : <p className="cal-muted">עוד אין מצרכים.</p>}
      </section>

      <section className="sh-card cal-meal rc-section">
        <header className="cal-meal-head"><h2>אופן הכנה</h2></header>
        {steps.length ? <ol className="rc-steps">{steps.map((s, n) => <li key={n}>{s}</li>)}</ol> : <p className="cal-muted">עוד אין שלבים.</p>}
      </section>

      {totals ? (
        <section className="sh-card cal-meal rc-section">
          <header className="cal-meal-head"><h2>ערכים למנה</h2><span className="cal-entry-kcal">{totals.kcal.toLocaleString('he-IL')} קק״ל</span></header>
          <Macros t={totals} />
          {partial ? <p className="cal-muted rc-partial">חלקי — {unlinked === 1 ? 'מצרך אחד לא מקושר' : `${unlinked} מצרכים לא מקושרים`}</p> : null}
        </section>
      ) : null}

      {recipe.notes.trim() ? <section className="sh-card cal-meal rc-section"><header className="cal-meal-head"><h2>הערות</h2></header><p className="rc-notes">{recipe.notes}</p></section> : null}

      {sheet === 'list' ? <ToListSheet recipe={recipe} servings={servings} mine={mine} onDone={(m, updated) => { setSheet(null); if (updated) onChanged(updated); if (m) toast(m); }} /> : null}
      {sheet === 'log' && totals ? <LogSheet recipe={recipe} perServing={totals} onDone={(m) => { setSheet(null); if (m) toast(m); }} /> : null}
      {sheet === 'more' ? (
        <Sheet title={recipe.name} onClose={() => setSheet(null)}>
          <div className="rc-menu">
            <button type="button" className="sh-btn" onClick={() => { setSheet(null); onEdit(); }}><FaPen aria-hidden /> עריכה</button>
            <button type="button" className="sh-btn" disabled={busy} onClick={() => void toggleFeed()}>{recipe.shared ? 'הסרה מהפיד' : 'שיתוף בפיד'}</button>
            <button type="button" className="sh-btn sh-btn--danger" disabled={busy} onClick={() => void remove()}>מחיקה</button>
          </div>
        </Sheet>
      ) : null}
    </article>
  );
}
