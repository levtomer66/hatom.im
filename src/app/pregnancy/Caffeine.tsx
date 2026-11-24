'use client';

// The caffeine hero (docs/superpowers/specs/2026-11-24-pregnancy-design.md § Caffeine):
// a ring of the day's mg against the limit (green, amber from 150, red over it),
// the one-tap drinks row (owner), and the day's caffeine entries — the calories
// diary's own entries, so a swipe here deletes it there too.

import React, { useState } from 'react';
import { cafLevel, drinkById, DRINKS, CAF_WARN } from '@/lib/pregnancy/drinks';
import type { CafRow } from '@/lib/pregnancy/pregnancy';
import { SwipeRow } from '../shopping/ui';

const R = 46;
const C = 2 * Math.PI * R;
const LEVEL_TEXT = { ok: 'בטווח', warn: 'מתקרבים לגבול', over: 'מעל הגבול' } as const;

export function CaffeineHero({ mg, limit, readOnly, ownerName }: { mg: number; limit: number; readOnly?: boolean; ownerName?: string }) {
  const level = cafLevel(mg, limit);
  const share = Math.min(mg / limit, 1);
  const left = limit - mg;
  return (
    <section className={`pg-caf is-${level}`} aria-label="קפאין היום">
      <div className="pg-caf-ring">
        <svg viewBox="0 0 108 108" width="116" height="116" aria-hidden>
          <circle cx="54" cy="54" r={R} className="pg-ring-track" />
          {share > 0 ? <circle cx="54" cy="54" r={R} className="pg-caf-fill" strokeDasharray={`${C * share} ${C}`} transform="rotate(-90 54 54)" /> : null}
          {/* The 150 mg mark (MoH). */}
          {CAF_WARN < limit ? (
            <line className="pg-caf-tick" x1="54" y1="4" x2="54" y2="14" transform={`rotate(${(CAF_WARN / limit) * 360} 54 54)`} />
          ) : null}
        </svg>
        <div className="pg-caf-mid"><b>{mg}</b><span>מ״ג</span></div>
      </div>
      <div className="pg-caf-text">
        <h2>☕ קפאין{readOnly && ownerName ? <small> של {ownerName}</small> : null}</h2>
        <p><b>{LEVEL_TEXT[level]}</b> · {left >= 0 ? `נשארו ${left} מ״ג` : `${-left} מ״ג מעל`} מתוך {limit}</p>
        <p className="cal-muted">משרד הבריאות: עד כ־150–200 מ״ג ביום בהריון</p>
      </div>
    </section>
  );
}

const QUICK = ['hafuch-small', 'hafuch-large', 'espresso', 'capsule', 'zero-glass', 'tea-black', 'instant', 'cola'];

export function DrinksRow({ busy, onLog }: { busy: string | null; onLog: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const list = all ? DRINKS : QUICK.map((id) => drinkById(id)!).filter(Boolean);
  return (
    <div className="pg-drinks" role="group" aria-label="הוספת משקה בלחיצה">
      {list.map((d) => (
        <button key={d.id} type="button" className="pg-drink" disabled={busy === d.id} onClick={() => onLog(d.id)}
          title={d.warn ?? undefined} aria-label={`${d.name}, ${d.mg} מ״ג${d.warn ? `. ${d.warn}` : ''}`}>
          <span className="pg-drink-emoji" aria-hidden>{d.emoji}</span>
          <span className="pg-drink-name">{d.name}</span>
          <small>{d.approx ? '~' : ''}{d.mg} מ״ג{d.warn ? ' ⚠' : ''}</small>
        </button>
      ))}
      <button type="button" className="pg-drink is-more" aria-expanded={all} onClick={() => setAll(!all)}>
        <span className="pg-drink-emoji" aria-hidden>{all ? '▴' : '…'}</span><span className="pg-drink-name">{all ? 'פחות' : 'עוד משקאות'}</span>
      </button>
    </div>
  );
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

export function CafRows({ rows, onEdit, onRemove }: { rows: CafRow[]; onEdit?: (id: string) => void; onRemove?: (id: string) => void }) {
  if (!rows.length) return <p className="cal-muted pg-caf-empty">עוד לא נרשם קפאין היום.</p>;
  return (
    <ul className="cal-entries pg-caf-rows">
      {rows.map((r) => {
        const inner = (
          <>
            <span className="pg-caf-emoji" aria-hidden>{r.emoji}</span>
            <span className="cal-entry-name">{r.name}<small>{r.qty !== 1 ? `${r.qty.toLocaleString('he-IL')} × ${r.unit} · ` : ''}{time(r.at)}</small></span>
            <span className="cal-entry-kcal">{r.mg}<small> מ״ג</small></span>
          </>
        );
        return onRemove && onEdit ? (
          <SwipeRow key={r.id} className="cal-entry" label="מחיקה" onRemove={() => onRemove(r.id)}>
            <button type="button" className="cal-entry-btn" onClick={() => onEdit(r.id)}>{inner}</button>
          </SwipeRow>
        ) : (
          <li key={r.id} className="cal-entry"><div className="cal-entry-btn">{inner}</div></li>
        );
      })}
    </ul>
  );
}
