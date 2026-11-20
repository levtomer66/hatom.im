'use client';

// Small pieces shared by the /shopping page and its "אני בסופר" screen
// (Here.tsx): money and date formats, the product photo, the sale mark,
// the favorite-store star, and dragging a bottom sheet down to close it.

import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { FaRegStar, FaShoppingBasket, FaStar } from 'react-icons/fa';
import type { StoreInfo } from '@/lib/shopping/api-types';

const money = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 });
export const ils = (agorot: number) => money.format(agorot / 100);

export const dayMonth = (local: string) => `${Number(local.slice(8, 10))}.${Number(local.slice(5, 7))}`;
export const qtyLabel = (qty: number, w: boolean) => (w ? `${qty} ק״ג` : `×${qty}`);
export const storeName = (s: StoreInfo | undefined) => (s ? `${s.chainName} ${s.name}` : '?');

/**
 * The street part of an official address. Some files append notes
 * ("הרצל 91,עובר להרצל 114)"), so keep the text before the first comma or
 * parenthesis.
 */
export const cleanAddress = (a: string | null | undefined) => {
  const t = (a ?? '').split(/[,(]/)[0].replace(/[()]/g, '').trim();
  return /^(unknown|לא ידוע|-+|0)$/i.test(t) ? '' : t; // placeholders some files use
};

/** Wolt's image proxy resizes on `?w=`; the menu-image CDN has no resize, so it's shown small. */
const sized = (src: string, px: number) =>
  src.startsWith('https://imageproxy.wolt.com/') ? `${src}${src.includes('?') ? '&' : '?'}w=${px * 2}` : src;

/**
 * Photo links that failed to load this visit (the ingest's assumed Rami Levy
 * CDN links 403 for ~9% of barcodes): shown as no photo everywhere after
 * that, never requested again.
 */
const broken = new Set<string>();
/** Whether a photo link is known not to load. */
export const photoBroken = (src: string | null | undefined) => !src || broken.has(src);

/**
 * A product photo, or a quiet basket mark when there's none (most items) or
 * it fails to load (no broken-image icon, same box, no retry). `onFail` lets
 * a caller hide what belongs to the photo (its credit).
 * `by: 'name'` = a photo borrowed from a same-named product: dashed frame, "תמונה להמחשה" on hover.
 */
export function Thumb({ src, size, by, onFail }: {
  src: string | null | undefined; size: number; by?: string | null; onFail?: () => void;
}) {
  // The link that failed, so a reused Thumb showing another product tries that one.
  const [failed, setFailed] = useState<string | null>(null);
  const box = { width: size, height: size };
  if (!src || failed === src || broken.has(src)) {
    return <span className="sh-thumb is-empty" style={box} aria-hidden><FaShoppingBasket /></span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- plain <img>: external photos, no optimizer
    <img className={by === 'name' ? 'sh-thumb is-illus' : 'sh-thumb'} src={sized(src, size)}
             title={by === 'name' ? 'תמונה להמחשה' : undefined} width={size} height={size} style={box}
      alt="" loading="lazy" decoding="async" onError={() => {
        broken.add(src);
        setFailed(src);
        onFail?.();
      }} />
  );
}

/**
 * A small mark beside a price saying a deal is in play: "מבצע" when it lowers
 * this price, "מבצע בכמות" when buying more would trigger one, "מבצע מותנה"
 * for a club, coupon or basket-minimum deal. Its terms show on hover/tap.
 */
/**
 * A unit price that takes buying several ("2 ב-10" → ₪5): the asterisk beside
 * it, and the line that explains it where the deal's terms show (hover/tap).
 */
export const multiNote = (m: { qty: number; unit: number; total: number }) =>
  `* ${ils(m.unit)} ליח׳ בקנייה של ${m.qty} (${ils(m.total)} ל־${m.qty})`;
export const MultiStar = () => <span className="sh-star" aria-hidden>*</span>;

export function SaleLabel({ applied, idle, offers }: { applied: boolean; idle: boolean; offers: boolean }) {
  if (applied) return <span className="sh-sale is-on">מבצע</span>;
  if (idle) return <span className="sh-sale">מבצע בכמות</span>;
  if (offers) return <span className="sh-sale">מבצע מותנה</span>;
  return null;
}

/** ☆ / ★ on a store row: one tap adds or removes the household's favorite. Its own button, so it never opens the row. */
export function FavStar({ on, name, onToggle }: { on: boolean; name: string; onToggle: () => void }) {
  return (
    <button type="button" className={`sh-icon-btn sh-fav ${on ? 'is-on' : ''}`} aria-pressed={on}
      aria-label={`${on ? 'הסרה מהמועדפות' : 'הוספה למועדפות'}: ${name}`}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}>
      {on ? <FaStar aria-hidden /> : <FaRegStar aria-hidden />}
    </button>
  );
}

