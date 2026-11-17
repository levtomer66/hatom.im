'use client';

// Small pieces shared by the /shopping page and its "אני בסופר" screen
// (Here.tsx): money and date formats, the product photo, the sale mark.

import React, { useState } from 'react';
import { FaShoppingBasket } from 'react-icons/fa';
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

/** A product photo, or a quiet basket mark when there's none (most items) or it fails to load. */
/** `by: 'name'` = a photo borrowed from a same-named product: dashed frame, "תמונה להמחשה" on hover. */
export function Thumb({ src, size, by }: { src: string | null | undefined; size: number; by?: string | null }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (!src || failed) {
    return <span className="sh-thumb is-empty" style={box} aria-hidden><FaShoppingBasket /></span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- plain <img>: external photos, no optimizer
    <img className={by === 'name' ? 'sh-thumb is-illus' : 'sh-thumb'} src={sized(src, size)}
             title={by === 'name' ? 'תמונה להמחשה' : undefined} width={size} height={size} style={box}
      alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
  );
}

/**
 * A small mark beside a price saying a deal is in play: "מבצע" when it lowers
 * this price, "מבצע בכמות" when buying more would trigger one, "מבצע מותנה"
 * for a club, coupon or basket-minimum deal. Its terms show on hover/tap.
 */
export function SaleLabel({ applied, idle, offers }: { applied: boolean; idle: boolean; offers: boolean }) {
  if (applied) return <span className="sh-sale is-on">מבצע</span>;
  if (idle) return <span className="sh-sale">מבצע בכמות</span>;
  if (offers) return <span className="sh-sale">מבצע מותנה</span>;
  return null;
}
