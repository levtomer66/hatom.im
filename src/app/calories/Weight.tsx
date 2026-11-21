'use client';

// משקל: the body weight shared with the workout app (one value; changing it here
// changes it there), its change over 30 days and a small line of the weigh-ins.

import React, { useState } from 'react';
import { kgOk, type WeighIn } from '@/lib/calories/calories';

const kgText = (v: number) => v.toLocaleString('he-IL', { maximumFractionDigits: 1 });

function shiftDays(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The weigh-ins of the 30 days up to `date`, as an SVG polyline (x by day, y by kg). */
function Spark({ log, date }: { log: WeighIn[]; date: string }) {
  const from = shiftDays(date, -30);
  const pts = log.filter((w) => w.d >= from && w.d <= date);
  if (pts.length < 2) return null;
  const t0 = Date.parse(from);
  const span = Date.parse(date) - t0 || 1;
  const kgs = pts.map((p) => p.kg);
  const lo = Math.min(...kgs);
  const hi = Math.max(...kgs);
  const W = 120;
  const H = 36;
  // RTL page: the newest weigh-in sits on the left, like the week bars.
  const xy = pts.map((p) => `${(W - ((Date.parse(p.d) - t0) / span) * W).toFixed(1)},${(hi === lo ? H / 2 : 4 + (1 - (p.kg - lo) / (hi - lo)) * (H - 8)).toFixed(1)}`);
  return (
    <svg className="cal-spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden>
      <polyline points={xy.join(' ')} />
    </svg>
  );
}

export default function Weight({ kg, log, date, onSave }: {
  kg: number | null; log: WeighIn[]; date: string; onSave: (kg: number) => Promise<string | null>;
}) {
  const [editing, setEditing] = useState(kg === null);
  const [value, setValue] = useState(kg !== null ? String(kg) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const month = log.filter((w) => w.d >= shiftDays(date, -30) && w.d <= date);
  const delta = month.length >= 2 ? Math.round((month[month.length - 1].kg - month[0].kg) * 10) / 10 : null;
  const typed = Number(value.replace(',', '.'));

  const save = async () => {
    if (!kgOk(typed)) { setError('משקל בין 25 ל־400 ק״ג'); return; }
    setBusy(true);
    const err = await onSave(Math.round(typed * 10) / 10);
    setBusy(false);
    setError(err);
    if (!err) setEditing(false);
  };

  return (
    <section className="sh-card cal-weight" aria-label="משקל">
      <header className="cal-meal-head">
        <h2>משקל</h2>
        {!editing ? <button type="button" className="cal-link" onClick={() => { setValue(kg !== null ? String(kg) : ''); setEditing(true); }}>עדכון</button> : null}
      </header>
      {editing ? (
        <form className="cal-weight-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <label className="cal-field"><span>משקל היום (ק״ג) — משותף עם האימונים</span>
            <input inputMode="decimal" value={value} placeholder="75.5" autoFocus={kg !== null} onChange={(e) => setValue(e.target.value)} />
          </label>
          {error ? <p className="cal-error">{error}</p> : null}
          <button type="submit" className="sh-btn sh-btn--primary" disabled={busy || !value.trim()}>{busy ? 'שומר…' : 'שמירה'}</button>
        </form>
      ) : (
        <div className="cal-weight-row">
          <p className="cal-weight-now"><b>{kg !== null ? kgText(kg) : '—'}</b> ק״ג
            {delta !== null ? <small className={delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}><bdi dir="ltr">{delta > 0 ? '+' : delta < 0 ? '−' : '±'}{kgText(Math.abs(delta))}</bdi> ב־30 יום</small> : null}
          </p>
          <Spark log={log} date={date} />
        </div>
      )}
    </section>
  );
}
