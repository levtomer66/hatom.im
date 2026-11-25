'use client';

// Edit mode: no save button — each group of fields (details, ingredients,
// steps) saves through calories' useAutosave on its own PATCH, sending only
// its keys, so a quick ingredient edit and a step edit never overwrite each
// other. "סיום" sends what's still waiting and goes back to the recipe.

import { useEffect, useMemo, useRef, useState } from 'react';
import { FaArrowDown, FaArrowUp, FaCheck, FaPlus, FaTimes, FaLink } from 'react-icons/fa';
import { newIngredient } from '@/lib/recipes/recipe';
import { toGrams } from '@/lib/recipes/units';
import type { Ingredient, Recipe } from '@/lib/recipes/types';
import { statusText, useAutosave, type SaveStatus } from '../calories/autosave';
import CoverBand from './CoverBand';
import IngredientRow from './IngredientRow';
import LinkPicker, { type Linked } from './LinkPicker';
import { resizeImage } from './photo';
import type { Can } from './RecipeView';
import * as api from './api';

interface Details { name: string; description: string; sourceUrl: string; servings: string; prepMin: string; cookMin: string; notes: string; tags: string[] }

const detailsOf = (r: Recipe): Details => ({
  name: r.name, description: r.description ?? '', sourceUrl: r.source?.url ?? '', servings: String(r.servings), prepMin: r.prepMin === null ? '' : String(r.prepMin),
  cookMin: r.cookMin === null ? '' : String(r.cookMin), notes: r.notes, tags: r.tags,
});

const minutes = (s: string): number | null | undefined => {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 1440 ? n : undefined;
};

/** A link the server will take: empty (clears it) or https. */
export const linkOk = (s: string): boolean => {
  const t = s.trim();
  if (!t) return true;
  try { return new URL(t).protocol === 'https:'; } catch { return false; }
};

/** The details as the PATCH sends them, or undefined while a field isn't valid (nothing is sent). */
function detailsPatch(d: Details) {
  const servings = Number(d.servings);
  const prepMin = minutes(d.prepMin);
  const cookMin = minutes(d.cookMin);
  if (!d.name.trim() || !Number.isInteger(servings) || servings < 1 || servings > 100 || prepMin === undefined || cookMin === undefined || !linkOk(d.sourceUrl)) return undefined;
  return { name: d.name.trim(), description: d.description.trim(), sourceUrl: d.sourceUrl.trim(), servings, prepMin, cookMin, notes: d.notes, tags: d.tags };
}

const newId = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function combine(statuses: SaveStatus[]): SaveStatus {
  if (statuses.includes('saving')) return 'saving';
  if (statuses.includes('saved')) return 'saved';
  return 'idle';
}

