'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import {
  LOAD_TYPES,
  MEASURES,
  PRODUCTS,
  PROGRAMS,
  SLOTS,
  SPOTS,
  buildSteps,
  getLoadType,
  type LoadId,
  type LoadType,
  type Slot,
} from '@/lib/laundry';
import PhotoSpot, { type PhotoTag } from './PhotoSpot';
import MeasureIcon from './MeasureIcon';

// Card swatch per load — the colour of what goes in it.
const SWATCH: Record<LoadId, string> = {
  white: 'linear-gradient(135deg, #ffffff, #e9edf5)',
  black: 'linear-gradient(135deg, #3a3a44, #0f0f14)',
  towels: 'linear-gradient(135deg, #8fd3f4, #84a9f0)',
  rugs: 'linear-gradient(135deg, #c79a6b, #8a6240)',
  colored: 'conic-gradient(#ff6b6b, #ffd93d, #6bcb77, #4d96ff, #b06bff, #ff6b6b)',
};

const SLOT_ORDER: Slot[] = ['main', 'softener', 'drum'];

const LEGEND_TAGS: PhotoTag[] = [
  { ...SPOTS.mainCompartment, text: 'II' },
  { ...SPOTS.softenerCompartment, text: 'כחול', className: 'ld-tag--blue' },
];

const smoothScroll = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

export default function LaundryPage() {
  return (
    <>
      <Navbar />
      <div className="ld-page">
        <Suspense fallback={null}>
          <Laundry />
        </Suspense>
      </div>
    </>
  );
}

// The selected load lives in `?type=` so the back button returns to the
// picker and a load's instructions can be sent as a link. The in-page back
// link replaces rather than pushes, so it doesn't stack a second picker entry.
function Laundry() {
  const router = useRouter();
  const load = getLoadType(useSearchParams().get('type'));

  const open = (id: LoadId) => {
    router.push(`/laundry?type=${id}`, { scroll: false });
    window.scrollTo({ top: 0 });
  };
  const back = () => {
    router.replace('/laundry', { scroll: false });
    window.scrollTo({ top: 0 });
  };

  return load ? <LoadGuide key={load.id} load={load} onBack={back} /> : <Picker onSelect={open} />;
}

