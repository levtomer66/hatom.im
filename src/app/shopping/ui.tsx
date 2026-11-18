'use client';

// Small pieces shared by the /shopping page and its "אני בסופר" screen
// (Here.tsx): money and date formats, the product photo, the sale mark,
// the favorite-store star.

import React, { useState } from 'react';
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
