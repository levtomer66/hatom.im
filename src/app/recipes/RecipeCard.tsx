'use client';

import Link from 'next/link';
import type { RecipeSummary } from '@/lib/recipes/types';

/** A recipe in the book or the feed: photo, name, time, kcal per serving. */
export default function RecipeCard({ r, showOwner }: { r: RecipeSummary; showOwner: boolean }) {
  const total = (r.prepMin ?? 0) + (r.cookMin ?? 0);
  return (
    <Link href={`/recipes/${r.id}`} className="rc-card">
      {r.photo
        ? <img className="rc-card-photo" src={r.photo} alt="" loading="lazy" />
        : <span className="rc-card-photo rc-card-blank" aria-hidden>{r.name.trim().charAt(0) || '🍳'}</span>}
      <span className="rc-card-body">
        <strong className="rc-card-name">{r.name}</strong>
        <span className="rc-card-meta">
          {total ? <span>⏱ {total} דק׳</span> : null}
          {r.kcal !== null ? <span>🔥 {r.partial ? '~' : ''}{r.kcal.toLocaleString('he-IL')} למנה</span> : null}
          {showOwner && r.ownerName ? <span>מאת {r.ownerName}</span> : null}
          {!showOwner && r.shared ? <span>בפיד</span> : null}
        </span>
      </span>
    </Link>
  );
}
