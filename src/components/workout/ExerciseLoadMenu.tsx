'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/workout-i18n';
import { useWorkoutUnit } from '@/context/WorkoutUnitContext';
import { useWorkoutSettings } from '@/context/WorkoutSettingsContext';
import { kgToDisplay, displayToKg } from '@/lib/weight';
import { useClickOutside } from '@/lib/useClickOutside';
import { DEFAULT_BAR_WEIGHT_KG } from '@/lib/workout-load';
import { resolveExerciseId } from '@/data/exercise-library';
import { LoadEntry } from '@/types/workout';

// ⚙️ gear next to an exercise: the per-user choice of how THIS exercise's
// weight is entered (feature 2) — total, per-side (+ bar), or per-dumbbell.
// Defaults to today's behaviour (total). Persists per user+exercise via the
// settings context; keyed by the canonical exercise id to match save-time
// load stamping.
export default function ExerciseLoadMenu({ exerciseId }: { exerciseId: string }) {
  const t = useT();
  const { unit } = useWorkoutUnit();
  const { exerciseLoad, setExerciseLoadPref } = useWorkoutSettings();

  const key = resolveExerciseId(exerciseId);
  const pref = exerciseLoad[key];
  const entry: LoadEntry = pref?.entry ?? 'total';
  const barKg = pref?.barWeightKg ?? DEFAULT_BAR_WEIGHT_KG;

  const [open, setOpen] = useState(false);
  const [barText, setBarText] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) setBarText(String(Math.round(kgToDisplay(barKg, unit) * 10) / 10));
  }, [open, barKg, unit]);

  useClickOutside([popoverRef, buttonRef], () => setOpen(false), open);

  const choose = (next: LoadEntry) => {
    if (next === 'total') {
      setExerciseLoadPref(key, null); // total is the default → clear the override
    } else if (next === 'per-side') {
      setExerciseLoadPref(key, { entry: 'per-side', barWeightKg: pref?.barWeightKg ?? DEFAULT_BAR_WEIGHT_KG });
    } else {
      setExerciseLoadPref(key, { entry: 'per-dumbbell' });
    }
  };

  const commitBar = () => {
    const v = parseFloat(barText);
    const kg = Number.isFinite(v) && v >= 0 ? displayToKg(v, unit) : DEFAULT_BAR_WEIGHT_KG;
    setExerciseLoadPref(key, { entry: 'per-side', barWeightKg: Math.round(kg * 10) / 10 });
  };

  return (
    <span className="exercise-load-menu">
      <button
        ref={buttonRef}
        type="button"
        className={`exercise-card-action${entry !== 'total' ? ' exercise-card-action-on' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={t('load.settings_aria')}
        aria-expanded={open}
        title={t('load.settings_aria')}
      >
        ⚙
      </button>
      {open && (
        <div ref={popoverRef} className="exercise-load-popover" role="dialog">
          <div className="exercise-load-title">{t('load.title')}</div>
          {(['total', 'per-side', 'per-dumbbell'] as LoadEntry[]).map((opt) => (
            <button
              key={opt}
              type="button"
              className={`exercise-load-option${entry === opt ? ' selected' : ''}`}
              onClick={() => choose(opt)}
            >
              {opt === 'total'
                ? t('load.total')
                : opt === 'per-side'
                  ? t('load.per_side')
                  : t('load.per_dumbbell')}
              {entry === opt && <span aria-hidden="true"> ✓</span>}
            </button>
          ))}
          {entry === 'per-side' && (
            <div className="exercise-load-bar-row">
              <label htmlFor="exercise-load-bar">{t('load.bar_weight')}</label>
              <input
                id="exercise-load-bar"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                className="profile-menu-bw-input"
                value={barText}
                onChange={(e) => setBarText(e.target.value)}
                onBlur={commitBar}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitBar();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
              <span className="profile-menu-bw-unit">{unit}</span>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
