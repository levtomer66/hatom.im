'use client';

// The caller's import requests at the top of the book: waiting / importing,
// then a link to the new recipe or why it failed. Polls while one is open.

import Link from 'next/link';
import { FaTimes } from 'react-icons/fa';
import type { ImportRequest } from '@/lib/recipes/imports';

const label = (r: ImportRequest) => {
  if (r.prompt) return r.prompt.slice(0, 60);
  if (r.url) { try { return new URL(r.url).hostname.replace(/^www\./, ''); } catch { /* fall through */ } }
  return r.text.slice(0, 40) || 'מתכון';
};

export default function ImportsList({ imports, onDismiss }: { imports: ImportRequest[]; onDismiss: (id: string) => void }) {
  if (!imports.length) return null;
  return (
    <section className="sh-card cal-meal rc-imports" aria-label="ייבואים">
      <ul className="cal-entries">
        {imports.map((r) => (
          <li key={r.id} className="cal-entry rc-import">
            <span className="cal-entry-name">
              {r.status === 'done' && r.recipeId
                ? <Link href={`/recipes/${r.recipeId}`} className="cal-link">✓ המתכון יובא — לפתיחה</Link>
                : r.status === 'failed' ? <span className="rc-import-fail">הייבוא נכשל</span>
                : <span className="rc-import-wait"><span className="sh-spinner" aria-hidden /> {r.status === 'working' ? 'מייבא…' : 'ממתין לייבוא…'}</span>}
              <small dir="auto">{label(r)}{r.status === 'failed' && r.error ? ` — ${r.error}` : ''}</small>
            </span>
            {r.status !== 'working'
              ? <button type="button" className="sh-icon-btn" aria-label={r.status === 'queued' ? 'ביטול הייבוא' : 'הסרה'} onClick={() => onDismiss(r.id)}><FaTimes /></button>
              : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