export default function RecipeEditor({ recipe, can, onChanged, onDone, toast }: {
  recipe: Recipe; can: Can; onChanged: (update: (prev: Recipe) => Recipe) => void; onDone: () => void; toast: (m: string) => void;
}) {
  const id = recipe.id;
  const [details, setDetails] = useState<Details>(() => detailsOf(recipe));
  const [ings, setIngs] = useState<Ingredient[]>(recipe.ingredients);
  const [steps, setSteps] = useState<string[]>(recipe.steps);
  const [photo, setPhoto] = useState(recipe.photo);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [tagText, setTagText] = useState('');
  const [linking, setLinking] = useState<Ingredient | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusStep, setFocusStep] = useState<number | null>(null);
  /** Lines whose grams were set by hand (or by a link's amount): typing the text no longer re-estimates them. */
  const gramsSet = useRef(new Set(recipe.ingredients.filter((i) => i.link).map((i) => i.id)));
  const rowRefs = useRef(new Map<string, HTMLInputElement>());
  const stepRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Each group's response updates only the fields it saved: the three queues run
  // side by side, so a late answer must not roll back another group's newer save.
  const save = (patch: Parameters<typeof api.patchRecipe>[1]) =>
    api.patchRecipe(id, patch).then((r) => {
      // sourceUrl comes back as the recipe's source.
      const keys = Object.keys(patch).map((k) => (k === 'sourceUrl' ? 'source' : k)) as (keyof Recipe)[];
      onChanged((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, r[k]])), updatedAt: r.updatedAt }));
      return null;
    }, (e: unknown) => (e instanceof Error ? e.message : 'לא נשמר'));

  const initialDetails = useMemo(() => detailsPatch(detailsOf(recipe)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const a = useAutosave(detailsPatch(details), initialDetails, (v) => save(v));
  const b = useAutosave(ings, recipe.ingredients, (v) => save({ ingredients: v }));
  const c = useAutosave(steps, recipe.steps, (v) => save({ steps: v }));
  const status = combine([a.status, b.status, c.status]);
  const error = a.error ?? b.error ?? c.error;

  useEffect(() => {
    if (!focusId) return;
    rowRefs.current.get(focusId)?.focus();
    setFocusId(null);
  }, [focusId, ings]);

  useEffect(() => {
    if (focusStep === null) return;
    stepRefs.current[focusStep]?.focus();
    setFocusStep(null);
  }, [focusStep, steps]);

  const done = async () => {
    const ok = await Promise.all([a.flush(), b.flush(), c.flush()]);
    if (ok.every(Boolean)) onDone();
    else toast('לא הכל נשמר — בדקו את החיבור ונסו שוב');
  };

  const setIng = (lineId: string, f: (i: Ingredient) => Ingredient) => setIngs((list) => list.map((i) => (i.id === lineId ? f(i) : i)));
  const onText = (old: Ingredient, text: string) => setIng(old.id, () => {
    const p = newIngredient(text, old.id);
    const grams = gramsSet.current.has(old.id) ? old.grams : p.grams;
    return { ...p, grams, link: old.link, key: old.key, orig: old.orig, alt: old.alt, auto: old.auto };
  });
  const addLine = (after?: string) => {
    const line = newIngredient('', newId());
    setIngs((list) => {
      const at = after ? list.findIndex((i) => i.id === after) + 1 : list.length;
      return [...list.slice(0, at), line, ...list.slice(at)];
    });
    setFocusId(line.id);
  };
  const move = <T,>(list: T[], at: number, by: -1 | 1): T[] => {
    const to = at + by;
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    [next[at], next[to]] = [next[to], next[at]];
    return next;
  };
  const linked = (line: Ingredient, l: Linked) => {
    setIng(line.id, (i) => ({
      ...i,
      link: l.link ?? i.link,
      grams: l.grams ?? i.grams ?? toGrams(i.qty, i.unit, i.name),
      key: l.key ?? (l.link ? null : i.key),
      auto: false,
    }));
    if (l.grams) gramsSet.current.add(line.id);
    setLinking(null);
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const url = await api.uploadPhoto(id, await resizeImage(file));
      setPhoto(url);
      onChanged((prev) => ({ ...prev, photo: url }));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'התמונה לא עלתה');
    } finally { setPhotoBusy(false); }
  };
  const dropPhoto = async () => {
    setPhotoBusy(true);
    try {
      await api.removePhoto(id);
      setPhoto(null);
      onChanged((prev) => ({ ...prev, photo: null }));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'לא הוסר');
    } finally { setPhotoBusy(false); }
  };

  const addTag = () => {
    const t = tagText.replace(/\s+/g, ' ').trim().slice(0, 30);
    if (t && !details.tags.includes(t) && details.tags.length < 10) setDetails({ ...details, tags: [...details.tags, t] });
    setTagText('');
  };

  return (
    <div className="rc-editor">
      <div className="rc-edit-top">
        <p className="cal-muted cal-save-state" aria-live="polite">{error ?? statusText(status)}</p>
        <button type="button" className="sh-btn sh-btn--primary" onClick={() => void done()}><FaCheck aria-hidden /> סיום</button>
      </div>

      <CoverBand photo={photo} busy={photoBusy} onPick={(f) => void pickPhoto(f)} onRemove={() => void dropPhoto()} />

      <div className="rc-head-fields">
        <input className="rc-input rc-input-name rc-serif" value={details.name} maxLength={120} placeholder="שם המתכון" aria-label="שם המתכון"
          onChange={(e) => setDetails({ ...details, name: e.target.value })} />
        <textarea className="rc-input rc-input-desc" rows={2} value={details.description} maxLength={200} placeholder="תיאור קצר" aria-label="תיאור קצר"
          onChange={(e) => setDetails({ ...details, description: e.target.value })} />
        <label className="rc-link-field">
          <span>קישור</span>
          <input type="url" inputMode="url" dir="ltr" value={details.sourceUrl} placeholder="https://…" aria-invalid={!linkOk(details.sourceUrl)}
            onChange={(e) => setDetails({ ...details, sourceUrl: e.target.value })} />
          <FaLink aria-hidden />
        </label>
        {!linkOk(details.sourceUrl) ? <p className="cal-error">צריך קישור https</p> : null}
      </div>
      <div className="rc-field-row">
        <label className="cal-field rc-field"><span>מנות</span>
          <input className="rc-input" type="number" inputMode="numeric" min={1} max={100} value={details.servings} onChange={(e) => setDetails({ ...details, servings: e.target.value })} />
        </label>
        <label className="cal-field rc-field"><span>הכנה (דק׳)</span>
          <input className="rc-input" type="number" inputMode="numeric" min={0} max={1440} value={details.prepMin} onChange={(e) => setDetails({ ...details, prepMin: e.target.value })} />
        </label>
        <label className="cal-field rc-field"><span>בישול (דק׳)</span>
          <input className="rc-input" type="number" inputMode="numeric" min={0} max={1440} value={details.cookMin} onChange={(e) => setDetails({ ...details, cookMin: e.target.value })} />
        </label>
      </div>

      <div className="cal-field rc-field">
        <span>תגיות</span>
        <div className="rc-chips rc-chips-wrap">
          {details.tags.map((t) => (
            <button key={t} type="button" className="sh-chip is-on" aria-label={`הסרת התגית ${t}`} onClick={() => setDetails({ ...details, tags: details.tags.filter((x) => x !== t) })}>{t} <FaTimes aria-hidden /></button>
          ))}
          {details.tags.length < 10 ? (
            <input className="rc-input rc-tag-input" value={tagText} placeholder="+ תגית" maxLength={30} enterKeyHint="done"
              onChange={(e) => setTagText(e.target.value)} onBlur={addTag}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }} />
          ) : null}
        </div>
      </div>

      <section className="sh-card cal-meal rc-section">
        <header className="cal-meal-head"><h2>מצרכים</h2></header>
        <p className="cal-muted rc-hint">שורה לכל מצרך, עם כמות ויחידה. 🔗 מקשר לערכים תזונתיים ולמוצר לקנייה.</p>
        <ul className="rc-edit-ings">
          {ings.map((i, n) => (
            <IngredientRow key={i.id} ing={i} first={n === 0} last={n === ings.length - 1}
              ref={(el) => { if (el) rowRefs.current.set(i.id, el); else rowRefs.current.delete(i.id); }}
              onText={(t) => onText(i, t)}
              onGrams={(g) => { gramsSet.current.add(i.id); setIng(i.id, (x) => ({ ...x, grams: g })); }}
              onLink={() => setLinking(i)}
              onUnlink={() => { gramsSet.current.delete(i.id); setIng(i.id, (x) => ({ ...x, link: null, key: null, auto: false, grams: toGrams(x.qty, x.unit, x.name) })); }}
              onConfirm={() => setIng(i.id, (x) => ({ ...x, auto: false }))}
              onMove={(by) => setIngs((list) => move(list, n, by))}
              onRemove={() => setIngs((list) => list.filter((x) => x.id !== i.id))}
              onEnter={() => addLine(i.id)} />
          ))}
        </ul>
        {ings.length < 60 ? <button type="button" className="sh-btn sh-btn--ghost" onClick={() => addLine()}><FaPlus aria-hidden /> מצרך</button> : null}
      </section>

      <section className="sh-card cal-meal rc-section">
        <header className="cal-meal-head"><h2>אופן הכנה</h2></header>
        <ol className="rc-edit-steps">
          {steps.map((s, n) => (
            <li key={n} className="rc-edit-step">
              <textarea ref={(el) => { stepRefs.current[n] = el; }} className="rc-input" rows={2} maxLength={1000} value={s} aria-label={`שלב ${n + 1}`}
                onChange={(e) => setSteps((list) => list.map((x, k) => (k === n ? e.target.value : x)))} />
              <span className="rc-edit-step-btns">
                <button type="button" className="sh-icon-btn" aria-label="למעלה" disabled={n === 0} onClick={() => setSteps((l) => move(l, n, -1))}><FaArrowUp /></button>
                <button type="button" className="sh-icon-btn" aria-label="למטה" disabled={n === steps.length - 1} onClick={() => setSteps((l) => move(l, n, 1))}><FaArrowDown /></button>
                <button type="button" className="sh-icon-btn" aria-label="מחיקת שלב" onClick={() => setSteps((l) => l.filter((_, k) => k !== n))}><FaTimes /></button>
              </span>
            </li>
          ))}
        </ol>
        {steps.length < 40 ? (
          <button type="button" className="sh-btn sh-btn--ghost" onClick={() => { setSteps((l) => [...l, '']); setFocusStep(steps.length); }}>
            <FaPlus aria-hidden /> שלב
          </button>
        ) : null}
      </section>

      <label className="cal-field rc-field">
        <span>הערות</span>
        <textarea className="rc-input" rows={3} maxLength={2000} value={details.notes} onChange={(e) => setDetails({ ...details, notes: e.target.value })} />
      </label>

      {linking ? (
        <LinkPicker name={linking.name || linking.text} mode={can.calories ? 'nutrition' : 'product'}
          onLinked={(l) => linked(linking, l)} onClose={() => setLinking(null)} />
      ) : null}
    </div>
  );
}
