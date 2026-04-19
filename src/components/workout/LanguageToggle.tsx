'use client';

import React from 'react';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { Language } from '@/types/workout';

type Size = 'sm' | 'md';

interface LanguageToggleProps {
  size?: Size;
}

// Two-flag pill toggle: 🇬🇧 / 🇮🇱 — the active flag is highlighted. One tap
// flips the whole workout section between English (LTR) and Hebrew (RTL).
export default function LanguageToggle({ size = 'md' }: LanguageToggleProps) {
  const { language, setLanguage } = useWorkoutLanguage();

  const options: { code: Language; flag: string; label: string }[] = [
    { code: 'en', flag: '🇬🇧', label: 'English' },
    { code: 'he', flag: '🇮🇱', label: 'עברית' },
  ];

  const padding = size === 'sm' ? '4px 8px' : '6px 10px';
  const fontSize = size === 'sm' ? '16px' : '18px';

  return (
    <div
      role="radiogroup"
      aria-label="Language"
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
        const active = opt.code === language;
        return (
          <button
            key={opt.code}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => setLanguage(opt.code)}
            style={{
              padding,
              fontSize,
              lineHeight: 1,
              background: active ? 'var(--workout-blue)' : 'transparent',
              color: active ? 'white' : 'inherit',
              border: 'none',
              borderRadius: '999px',
              cursor: 'pointer',
              transition: 'background-color 0.15s',
              opacity: active ? 1 : 0.7,
            }}
          >
            {opt.flag}
          </button>
        );
      })}
    </div>
  );
}
