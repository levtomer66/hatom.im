'use client';

// The week hero (docs/superpowers/specs/2026-11-24-pregnancy-design.md § The week):
// a ring of the 280 days around "12+3", the words under it, trimester · days to
// go · due date, and the size line that opens the stage sheet (her scan for the
// week first, then a freely licensed illustration with its credit).

import React, { useRef, useState } from 'react';
import { heDate, TRIMESTER_NAMES, trimester, wdText, weekDay, PREGNANCY_DAYS } from '@/lib/pregnancy/dates';
import { sizeFor, sizeText } from '@/lib/pregnancy/sizes';
import { stageFor } from '@/lib/pregnancy/stages';
import type { Pregnancy } from '@/lib/pregnancy/pregnancy';
import Sheet from '../calories/Sheet';
import * as api from './api';

const R = 58;
const C = 2 * Math.PI * R;

export default function WeekHero({ p, day, onOpen }: { p: Pregnancy; day: number; onOpen: (week: number) => void }) {
  const { w, d } = weekDay(day);
  const left = PREGNANCY_DAYS - day;
  const size = sizeFor(w);
  if (day < 0) return <section className="sh-card pg-hero is-off"><p>ההריון עוד לא התחיל לפי התאריכים. כדאי לבדוק את התאריך ב־⚙.</p></section>;
  if (day > 294) return <section className="sh-card pg-hero is-off"><p>עברו 42 שבועות מתחילת ההריון. אם הלידה כבר הייתה, אפשר לסמן ב־⚙ 🎉</p></section>;
  const share = Math.min(day / PREGNANCY_DAYS, 1);
  return (
    <section className="pg-hero" aria-label="שבוע ההריון">
      <div className="pg-hero-ring">
        <svg viewBox="0 0 136 136" width="168" height="168" aria-hidden>
          <circle cx="68" cy="68" r={R} className="pg-ring-track" />
          <circle cx="68" cy="68" r={R} className="pg-ring-fill" strokeDasharray={`${C * share} ${C}`} transform="rotate(-90 68 68)" />
        </svg>
        <div className="pg-hero-mid">
          <b><bdi dir="ltr">{w}+{d}</bdi></b>
          <span>שבוע</span>
        </div>
      </div>
      <p className="pg-hero-words">{wdText(day)}</p>
      <p className="pg-hero-line">
        {TRIMESTER_NAMES[trimester(day)]} · {left === 1 ? 'עוד יום אחד' : left > 0 ? `עוד ${left} ימים` : left === 0 ? 'היום התאריך המשוער!' : `${-left} ימים אחרי התאריך`} · תאריך משוער {heDate(p.edd)}
      </p>
      {size ? (
        <button type="button" className="pg-size" onClick={() => onOpen(w)}>
          <span className="pg-size-emoji" aria-hidden>{size.emoji}</span>
          <span>בגודל של <b>{size.fruit}</b><small>{sizeText(size)}</small></span>
          <span className="pg-size-more" aria-hidden>‹</span>
        </button>
      ) : null}
    </section>
  );
}

export function StageSheet({ p, week, onChange, onClose }: { p: Pregnancy; week: number; onChange: (p: Pregnancy) => void; onClose: () => void }) {
  const [shown, setShown] = useState(week);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const size = sizeFor(shown);
  const stage = stageFor(shown);
  const scan = p.scans[String(shown)];

  const upload = async (f: File) => {
    setBusy(true);
    setError(null);
    try {
      onChange((await api.uploadScan(shown, f)).p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ההעלאה נכשלה');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      onChange((await api.deleteScan(shown)).p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא נמחק');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={`שבוע ${shown}`} onClose={onClose} className="pg-stage">
      <div className="pg-stage-nav">
        <button type="button" className="sh-icon-btn" aria-label="שבוע קודם" disabled={shown <= 4} onClick={() => setShown(shown - 1)}>›</button>
        {size ? <p className="pg-stage-size"><span aria-hidden>{size.emoji}</span> בגודל של <b>{size.fruit}</b> · {sizeText(size)}</p> : <p />}
        <button type="button" className="sh-icon-btn" aria-label="שבוע הבא" disabled={shown >= 40} onClick={() => setShown(shown + 1)}>‹</button>
      </div>
      {scan ? (
        <figure className="pg-stage-fig">
          {/* A plain <img>: the Blob URL is public, and the optimizer adds nothing for one photo. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={scan.url} alt={`הסריקה משבוע ${shown}`} />
          <figcaption>הסריקה שלנו · <button type="button" className="cal-link" disabled={busy} onClick={() => void remove()}>מחיקה</button></figcaption>
        </figure>
      ) : null}
      {stage ? (
        <figure className="pg-stage-fig">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={stage.img} alt={`איור של שלב ההתפתחות בסביבות שבוע ${stage.week}`} loading="lazy" referrerPolicy="no-referrer" />
          <figcaption>
            {stage.week !== shown ? `איור לשבוע ${stage.week} (הקרוב ביותר) · ` : ''}
            <a href={stage.page} target="_blank" rel="noopener noreferrer">{stage.author}</a>, {stage.license}, ויקישיתוף
          </figcaption>
        </figure>
      ) : null}
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
      <button type="button" className="sh-btn cal-wide" disabled={busy} onClick={() => file.current?.click()}>
        📷 {busy ? 'מעלה…' : scan ? 'החלפת הסריקה' : 'העלאת סריקה לשבוע הזה'}
      </button>
      {error ? <p className="cal-error" role="alert">{error}</p> : null}
      <p className="cal-muted pg-note">גדלים ממוצעים להמחשה בלבד (עד שבוע 19 מהראש לעכוז, מ־20 עד העקב).</p>
    </Sheet>
  );
}
