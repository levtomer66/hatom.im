'use client';

// Nutrition facts on /shopping (docs/shopping-nutrition.md): the product
// window's section, the list's totals (shown when the ⚙ setting is on), and
// the ⚙ menu itself. Values come from the item docs' `nu` (Open Food Facts
// by barcode, checked at ingest); the package label always wins.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaCog, FaChevronDown } from 'react-icons/fa';
import { SHOPPING_API_PATH } from '@/lib/shopping/config';
import type { ItemResponse, NutritionResponse, ShoppingSettings } from '@/lib/shopping/api-types';
import {
  forGrams, HERO_NUTRIENTS, isFood, listNutrition, NUTRIENT_INFO, NUTRIENTS, proteinCost, RED_LABEL_TEXT, redLabels,
  type HeroNutrient, type Nutrition,
} from '@/lib/shopping/nutrition';

const SOURCE_TEXT: Record<Nutrition['by'], React.ReactNode> = {
  off: <>מקור: <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer">Open Food Facts</a> (ODbL)</>,
  moh: <>מקור: משרד הבריאות, מאגר התזונה הלאומי (data.gov.il)</>,
  manual: <>הוזן על ידינו מהאריזה</>,
};

const fmt = (v: number, digits: number) =>
  v.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: v >= 100 ? 0 : digits });

// ── the product window ──

const money = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 });

/**
 * "ערכים תזונתיים", collapsed at the top of the product window. Under the
 * title, even when closed: one tile, the price of the shown amount (100 g,
 * or the pack when toggled) at the cheapest store and the protein in it —
 * nothing else; opened, it leads the nutrient tiles. Opened: the red-label marks, a toggle between per 100 g (ml)
 * and the whole pack, one tile per nutrient, the source, and a reminder that
 * the package is what counts.
 */
