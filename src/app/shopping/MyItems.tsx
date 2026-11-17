'use client';

// "המוצרים שלי": the products the household usually buys, each with its usual
// quantity. Search and scan on the page add here; "מה חסר?" builds the list
// from it. Removing an item here leaves this shop's list alone.
import { useState } from 'react';
import { FaChevronDown, FaMinus, FaPlus, FaTrash } from 'react-icons/fa';
import { normalizeQty, type MyItem } from '@/lib/shopping/home';
import type { HomeMeta } from './home-client';
import { Thumb } from './ui';

const step = (w: boolean) => (w ? 0.5 : 1);

export default function MyItems({ items, meta, onChange, startOpen }: {
  items: MyItem[];
  meta: HomeMeta;
  onChange: (items: MyItem[]) => void;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!startOpen);
  const stepQty = (key: string, dir: 1 | -1) =>
    onChange(items.map((i) => (i.key === key ? { ...i, qty: normalizeQty(i.qty + dir * step(i.w), i.w) ?? i.qty } : i)));
  const remove = (key: string) => onChange(items.filter((i) => i.key !== key));

  return (
    <section className="sh-card sh-myitems">
      <button type="button" className="sh-myitems-head" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="sh-myitems-body">
        <span>המוצרים שלי <small>· {items.length}</small></span>
        <FaChevronDown aria-hidden className={open ? 'is-open' : ''} />
      </button>
      {open && (
        <div id="sh-myitems-body">
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
      )}
    </section>
  );
}
