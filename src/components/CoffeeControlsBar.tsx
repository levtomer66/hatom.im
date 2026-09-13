'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Courier_Prime } from 'next/font/google';
import {
  CoffeeControls,
  CoffeeFilters,
  SortMetric,
  SortPerspective,
  SortSpec,
  COFFEE_TAGS,
  COFFEE_AREAS,
} from '@/types/coffee';

const courier = Courier_Prime({ subsets: ['latin'], weight: ['400', '700'] });

interface CoffeeControlsBarProps {
  controls: CoffeeControls;
  onChange: (c: CoffeeControls) => void;
}

const SORT_METRIC_OPTIONS: { value: SortMetric; label: string }[] = [
  { value: 'coffee', label: 'קפה' },
  { value: 'overall', label: 'כללי' },
  { value: 'food', label: 'אוכל' },
  { value: 'pastry', label: 'מאפים' },
  { value: 'atmosphere', label: 'אווירה' },
  { value: 'value', label: 'שווי' },
  { value: 'coffeePrice', label: 'מחיר קפה' },
  { value: 'date', label: 'תאריך' },
  { value: 'name', label: 'שם' },
];

const PERSPECTIVE_OPTIONS: { value: SortPerspective; label: string }[] = [
  { value: 'combined', label: 'משולב' },
  { value: 'tom', label: 'תום' },
  { value: 'tomer', label: 'תומר' },
];

// These metrics aren't per-reviewer, so the perspective control is meaningless
// for them — greyed rather than hidden, so the layout doesn't jump.
const NO_PERSPECTIVE_METRICS = new Set<SortMetric>(['coffeePrice', 'date', 'name']);

const PRICE_TIERS: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: '₪' },
  { value: 2, label: '₪₪' },
  { value: 3, label: '₪₪₪' },
];

const INK = '#3a2a10';
const CREAM = '#fdf6e3';
const MUTED = '#8a7050';

// Soft, borderless pill — a filled ink pill when active, a barely-there wash when
// not. No outline, so a row of chips reads as one scannable group, not a grid of
// boxes.
function chip(active: boolean): React.CSSProperties {
  return {
    fontSize: '12px',
    lineHeight: 1.2,
    padding: '6px 12px',
    borderRadius: '999px',
    border: 'none',
    background: active ? INK : 'rgba(120,80,20,0.08)',
    color: active ? CREAM : '#6a4e28',
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    whiteSpace: 'nowrap',
  };
}

const groupLabel: React.CSSProperties = {
  fontSize: '10px',
  color: MUTED,
  marginBottom: '7px',
  display: 'block',
};

// One segment of a segmented control (perspective / direction).
function segment(active: boolean, disabled = false): React.CSSProperties {
  return {
    flex: 1,
    padding: '6px 10px',
    fontSize: '12px',
    border: 'none',
    background: active ? INK : 'transparent',
    color: active ? CREAM : disabled ? '#bcae90' : '#6a4e28',
    fontWeight: active ? 700 : 400,
    cursor: disabled ? 'default' : 'pointer',
    transition: 'background 0.15s, color 0.15s',
    whiteSpace: 'nowrap',
  };
}

const segmentTrack: React.CSSProperties = {
  display: 'flex',
  gap: '2px',
  padding: '2px',
  borderRadius: '999px',
  background: 'rgba(120,80,20,0.10)',
};

