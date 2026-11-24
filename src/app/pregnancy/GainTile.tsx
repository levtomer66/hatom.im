'use client';

// The pregnant owner's weight-gain tile (docs/superpowers/specs/2026-11-24-pregnancy-design.md
// § Extras): kg since the pre-pregnancy weight against the IOM band for her BMI.
// Tap it for the week-by-week line against the band. Shown on /pregnancy, and
// (through GainTileLoader) on /calories and /workout. Its own CSS, so it fits any page.

import React, { useEffect, useState } from 'react';
import type { GainView, MeResponse } from '@/lib/pregnancy/pregnancy';
import './gain.css';

const kg = (v: number) => v.toLocaleString('he-IL', { maximumFractionDigits: 1 });
const VERDICT = { in: 'בטווח', over: 'מעל הטווח', under: 'מתחת לטווח' } as const;

function Chart({ g }: { g: GainView }) {
  const W = 300;
  const H = 120;
  const maxKg = Math.max(g.band[g.band.length - 1].hi, ...g.log.map((p) => p.kg - g.preKg), 1) + 1;
  const minKg = Math.min(0, ...g.log.map((p) => p.kg - g.preKg)) - 0.5;
  // RTL: week 0 on the right.
  const x = (day: number) => W - (day / 280) * W;
  const y = (v: number) => H - ((v - minKg) / (maxKg - minKg)) * H;
  const top = g.band.map((b) => `${x(b.day).toFixed(1)},${y(b.hi).toFixed(1)}`);
  const bottom = [...g.band].reverse().map((b) => `${x(b.day).toFixed(1)},${y(b.lo).toFixed(1)}`);
  return (
    <svg className="pg-gain-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="עלייה במשקל מול הטווח המומלץ">
      <polygon className="pg-gain-band" points={[...top, ...bottom].join(' ')} />
      {[13, 27].map((w) => <line key={w} className="pg-gain-tri" x1={x(w * 7)} x2={x(w * 7)} y1={0} y2={H} />)}
      {g.log.length > 1 ? <polyline className="pg-gain-line" points={g.log.map((p) => `${x(p.day).toFixed(1)},${y(p.kg - g.preKg).toFixed(1)}`).join(' ')} /> : null}
      {g.log.map((p) => <circle key={p.day} className="pg-gain-dot" cx={x(p.day)} cy={y(p.kg - g.preKg)} r={2.5} />)}
    </svg>
  );
}

export default function GainTile({ gain }: { gain: GainView }) {
  const [open, setOpen] = useState(false);
  const sign = gain.gain > 0 ? '+' : gain.gain < 0 ? '−' : '±';
  return (
    <section className={`pg-gain is-${gain.verdict}`} aria-label="עלייה במשקל בהריון">
      <button type="button" className="pg-gain-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="pg-gain-title">🤰 עלייה במשקל</span>
        <span className="pg-gain-num"><bdi dir="ltr">{sign}{kg(Math.abs(gain.gain))}</bdi> ק״ג</span>
        <span className="pg-gain-verdict">{VERDICT[gain.verdict]}</span>
      </button>
      {open ? (
        <div className="pg-gain-body">
          <p className="pg-gain-range">הטווח להיום: {kg(gain.lo)}–{kg(gain.hi)} ק״ג · מלפני ההריון {kg(gain.preKg)} ק״ג (BMI {kg(gain.bmi)})</p>
          <Chart g={gain} />
          <p className="pg-gain-credit">הטווח לפי המלצות IOM 2009 לפי BMI שלפני ההריון. כדאי לשאול את הרופא/ה.</p>
        </div>
      ) : null}
    </section>
  );
}

/** For /calories and /workout: reads /api/pregnancy/me; renders nothing for anyone who isn't a pregnant owner. */
export function GainTileLoader() {
  const [gain, setGain] = useState<GainView | null>(null);
  useEffect(() => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    fetch(`/api/pregnancy/me?today=${today}`)
      .then((r) => (r.ok ? (r.json() as Promise<MeResponse | null>) : null))
      .then((m) => setGain(m?.gain ?? null))
      .catch(() => setGain(null));
  }, []);
  return gain ? <GainTile gain={gain} /> : null;
}
