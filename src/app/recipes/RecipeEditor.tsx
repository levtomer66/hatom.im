'use client';

// Edit mode: no save button — each group of fields (details, ingredients,
// steps) saves through calories' useAutosave on its own PATCH, sending only
// its keys, so a quick ingredient edit and a step edit never overwrite each
// other. "סיום" sends what's still waiting and goes back to the recipe.

import { useEffect, useMemo, useRef, useState } from 'react';
import { FaArrowDown, FaArrowUp, FaCamera, FaCheck, FaPlus, FaTimes } from 'react-icons/fa';
import { newIngredient } from '@/lib/recipes/recipe';
import { toGrams } from '@/lib/recipes/units';
import type { Ingredient, Recipe } from '@/lib/recipes/types';
import { statusText, useAutosave, type SaveStatus } from '../calories/autosave';
import IngredientRow from './IngredientRow';
import LinkPicker, { type Linked } from './LinkPicker';
import { resizeImage } from './photo';
import type { Can } from './RecipeView';
import * as api from './api';

interface Details { name: string; servings: string; prepMin: string; cookMin: string; notes: string; tags: string[] }

const detailsOf = (r: Recipe): Details => ({
  name: r.name, servings: String(r.servings), prepMin: r.prepMin === null ? '' : String(r.prepMin),
  cookMin: r.cookMin === null ? '' : String(r.cookMin), notes: r.notes, tags: r.tags,
});

const minutes = (s: string): number | null | undefined => {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 1440 ? n : undefined;
};

/** The details as the PATCH sends them, or undefined while a field isn't valid (nothing is sent). */
function detailsPatch(d: Details) {
  const servings = Number(d.servings);
  const prepMin = minutes(d.prepMin);
  const cookMin = minutes(d.cookMin);
  if (!d.name.trim() || !Number.isInteger(servings) || servings < 1 || servings > 100 || prepMin === undefined || cookMin === undefined) return undefined;
  return { name: d.name.trim(), servings, prepMin, cookMin, notes: d.notes, tags: d.tags };
}

const newId = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function combine(statuses: SaveStatus[]): SaveStatus {
  if (statuses.includes('saving')) return 'saving';
  if (statuses.includes('saved')) return 'saved';
  return 'idle';
}

export default function RecipeEditor({ recipe, can, onChanged, onDone, toast }: {
  recipe: Recipe; can: Can; onChanged: (r: Recipe) => void; onDone: () => void; toast: (m: string) => void;
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
  /** Lines whose grams were set by hand (or by a link's amount): typing the text no longer re-estimates them. */
  const gramsSet = useRef(new Set(recipe.ingredients.filter((i) => i.link).map((i) => i.id)));
  const rowRefs = useRef(new Map<string, HTMLInputElement>());
  const stepRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const save = (patch: Parameters<typeof api.patchRecipe>[1]) =>
    api.patchRecipe(id, patch).then((r) => { onChanged(r); return null; }, (e: unknown) => (e instanceof Error ? e.message : 'לא נשמר'));

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

  const done = async () => {
    await Promise.all([a.flush(), b.flush(), c.flush()]);
    onDone();
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
      onChanged({ ...recipe, photo: url });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'התמונה לא עלתה');
    } finally { setPhotoBusy(false); }
  };
  const dropPhoto = async () => {
    setPhotoBusy(true);
    try {
      await api.removePhoto(id);
      setPhoto(null);
      onChanged({ ...recipe, photo: null });
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

      <div className="rc-photo-edit">
        {photo ? <img className="rc-photo" src={photo} alt="" /> : <div className="rc-photo rc-photo-empty" aria-hidden>🍳</div>}
        <div className="rc-photo-actions">
          <label className={`sh-btn ${photoBusy ? 'is-busy' : ''}`}>
            <FaCamera aria-hidden /> {photo ? 'החלפת תמונה' : 'הוספת תמונה'}
            <input type="file" accept="image/*" hidden disabled={photoBusy} onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {photo ? <button type="button" className="sh-btn sh-btn--ghost" disabled={photoBusy} onClick={() => void dropPhoto()}>הסרה</button> : null}
        </div>
      </div>

      <label className="rc-field">
        <span>שם</span>
        <input className="rc-input rc-input-name" value={details.name} maxLength={120} onChange={(e) => setDetails({ ...details, name: e.target.value })} />
      </label>
      <div className="rc-field-row">
        <label className="rc-field"><span>מנות</span>
          <input className="rc-input" type="number" inputMode="numeric" min={1} max={100} value={details.servings} onChange={(e) => setDetails({ ...details, servings: e.target.value })} />
        </label>
        <label className="rc-field"><span>הכנה (דק׳)</span>
          <input className="rc-input" type="number" inputMode="numeric" min={0} max={1440} value={details.prepMin} onChange={(e) => setDetails({ ...details, prepMin: e.target.value })} />
        </label>
        <label className="rc-field"><span>בישול (דק׳)</span>
          <input className="rc-input" type="number" inputMode="numeric" min={0} max={1440} value={details.cookMin} onChange={(e) => setDetails({ ...details, cookMin: e.target.value })} />
        </label>
      </div>

      <div className="rc-field">
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

      <section className="rc-section">
        <h2>מצרכים</h2>
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

      <section className="rc-section">
        <h2>אופן הכנה</h2>
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
          <button type="button" className="sh-btn sh-btn--ghost" onClick={() => { setSteps((l) => [...l, '']); window.setTimeout(() => stepRefs.current[steps.length]?.focus(), 0); }}>
            <FaPlus aria-hidden /> שלב
          </button>
        ) : null}
      </section>

      <label className="rc-field">
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
