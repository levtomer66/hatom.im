'use client';

// "המוצרים שלי": the products the household usually buys, each with its usual
// quantity, in a sheet opened from the button under the search. Search and
// scan on the page add here; "מה חסר?" builds the list from it. Removing an
// item here leaves this shop's list alone. The list's nutrition summary
// (when turned on in ⚙) lives here too, to keep the page itself minimal.
import { useEffect, useRef, type ReactNode } from 'react';
import { FaMinus, FaPlus, FaTimes, FaTrash } from 'react-icons/fa';
import { normalizeQty, type MyItem } from '@/lib/shopping/home';
import type { HomeMeta } from './home-client';
import { Thumb } from './ui';

const step = (w: boolean) => (w ? 0.5 : 1);

export default function MyItemsSheet({ items, meta, onChange, onClose, children }: {
  items: MyItem[];
  meta: HomeMeta;
  onChange: (items: MyItem[]) => void;
  onClose: () => void;
  /** Shown above the items (the list's nutrition summary). */
  children?: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stepQty = (key: string, dir: 1 | -1) =>
    onChange(items.map((i) => (i.key === key ? { ...i, qty: normalizeQty(i.qty + dir * step(i.w), i.w) ?? i.qty } : i)));
  const remove = (key: string) => onChange(items.filter((i) => i.key !== key));

  return (
    <div className="sh-sheet-backdrop" onClick={onClose}>
      <div className="sh-sheet sh-myitems" role="dialog" aria-modal="true" aria-labelledby="sh-myitems-title" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} type="button" className="sh-icon-btn sh-sheet-close" onClick={onClose} aria-label="סגירה"><FaTimes /></button>
        <h2 id="sh-myitems-title" className="sh-h2">המוצרים שלי <small>{items.length}</small></h2>
        {children}
        {!items.length && <p className="sh-empty">עוד אין מוצרים. חפשו מוצר או סרקו ברקוד ולחצו ״+ למוצרים שלי״.</p>}
        <ul className="sh-items">
          {items.map((i) => {
            const atMin = normalizeQty(i.qty - step(i.w), i.w) === null;
            return (
              <li key={i.key} className="sh-item">
                <Thumb src={meta[i.key]?.img} size={40} by={meta[i.key]?.imgBy} />
                <span className="sh-item-name">{i.name}</span>
                <span className="sh-stepper" aria-label="כמות רגילה">
                  <button type="button" onClick={() => stepQty(i.key, 1)} aria-label={`עוד ${i.name}`}><FaPlus /></button>
                  <span className="sh-qty" aria-live="polite">{i.w ? `${i.qty} ק״ג` : i.qty}</span>
                  <button type="button" onClick={() => stepQty(i.key, -1)} disabled={atMin} aria-label={`פחות ${i.name}`}><FaMinus /></button>
                </span>
                <button type="button" className="sh-icon-btn sh-myitems-remove" onClick={() => remove(i.key)} aria-label={`הסרה מהמוצרים שלי: ${i.name}`}>
                  <FaTrash />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