export function NutritionPanel({ item, best }: {
  item: ItemResponse['item'];
  /** The cheapest store's price for one pack (1 kg when weighed), agorot, and the store's name. */
  best: { cost: number; store: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [perPack, setPerPack] = useState(false);
  if (!isFood(item.d)) return null;
  const nu = item.nu;
  const unit = item.liquid ? 'מ״ל' : 'גרם';
  if (!nu) {
    return (
      <section className="sh-sheet-section sh-nu">
        <h3 className="sh-section-title">ערכים תזונתיים</h3>
        <p className="sh-empty">אין לנו עדיין ערכים תזונתיים למוצר הזה.</p>
      </section>
    );
  }
  const grams = perPack && item.pack ? item.pack : 100;
  const red = redLabels(nu, item.liquid, item.d);
  const shown = NUTRIENTS.filter((k) => nu[k] !== null);
  // What the shown amount (100 g or the pack) costs at the cheapest store, and the protein in it.
  const pc = best ? proteinCost(best.cost, nu, item.pack, item.w, grams) : null;
  const proteinTile = pc && best ? (
    <li className="sh-nu-tile is-price" title={`במחיר הזול ביותר: ${best.store}${item.w ? ', לפי מחיר לק״ג' : ''}`}>
      <b>{money.format(pc.agorot / 100)}</b>
      <small>ל־{fmt(pc.protein, 1)} גרם</small>
      <span>חלבון</span>
    </li>
  ) : null;
  return (
    <section className={`sh-sheet-section sh-nu ${open ? 'is-open' : ''}`} aria-label="ערכים תזונתיים">
      <button type="button" className="sh-nu-fold" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="sh-section-title">ערכים תזונתיים</span>
        <FaChevronDown aria-hidden className={open ? 'is-open' : ''} />
      </button>
      {!open && proteinTile && <ul className="sh-nu-tiles">{proteinTile}</ul>}
      {open && (
        <>
          <div className="sh-nu-head">
            {item.pack && !item.w && (
              <div className="sh-seg sh-nu-toggle" role="tablist" aria-label="כמות">
                <button type="button" role="tab" aria-selected={!perPack} className={!perPack ? 'is-on' : ''} onClick={() => setPerPack(false)}>ל־100 {unit}</button>
                <button type="button" role="tab" aria-selected={perPack} className={perPack ? 'is-on' : ''} onClick={() => setPerPack(true)}>לאריזה ({fmt(item.pack, 0)} {unit})</button>
              </div>
            )}
            {item.w && <small className="sh-muted">ל־100 גרם</small>}
          </div>
          {red.length > 0 && (
            <p className="sh-nu-red">
              {red.map((k) => <span key={k} className="sh-nu-chip">עתיר {RED_LABEL_TEXT[k]}</span>)}
              <small>לפי הערכים, לא לפי האריזה</small>
            </p>
          )}
          <ul className="sh-nu-tiles">
            {proteinTile}
            {shown.map((k) => {
              const info = NUTRIENT_INFO[k];
              const v = forGrams(nu[k], grams)!;
              return (
                <li key={k} className={`sh-nu-tile ${red.includes(k as 'na' | 's' | 'sf') ? 'is-red' : ''} ${k === 's' || k === 'sf' ? 'is-sub' : ''}`}>
                  <b>{fmt(v, info.digits)}</b>
                  <small>{info.unit}</small>
                  <span>{info.name}</span>
                </li>
              );
            })}
          </ul>
          <p className="sh-nu-source">{SOURCE_TEXT[nu.by]}. הערכים להמחשה; הקובע הוא הסימון על האריזה.</p>
        </>
      )}
    </section>
  );
}

// ── the list's totals ──

const HERO_LABEL: Record<HeroNutrient, { name: string; unit: string; scale: (v: number) => string }> = {
  kcal: { name: 'קק״ל', unit: '', scale: (v) => fmt(v, 0) },
  p: { name: 'חלבון', unit: 'ג׳', scale: (v) => fmt(v, 0) },
  s: { name: 'סוכר', unit: 'ג׳', scale: (v) => fmt(v, 0) },
  na: { name: 'נתרן', unit: 'ג׳', scale: (v) => fmt(v / 1000, 1) },
};

/**
 * Above the list: calories, protein, sugar and sodium for the whole list
 * (each line's packs × pack size), and how many items the numbers cover.
 * Tap to see what adds the most, the red-label items and the uncovered ones.
 */
export function NutritionHero({ lines }: { lines: { key: string; qty: number; name: string }[] }) {
  const [meta, setMeta] = useState<NutritionResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<HeroNutrient>('kcal');
  const keys = useMemo(() => [...new Set(lines.map((l) => l.key))].sort().join(','), [lines]);

  useEffect(() => {
    if (!keys) return setMeta({});
    const ctl = new AbortController();
    fetch(`${SHOPPING_API_PATH}/nutrition?keys=${encodeURIComponent(keys)}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => { if (m) setMeta(m); })
      .catch(() => {});
    return () => ctl.abort();
  }, [keys]);

  if (!lines.length) return null;
  if (!meta) return <div className="sh-nu-hero is-loading" aria-label="טוען ערכים תזונתיים" />;
  const r = listNutrition(lines, meta);
  const nameOf = (k: string) => meta[k]?.name ?? lines.find((l) => l.key === k)?.name ?? k;
  const partial = r.covered * 2 < r.of;
  if (!r.of) return null; // no food on the list: nothing to sum

  return (
    <section className={`sh-nu-hero ${partial ? 'is-partial' : ''}`} aria-label="ערכים תזונתיים ברשימה">
      <button type="button" className="sh-nu-hero-main" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="sh-nu-hero-kicker">ערכים תזונתיים ברשימה {partial && <small>· חלקי</small>}</span>
        <span className="sh-nu-hero-nums">
          {HERO_NUTRIENTS.map((k) => (
            <span key={k}><b>{r.covered ? HERO_LABEL[k].scale(r.totals[k]) : '—'}</b> <small>{HERO_LABEL[k].unit} {HERO_LABEL[k].name}</small></span>
          ))}
        </span>
        <span className="sh-nu-hero-cover">
          לפי {r.covered} מתוך {r.of} מוצרים{r.red.length > 0 && <> · {r.red.length} עם סימון אדום</>}
          <FaChevronDown aria-hidden className={open ? 'is-open' : ''} />
        </span>
      </button>
      {open && (
        <div className="sh-nu-hero-more">
          <div className="sh-scroller sh-nu-hero-chips" role="tablist" aria-label="מי תורם הכי הרבה">
            {HERO_NUTRIENTS.map((k) => (
              <button key={k} type="button" role="tab" aria-selected={focus === k} className={`sh-chip ${focus === k ? 'is-on' : ''}`} onClick={() => setFocus(k)}>
                {HERO_LABEL[k].name}
              </button>
            ))}
          </div>
          {r.top[focus].length > 0 && (
            <ol className="sh-nu-hero-top">
              {r.top[focus].map((t) => (
                <li key={t.key}>
                  <span>{nameOf(t.key)}</span>
                  <b>{HERO_LABEL[focus].scale(t.amount)} {HERO_LABEL[focus].unit}</b>
                </li>
              ))}
            </ol>
          )}
          {r.red.length > 0 && (
            <p className="sh-nu-hero-line"><b>עם סימון אדום:</b> {r.red.map(nameOf).join(', ')}</p>
          )}
          {r.missing.length > 0 && (
            <p className="sh-nu-hero-line sh-muted"><b>בלי ערכים:</b> {r.missing.map(nameOf).join(', ')}</p>
          )}
          <p className="sh-nu-source">לפי Open Food Facts ומשרד הבריאות. מוצרים במשקל לפי הכמות ברשימה; מוצרים ביחידות בלי משקל לא נספרים.</p>
        </div>
      )}
    </section>
  );
}

// ── the ⚙ menu ──

/** The page's preferences, behind one gear button (like the workout app's header menu). */
export function SettingsMenu({ settings, onChange }: {
  settings: ShoppingSettings | null;
  onChange: (patch: Partial<ShoppingSettings>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="sh-settings" ref={ref}>
      <button type="button" className="sh-icon-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="true" aria-label="הגדרות">
        <FaCog />
      </button>
      {open && (
        <div className="sh-settings-pop" role="menu">
          <label className="sh-toggle">
            <input type="checkbox" checked={settings?.nutritionHero ?? false} disabled={!settings}
              onChange={(e) => onChange({ nutritionHero: e.target.checked })} />
            <span>ערכים תזונתיים ברשימה<small>קלוריות, חלבון, סוכר ונתרן לכל הרשימה</small></span>
          </label>
        </div>
      )}
    </div>
  );
}