/** Pulled this far (px), or flicked faster than SWIPE_SPEED (px/ms), a sheet closes; a shorter pull springs back. */
const SWIPE_CLOSE_PX = 90;
const SWIPE_SPEED = 0.6;
const SWIPE_MS = 200;

/**
 * Drag a bottom sheet down to close it: from the top of its scroll (so a pull
 * inside a scrolled list still scrolls), the sheet follows the finger and the
 * backdrop fades; let go past SWIPE_CLOSE_PX or with a flick and it slides out,
 * then `onClose`. `sheet` is the scrolling sheet element, inside its backdrop.
 */
export function useSwipeToClose(sheet: React.RefObject<HTMLElement | null>, onClose: () => void) {
  // The latest onClose, so a page re-render mid-drag doesn't rebind the listeners and drop the gesture.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const backdrop = el.parentElement;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let startX = 0, startY = 0, startT = 0, dy = 0, dragging = false, tracking = false;
    const set = (y: number, animate: boolean) => {
      el.style.transition = animate ? `transform ${SWIPE_MS}ms ease-out` : 'none';
      el.style.transform = y ? `translateY(${y}px)` : '';
      if (backdrop) {
        backdrop.style.transition = animate ? `opacity ${SWIPE_MS}ms ease-out` : 'none';
        backdrop.style.opacity = y ? String(Math.max(0.2, 1 - y / Math.max(el.offsetHeight, 1))) : '';
      }
    };
    const onStart = (e: TouchEvent) => {
      tracking = el.scrollTop <= 0 && e.touches.length === 1;
      dragging = false;
      dy = 0;
      startX = e.touches[0]?.clientX ?? 0;
      startY = e.touches[0]?.clientY ?? 0;
      startT = e.timeStamp;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const d = (e.touches[0]?.clientY ?? startY) - startY;
      const dx = (e.touches[0]?.clientX ?? startX) - startX;
      // A sideways swipe is a row's (swipe to remove), not the sheet's.
      if (!dragging && Math.abs(dx) > Math.abs(d)) { tracking = false; return; }
      if (!dragging && (d <= 0 || el.scrollTop > 0)) { tracking = d <= 0 ? false : tracking; return; }
      dragging = true;
      dy = Math.max(0, d);
      e.preventDefault(); // the sheet moves instead of the page bouncing
      set(dy, false);
    };
    const onEnd = (e: TouchEvent) => {
      if (!dragging) return;
      dragging = tracking = false;
      const speed = dy / Math.max(e.timeStamp - startT, 1);
      if (dy > SWIPE_CLOSE_PX || speed > SWIPE_SPEED) {
        if (still) return close.current();
        set(el.offsetHeight, true);
        window.setTimeout(() => close.current(), SWIPE_MS);
      } else {
        set(0, !still);
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [sheet]);
}

/** A row swiped this share of its width toward the left is removed on release; less springs back. */
const SWIPE_REMOVE_SHARE = 0.35;

/**
 * A list row you swipe from right to left to remove, like an iPhone list: the
 * row follows the finger over a red "remove" layer, and let go past
 * SWIPE_REMOVE_SHARE of its width it slides out and `onRemove` runs; a
 * shorter swipe springs back. Up-and-down drags still scroll (touch-action:
 * pan-y). `className` goes on the row's content (the visible row).
 */
export function SwipeRow({ className, label, onRemove, children }: {
  className: string;
  /** Shown on the red layer, e.g. "הסרה מהמוצרים שלי". */
  label: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  const row = useRef<HTMLDivElement>(null);
  const g = useRef({ x: 0, y: 0, dx: 0, axis: null as 'x' | 'y' | null });
  const move = (x: number, animate: boolean) => {
    const el = row.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 0.2s ease-out' : 'none';
    el.style.transform = x ? `translateX(${x}px)` : '';
  };
  return (
    <li className="sh-swipe">
      <div className="sh-swipe-under" aria-hidden><span>{label}</span></div>
      <div
        ref={row}
        className={`sh-swipe-row ${className}`}
        onTouchStart={(e) => { g.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, axis: null }; }}
        onTouchMove={(e) => {
          const s = g.current;
          const dx = e.touches[0].clientX - s.x;
          const dy = e.touches[0].clientY - s.y;
          if (!s.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
          if (s.axis !== 'x') return;
          s.dx = Math.min(0, dx); // toward the left only
          move(s.dx, false);
        }}
        onTouchEnd={() => {
          const s = g.current;
          if (s.axis !== 'x') return;
          const width = row.current?.offsetWidth ?? 1;
          if (-s.dx > width * SWIPE_REMOVE_SHARE) {
            move(-width, true);
            window.setTimeout(onRemove, 200);
          } else {
            move(0, true);
          }
          s.axis = null;
        }}
      >
        {children}
      </div>
    </li>
  );
}
