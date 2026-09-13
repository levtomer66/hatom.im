'use client';

import React from 'react';
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

// These metrics aren't per-reviewer, so the perspective select is meaningless
// for them — greyed out rather than hidden, so the layout doesn't jump.
const NO_PERSPECTIVE_METRICS = new Set<SortMetric>(['coffeePrice', 'date', 'name']);

const PRICE_TIERS: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: '₪' },
  { value: 2, label: '₪₪' },
  { value: 3, label: '₪₪₪' },
];

const inputStyle: React.CSSProperties = {
  background: '#fdf6e3',
  border: '1px solid #c4a870',
  color: '#2a1a06',
  padding: '7px 10px',
  fontSize: '12px',
  borderRadius: '2px',
  width: '100%',
};

const labelStyle: React.CSSProperties = {
  fontSize: '9px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#a08040',
  marginBottom: '4px',
  display: 'block',
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: '11px',
    padding: '4px 10px',
    borderRadius: '12px',
    border: `1px solid ${active ? '#5a3a10' : '#c4a870'}`,
    background: active ? '#3a2a10' : 'transparent',
    color: active ? '#fdf6e3' : '#5a3a10',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  };
}

const toggleLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '11px',
  color: '#5a3a10',
  cursor: 'pointer',
};

// Sort + filter controls for the discovery UI. Fully controlled — every
// interaction produces a brand-new CoffeeControls object and hands it to
// onChange; the page owns the state and syncs it to the URL + localStorage.
const CoffeeControlsBar: React.FC<CoffeeControlsBarProps> = ({ controls, onChange }) => {
  const { sort, filters } = controls;
  const perspectiveDisabled = NO_PERSPECTIVE_METRICS.has(sort.metric);

  const patchSort = (patch: Partial<SortSpec>) => {
    onChange({ sort: { ...sort, ...patch }, filters });
  };

  const patchFilters = (patch: Partial<CoffeeFilters>) => {
    onChange({ sort, filters: { ...filters, ...patch } });
  };

  const toggleArea = (area: string) => {
    const areas = filters.areas ?? [];
    const next = areas.includes(area) ? areas.filter((a) => a !== area) : [...areas, area];
    patchFilters({ areas: next.length ? next : undefined });
  };

  const toggleTag = (tag: string) => {
    const tags = filters.tags ?? [];
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    patchFilters({ tags: next.length ? next : undefined });
  };

  const toggleTier = (tier: 1 | 2 | 3) => {
    const tiers = filters.tiers ?? [];
    const next = tiers.includes(tier) ? tiers.filter((t) => t !== tier) : [...tiers, tier];
    patchFilters({ tiers: next.length ? next : undefined });
  };

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
      <summary
        style={{
          cursor: 'pointer',
          fontSize: '11px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#5a3a10',
          fontWeight: 700,
        }}
      >
        חיפוש וסינון
      </summary>

      <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '16px', direction: 'rtl' }}>
        {/* Search */}
        <div>
          <label style={labelStyle}>חיפוש לפי שם</label>
          <input
            type="text"
            value={filters.q ?? ''}
            onChange={(e) => patchFilters({ q: e.target.value || undefined })}
            placeholder="חפש בית קפה..."
            style={inputStyle}
            dir="rtl"
          />
        </div>

        {/* Sort metric + perspective + direction */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 130px' }}>
            <label style={labelStyle}>מיין לפי</label>
            <select
              value={sort.metric}
              onChange={(e) => patchSort({ metric: e.target.value as SortMetric })}
              style={inputStyle}
            >
              {SORT_METRIC_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 110px' }}>
            <label style={labelStyle}>נקודת מבט</label>
            <select
              value={sort.perspective}
              disabled={perspectiveDisabled}
              onChange={(e) => patchSort({ perspective: e.target.value as SortPerspective })}
              style={{ ...inputStyle, opacity: perspectiveDisabled ? 0.5 : 1 }}
            >
              {PERSPECTIVE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              onClick={() => patchSort({ dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
              className={courier.className}
              style={{ ...inputStyle, width: 'auto', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              {sort.dir === 'asc' ? '↑ עולה' : '↓ יורד'}
            </button>
          </div>
        </div>

        {/* Areas */}
        <div>
          <label style={labelStyle}>אזור</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {COFFEE_AREAS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => toggleArea(a)}
                aria-pressed={!!filters.areas?.includes(a)}
                style={chipStyle(!!filters.areas?.includes(a))}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label style={labelStyle}>תגיות</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {COFFEE_TAGS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.id)}
                aria-pressed={!!filters.tags?.includes(t.id)}
                style={chipStyle(!!filters.tags?.includes(t.id))}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price tier + min-coffee slider */}
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <label style={labelStyle}>טווח מחיר</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {PRICE_TIERS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => toggleTier(t.value)}
                  aria-pressed={!!filters.tiers?.includes(t.value)}
                  style={chipStyle(!!filters.tiers?.includes(t.value))}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: '1 1 180px', minWidth: '160px' }}>
            <label style={labelStyle}>ציון קפה מינימלי: {(filters.minCoffee ?? 0).toFixed(1)}</label>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={filters.minCoffee ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                patchFilters({ minCoffee: v > 0 ? v : undefined });
              }}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Boolean toggles */}
        <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
          <label style={toggleLabelStyle}>
            <input
              type="checkbox"
              checked={!!filters.hasPhoto}
              onChange={(e) => patchFilters({ hasPhoto: e.target.checked || undefined })}
            />
            עם תמונה
          </label>
          <label style={toggleLabelStyle}>
            <input
              type="checkbox"
              checked={!!filters.hideUnrated}
              onChange={(e) => patchFilters({ hideUnrated: e.target.checked || undefined })}
            />
            הסתר לא מדורגים
          </label>
          <label style={toggleLabelStyle}>
            <input
              type="checkbox"
              checked={!!filters.openNow}
              onChange={(e) => patchFilters({ openNow: e.target.checked || undefined })}
            />
            פתוח עכשיו
          </label>
        </div>
      </div>
    </details>
  );
};

export default CoffeeControlsBar;
