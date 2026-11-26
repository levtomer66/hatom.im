'use client';

// Cooking mode: one step at a time in large type, swipe or ‹ › to move, the
// ingredients (for the chosen servings) a tap away to cross off. Keeps the
// screen awake where the browser allows it.

import { useEffect, useRef, useState } from 'react';
import { FaChevronLeft, FaChevronRight, FaListUl, FaTimes } from 'react-icons/fa';
import { scaleLine } from '@/lib/recipes/scale';
import type { Recipe } from '@/lib/recipes/types';

type WakeLock = { release: () => Promise<void> };

export default function CookMode({ recipe, servings, onClose }: { recipe: Recipe; servings: number; onClose: () => void }) {
  const steps = recipe.steps.filter((s) => s.trim());
  const lines = recipe.ingredients.filter((i) => i.text.trim() || i.name.trim());
  const [at, setAt] = useState(0);
  const [showIngs, setShowIngs] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());
  const touch = useRef<number | null>(null);
  const factor = servings / recipe.servings;

  useEffect(() => {
    let lock: WakeLock | null = null;
    let live = true;
    const ask = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } }).wakeLock;
        if (wl && document.visibilityState === 'visible') {
          const l = await wl.request('screen');
          if (live) lock = l; else void l.release();
        }
      } catch { /* not allowed: the screen may dim, nothing else breaks */ }
    };
    const onVis = () => { if (document.visibilityState === 'visible') void ask(); };
    void ask();
    document.addEventListener('visibilitychange', onVis);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onVis);
      document.body.style.overflow = prev;
      void lock?.release().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // RTL: ← is the next step.
      if (e.key === 'ArrowLeft') setAt((n) => Math.min(steps.length - 1, n + 1));
      if (e.key === 'ArrowRight') setAt((n) => Math.max(0, n - 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, steps.length]);

  const next = () => setAt((n) => Math.min(steps.length - 1, n + 1));
  const prev = () => setAt((n) => Math.max(0, n - 1));

  return (
    <div className="rc-cook" role="dialog" aria-modal="true" aria-label={`בישול: ${recipe.name}`}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        // RTL: swiping right brings the next step in from the left.
        if (dx > 50) next();
        if (dx < -50) prev();
      }}>
      <header className="rc-cook-head">
        <button type="button" className="sh-icon-btn" aria-label="יציאה ממצב בישול" onClick={onClose}><FaTimes /></button>
        <strong className="rc-cook-title">{recipe.name}</strong>
        <button type="button" className={`sh-icon-btn ${showIngs ? 'is-on' : ''}`} aria-label="מצרכים" aria-expanded={showIngs} onClick={() => setShowIngs((v) => !v)}><FaListUl /></button>
      </header>
      {showIngs ? (
        <ul className="rc-cook-ings">
          {lines.map((i) => (
            <li key={i.id}>
              <button type="button" className={done.has(i.id) ? 'is-done' : ''} aria-pressed={done.has(i.id)}
                onClick={() => setDone((s) => { const n = new Set(s); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); return n; })}>
                {scaleLine(i, factor)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="rc-cook-step" aria-live="polite">
        {steps.length ? <><small>שלב {at + 1} מתוך {steps.length}</small><p>{steps[at]}</p></> : <p>אין שלבים במתכון.</p>}
      </div>
      <footer className="rc-cook-nav">
        <button type="button" className="sh-btn" disabled={at === 0} onClick={prev}><FaChevronRight aria-hidden /> הקודם</button>
        <button type="button" className="sh-btn sh-btn--primary" disabled={at >= steps.length - 1} onClick={next}>הבא <FaChevronLeft aria-hidden /></button>
      </footer>
    </div>
  );
}