// Sort + filter controls for the discovery UI. Fully controlled — every
// interaction produces a brand-new CoffeeControls object and hands it to
// onChange; the page owns the state and syncs it to the URL + localStorage.
const CoffeeControlsBar: React.FC<CoffeeControlsBarProps> = ({ controls, onChange }) => {
  const { sort, filters } = controls;
  const perspectiveDisabled = NO_PERSPECTIVE_METRICS.has(sort.metric);

  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close the sort popover on an outside click or Escape.
  useEffect(() => {
    if (!sortOpen) return;
    const onDown = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSortOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [sortOpen]);

  const patchSort = (patch: Partial<SortSpec>) => onChange({ sort: { ...sort, ...patch }, filters });
  const patchFilters = (patch: Partial<CoffeeFilters>) => onChange({ sort, filters: { ...filters, ...patch } });

  const toggleIn = <T,>(list: T[] | undefined, value: T): T[] | undefined => {
    const arr = list ?? [];
    const next = arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
    return next.length ? next : undefined;
  };

  const metricLabel = SORT_METRIC_OPTIONS.find((o) => o.value === sort.metric)?.label ?? '';
  const perspectiveLabel = PERSPECTIVE_OPTIONS.find((o) => o.value === sort.perspective)?.label ?? '';
  const sortSummary =
    metricLabel +
    (!perspectiveDisabled && sort.perspective !== 'combined' ? ` · ${perspectiveLabel}` : '') +
    (sort.dir === 'asc' ? ' ↑' : ' ↓');

  return (
    <details
      open
      className={courier.className}
      style={{
        background: 'linear-gradient(160deg, #fdf6e3, #f5e8c8)',
        border: '1px solid #c4a870',
        boxShadow: '0 4px 16px rgba(100,60,10,0.1)',
        padding: '16px 20px',
        marginBottom: '32px',
      }}
    >
      <summary style={{ cursor: 'pointer', fontSize: '11px', letterSpacing: '0.08em', color: '#5a3a10', fontWeight: 700 }}>
        חיפוש וסינון
      </summary>

      <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '18px', direction: 'rtl' }}>
        {/* Sort button (at the RTL start) + search. The button leads so its
            popover opens into the panel, never off the edge. */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Sort — behind a funnel button, opens an anchored popover */}
          <div ref={sortRef} style={{ position: 'relative', flex: '0 0 auto' }}>
            <button
              type="button"
              onClick={() => setSortOpen((o) => !o)}
              aria-haspopup="true"
              aria-expanded={sortOpen}
              className={courier.className}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                background: sortOpen ? INK : CREAM,
                color: sortOpen ? CREAM : '#3a2a10',
                border: '1px solid #c4a870',
                borderRadius: '999px',
                padding: '9px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {/* Funnel / inverted-pyramid glyph */}
              <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5h16l-6 8v5l-4 2v-7z" />
              </svg>
              מיון: {sortSummary}
            </button>

            {sortOpen && (
              <div
                role="dialog"
                aria-label="אפשרויות מיון"
                style={{
                  position: 'absolute', top: 'calc(100% + 8px)', insetInlineStart: 0,
                  zIndex: 30, width: 'min(300px, 82vw)',
                  background: 'linear-gradient(160deg, #fdf6e3, #f5e8c8)',
                  border: '1px solid #c4a870',
                  borderRadius: '10px',
                  boxShadow: '0 10px 30px rgba(90,60,20,0.22)',
                  padding: '14px',
                  display: 'flex', flexDirection: 'column', gap: '14px',
                }}
              >
                <div>
                  <span style={groupLabel}>מיין לפי</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {SORT_METRIC_OPTIONS.map((o) => (
                      <button key={o.value} type="button" onClick={() => patchSort({ metric: o.value })}
                        aria-pressed={sort.metric === o.value} style={chip(sort.metric === o.value)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span style={{ ...groupLabel, opacity: perspectiveDisabled ? 0.5 : 1 }}>נקודת מבט</span>
                  <div style={{ ...segmentTrack, opacity: perspectiveDisabled ? 0.5 : 1 }}>
                    {PERSPECTIVE_OPTIONS.map((o) => (
                      <button key={o.value} type="button"
                        disabled={perspectiveDisabled}
                        onClick={() => patchSort({ perspective: o.value })}
                        aria-pressed={sort.perspective === o.value}
                        style={segment(sort.perspective === o.value, perspectiveDisabled)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span style={groupLabel}>סדר</span>
                  <div style={segmentTrack}>
                    <button type="button" onClick={() => patchSort({ dir: 'desc' })}
                      aria-pressed={sort.dir === 'desc'} style={segment(sort.dir === 'desc')}>
                      ↓ מהגבוה לנמוך
                    </button>
                    <button type="button" onClick={() => patchSort({ dir: 'asc' })}
                      aria-pressed={sort.dir === 'asc'} style={segment(sort.dir === 'asc')}>
                      ↑ מהנמוך לגבוה
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <input
            type="text"
            value={filters.q ?? ''}
            onChange={(e) => patchFilters({ q: e.target.value || undefined })}
            placeholder="חפש בית קפה..."
            dir="rtl"
            style={{
              flex: '1 1 200px',
              background: CREAM,
              border: '1px solid #c4a870',
              color: '#2a1a06',
              padding: '9px 12px',
              fontSize: '13px',
              borderRadius: '999px',
            }}
          />
        </div>

        {/* Areas */}
        <div>
          <span style={groupLabel}>אזור</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            {COFFEE_AREAS.map((a) => (
              <button key={a} type="button" onClick={() => patchFilters({ areas: toggleIn(filters.areas, a) })}
                aria-pressed={!!filters.areas?.includes(a)} style={chip(!!filters.areas?.includes(a))}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Tags — led by the "open now" quick filter, then the preference tags */}
        <div>
          <span style={groupLabel}>תגיות</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            <button type="button" onClick={() => patchFilters({ openNow: filters.openNow ? undefined : true })}
              aria-pressed={!!filters.openNow} style={chip(!!filters.openNow)}>
              🕐 פתוח עכשיו
            </button>
            {COFFEE_TAGS.map((t) => (
              <button key={t.id} type="button" onClick={() => patchFilters({ tags: toggleIn(filters.tags, t.id) })}
                aria-pressed={!!filters.tags?.includes(t.id)} style={chip(!!filters.tags?.includes(t.id))}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price tier + min-coffee slider */}
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <span style={groupLabel}>טווח מחיר</span>
            <div style={{ display: 'flex', gap: '7px' }}>
              {PRICE_TIERS.map((t) => (
                <button key={t.value} type="button" onClick={() => patchFilters({ tiers: toggleIn(filters.tiers, t.value) })}
                  aria-pressed={!!filters.tiers?.includes(t.value)} style={chip(!!filters.tiers?.includes(t.value))}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: '1 1 180px', minWidth: '160px' }}>
            <span style={groupLabel}>ציון קפה מינימלי: {(filters.minCoffee ?? 0).toFixed(1)}</span>
            <input
              type="range" min={0} max={10} step={0.5}
              value={filters.minCoffee ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                patchFilters({ minCoffee: v > 0 ? v : undefined });
              }}
              style={{ width: '100%', accentColor: INK }}
            />
          </div>
        </div>
      </div>
    </details>
  );
};

export default CoffeeControlsBar;
