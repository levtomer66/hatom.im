'use client';

import Link from 'next/link';
import type { RecipeSummary } from '@/lib/recipes/types';
import { Thumb } from '../shopping/ui';

/** A recipe in the book or the feed, as a row like a calories entry: photo, name, time, kcal per serving. */
export default function RecipeCard({ r, showOwner }: { r: RecipeSummary; showOwner: boolean }) {
  const total = (r.prepMin ?? 0) + (r.cookMin ?? 0);
  const meta = [total ? `⏱ ${total} דק׳` : '', showOwner && r.ownerName ? `מאת ${r.ownerName}` : '', !showOwner && r.shared ? 'בפיד' : '', r.tags.slice(0, 3).join(' · ')]
    .filter(Boolean).join(' · ');
  return (
    <li className="cal-entry">
      <Link href={`/recipes/${r.id}`} className="cal-entry-btn rc-row">
        {r.photo ? <Thumb src={r.photo} size={48} /> : <span className="rc-row-blank" aria-hidden>{r.name.trim().charAt(0) || '🍳'}</span>}
        <span className="cal-entry-name">{r.name}{meta ? <small>{meta}</small> : null}</span>
        {r.kcal !== null ? <span className="cal-entry-kcal">{r.partial ? '~' : ''}{r.kcal.toLocaleString('he-IL')}<small className="rc-unit">קק״ל</small></span> : null}
      </Link>
    </li>
  );
}
