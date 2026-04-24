'use client';

import React from 'react';
import { useWorkoutUnit } from '@/context/WorkoutUnitContext';
import { WeightUnit } from '@/types/workout';

type Size = 'sm' | 'md';

interface WeightUnitToggleProps {
  size?: Size;
}

// Two-pill kg / lb toggle, visually matching LanguageToggle. Flips every
// weight input and label in the workout section without touching storage.
export default function WeightUnitToggle({ size = 'md' }: WeightUnitToggleProps) {
  const { unit, setUnit } = useWorkoutUnit();

  const options: { code: WeightUnit; label: string }[] = [
    { code: 'kg', label: 'kg' },
    { code: 'lb', label: 'lb' },
  ];

  const padding = size === 'sm' ? '3px 9px' : '5px 11px';
  const fontSize = size === 'sm' ? '12px' : '13px';

  return (
    <div
      role="radiogroup"
      aria-label="Weight unit"
      style={{
        display: 'inline-flex',
        gap: '4px',
        padding: '2px',
        backgroundColor: 'var(--workout-bg-card)',
        borderRadius: '999px',
        border: '1px solid var(--workout-border)',
      }}
    >
      {options.map(opt => {
        const active = opt.code === unit;
        return (
          <button
            key={opt.code}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => setUnit(opt.code)}
            style={{
              padding,
              fontSize,
              lineHeight: 1,
              fontWeight: 700,
              letterSpacing: '0.04em',
              background: active ? 'var(--workout-blue)' : 'transparent',
              color: active ? 'white' : 'var(--workout-text-secondary)',
              border: 'none',
              borderRadius: '999px',
              cursor: 'pointer',
              transition: 'background-color 0.15s',
              textTransform: 'uppercase',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
