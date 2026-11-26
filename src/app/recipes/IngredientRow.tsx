'use client';

// One ingredient line in edit mode: the text (parsed as you type), its link
// (🔗 → nutrition / a product), grams when linked, and moving or removing it.

import { forwardRef } from 'react';
import { FaArrowDown, FaArrowUp, FaCheck, FaLink, FaTimes } from 'react-icons/fa';
import type { Ingredient } from '@/lib/recipes/types';

const IngredientRow = forwardRef<HTMLInputElement, {
  ing: Ingredient;
  first: boolean;
  last: boolean;
  onText: (text: string) => void;
  onGrams: (g: number | null) => void;
  onLink: () => void;
  onUnlink: () => void;
  onConfirm: () => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  onEnter: () => void;
}>(function IngredientRow({ ing, first, last, onText, onGrams, onLink, onUnlink, onConfirm, onMove, onRemove, onEnter }, ref) {
  const linkedTo = ing.link?.name ?? (ing.key ? 'מוצר לקנייה' : null);
  return (
    <li className="rc-edit-ing">
      <div className="rc-edit-row">
        <input ref={ref} className="rc-input" value={ing.text} maxLength={200} placeholder="2 כוסות קמח לבן" aria-label="מצרך"
          onChange={(e) => onText(e.target.value)} enterKeyHint="next"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }} />
        <button type="button" className={`sh-icon-btn ${ing.link ? 'is-on' : ''}`} aria-label={ing.link ? 'החלפת קישור' : 'קישור לערכים תזונתיים'} onClick={onLink}><FaLink /></button>
        <span className="rc-edit-step-btns rc-move">
          <button type="button" className="sh-icon-btn" aria-label="למעלה" disabled={first} onClick={() => onMove(-1)}><FaArrowUp /></button>
          <button type="button" className="sh-icon-btn" aria-label="למטה" disabled={last} onClick={() => onMove(1)}><FaArrowDown /></button>
        </span>
        <button type="button" className="sh-icon-btn" aria-label="מחיקת מצרך" onClick={onRemove}><FaTimes /></button>
      </div>
      {linkedTo ? (
        <div className="rc-edit-link">
          <span className="cal-muted">🔗 {linkedTo}</span>
          {ing.link ? (
            <label className="rc-grams">
              <input type="number" inputMode="numeric" min={1} max={20000} value={ing.grams ?? ''} aria-label="גרם"
                onChange={(e) => { const v = Number(e.target.value); onGrams(e.target.value && v > 0 ? Math.min(20000, Math.round(v)) : null); }} />
              ג׳
            </label>
          ) : null}
          {ing.auto ? <button type="button" className="sh-chip rc-confirm" onClick={onConfirm}><FaCheck aria-hidden /> נכון</button> : null}
          <button type="button" className="sh-link" onClick={onUnlink}>ביטול קישור</button>
        </div>
      ) : null}
      {ing.orig ? <small className="rc-orig" dir="auto">{ing.orig}</small> : null}
    </li>
  );
});

export default IngredientRow;