function Picker({ onSelect }: { onSelect: (id: LoadId) => void }) {
  return (
    <>
      <header className="ld-header">
        <h1 className="ld-title">🧺 כביסה</h1>
        <p className="ld-subtitle">איזו כביסה עושים? בוחרים סוג ומקבלים הוראות צעד אחר צעד למכונה.</p>
      </header>

      <div className="ld-grid">
        {LOAD_TYPES.map((t) => (
          <button key={t.id} type="button" className="ld-type" onClick={() => onSelect(t.id)}>
            <span className="ld-swatch" style={{ background: SWATCH[t.id] }} aria-hidden />
            <span className="ld-type-name">{t.name}</span>
            <span className="ld-type-hint">{t.hint}</span>
            <span className="ld-type-settings">
              <bdi dir="ltr">{t.tempC}°</bdi> · סחיטה {t.spin}
            </span>
          </button>
        ))}
      </div>

      <section className="ld-card ld-legend">
        <h2 className="ld-h2">איפה שמים מה?</h2>
        <div className="ld-legend-photo">
          <PhotoSpot photo={{ ...SPOTS.drawerOverview, zoom: 1 }} alt="מגירת הסבון של המכונה" aspect={1} tags={LEGEND_TAGS} />
        </div>
        <ul className="ld-legend-list">
          {SLOT_ORDER.map((slot) => (
            <li key={slot}>
              <strong>{SLOTS[slot].name}:</strong>{' '}
              {Object.values(PRODUCTS)
                .filter((p) => p.slot === slot)
                .map((p) => p.name)
                .join(', ')}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function LoadGuide({ load, onBack }: { load: LoadType; onBack: () => void }) {
  const steps = useMemo(() => buildSteps(load), [load]);
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set());
  // Step to open after the last tap; null until the user has interacted, so
  // the page doesn't scroll on first render.
  const [focusId, setFocusId] = useState<string | null>(null);
  const stepRefs = useRef(new Map<string, HTMLLIElement>());

  const activeId = steps.find((s) => !done.has(s.id))?.id ?? null;
  const allDone = activeId === null;
  const program = PROGRAMS[load.program];

  const toggle = (id: string) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDone(next);
    setFocusId(steps.find((s) => !next.has(s.id))?.id ?? 'finish');
  };

  const restart = () => {
    setDone(new Set());
    setFocusId(steps[0].id);
  };

  useEffect(() => {
    if (!focusId) return;
    const el = focusId === 'finish' ? document.getElementById('ld-finish') : stepRefs.current.get(focusId);
    el?.scrollIntoView({ behavior: smoothScroll(), block: 'center' });
  }, [focusId]);

  return (
    <>
      <button type="button" className="ld-back" onClick={onBack}>
        → כל סוגי הכביסה
      </button>

      <header className="ld-header ld-header--load">
        <span className="ld-swatch ld-swatch--lg" style={{ background: SWATCH[load.id] }} aria-hidden />
        <div>
          <h1 className="ld-title">{load.name}</h1>
          <p className="ld-subtitle">{load.hint}</p>
        </div>
      </header>

      <div className="ld-settings">
        <div className="ld-setting">
          <span className="ld-setting-label">תוכנית</span>
          <span className="ld-setting-value" dir="ltr">{program.dialLabel}</span>
        </div>
        <div className="ld-setting">
          <span className="ld-setting-label">טמפרטורה</span>
          <span className="ld-setting-value" dir="ltr">{load.tempC}°</span>
        </div>
        <div className="ld-setting">
          <span className="ld-setting-label">סחיטה</span>
          <span className="ld-setting-value" dir="ltr">{load.spin}</span>
        </div>
      </div>

      <section className="ld-card">
        <h2 className="ld-h2">מה צריך</h2>
        <ul className="ld-needs">
          {load.doses.map((d) => (
            <li key={d.product} className="ld-need">
              <MeasureIcon measure={d.measure} size={36} />
              <span>
                <strong>{PRODUCTS[d.product].name}</strong>
                <span className="ld-need-where">
                  {MEASURES[d.measure].label} · {SLOTS[PRODUCTS[d.product].slot].name}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div
        className="ld-progress"
        role="progressbar"
        aria-label="התקדמות"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={done.size}
        aria-valuetext={`${done.size} מתוך ${steps.length} צעדים`}
      >
        <div className="ld-progress-bar" style={{ width: `${(done.size / steps.length) * 100}%` }} />
        <span className="ld-progress-text">
          {done.size}/{steps.length}
        </span>
      </div>

      <ol className="ld-steps">
        {steps.map((s, i) => {
          const isDone = done.has(s.id);
          const isActive = s.id === activeId;
          return (
            <li
              key={s.id}
              ref={(el) => {
                if (el) stepRefs.current.set(s.id, el);
                else stepRefs.current.delete(s.id);
              }}
              className={`ld-step${isDone ? ' ld-step--done' : ''}${isActive ? ' ld-step--active' : ''}`}
            >
              <button type="button" className="ld-step-head" onClick={() => toggle(s.id)} aria-pressed={isDone}>
                <span className="ld-step-num">{isDone ? '✓' : i + 1}</span>
                <span className="ld-step-text">
                  <span className="ld-step-title">{s.title}</span>
                  {s.detail && <span className="ld-step-detail">{s.detail}</span>}
                </span>
                {s.measure && <MeasureIcon measure={s.measure} />}
              </button>
              {!isDone && (
                <div className="ld-step-body">
                  <PhotoSpot photo={s.photo} alt={s.title} />
                  {isActive && (
                    <button type="button" className="ld-primary" onClick={() => toggle(s.id)}>
                      ✓ בוצע
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {allDone && (
        <section id="ld-finish" className="ld-card ld-finish">
          <div className="ld-finish-emoji">🎉</div>
          <h2 className="ld-h2">המכונה עובדת!</h2>
          <p className="ld-subtitle">
            {load.name} · <span dir="ltr">{program.dialLabel} · {load.tempC}° · {load.spin}</span>
          </p>
          <button type="button" className="ld-secondary" onClick={restart}>
            להתחיל מחדש
          </button>
        </section>
      )}
    </>
  );
}
